import type {
  ElectricityRecord,
  WeatherRecord,
  OccupancyRecord,
  EquipmentRecord,
  TariffConfig,
  ForecastEvaluation,
  ForecastPoint,
  AnomalyPoint,
  OptimizationRecommendation
} from '../types';

// Helper to determine tariff period for an hour
export function getTariffPeriod(
  hour: number,
  tariff: TariffConfig
): { period: 'peak' | 'normal' | 'off_peak'; rate: number; label: string } {
  // Parse peak hours e.g. "09:00-12:00, 18:00-22:00"
  const isPeak = matchesTimeRanges(hour, tariff.peakHours || '09:00-12:00, 18:00-22:00');
  const isOffPeak = matchesTimeRanges(hour, tariff.offPeakHours || '22:00-06:00');

  if (isPeak) {
    return { period: 'peak', rate: tariff.peakRate, label: 'Peak (₹' + tariff.peakRate + '/kWh)' };
  }
  if (isOffPeak) {
    return { period: 'off_peak', rate: tariff.offPeakRate, label: 'Off-Peak (₹' + tariff.offPeakRate + '/kWh)' };
  }
  return { period: 'normal', rate: tariff.normalRate, label: 'Normal (₹' + tariff.normalRate + '/kWh)' };
}

function matchesTimeRanges(hour: number, rangeStr: string): boolean {
  if (!rangeStr) return false;
  const parts = rangeStr.split(',').map((s) => s.trim());
  for (const part of parts) {
    const [startStr, endStr] = part.split('-');
    if (!startStr || !endStr) continue;
    const startH = parseInt(startStr.split(':')[0], 10);
    const endH = parseInt(endStr.split(':')[0], 10);

    if (startH <= endH) {
      if (hour >= startH && hour < endH) return true;
    } else {
      // Crosses midnight e.g. 22:00-06:00
      if (hour >= startH || hour < endH) return true;
    }
  }
  return false;
}

// Compute total tariff electricity cost
export function calculateElectricityCost(
  records: ElectricityRecord[],
  tariff: TariffConfig
): {
  baseCost: number;
  fixedCost: number;
  demandCost: number;
  taxCost: number;
  totalCost: number;
  peakKwh: number;
  normalKwh: number;
  offPeakKwh: number;
  peakCost: number;
  normalCost: number;
  offPeakCost: number;
  peakDemandKw: number;
} {
  let peakKwh = 0;
  let normalKwh = 0;
  let offPeakKwh = 0;
  let peakCost = 0;
  let normalCost = 0;
  let offPeakCost = 0;
  let maxDemand = 0;

  records.forEach((r) => {
    const hour = new Date(r.timestamp).getHours();
    const { period, rate } = getTariffPeriod(hour, tariff);
    const cost = r.energy_kwh * rate;

    const power = r.average_power_kw ?? r.energy_kwh;
    if (power > maxDemand) maxDemand = power;

    if (period === 'peak') {
      peakKwh += r.energy_kwh;
      peakCost += cost;
    } else if (period === 'off_peak') {
      offPeakKwh += r.energy_kwh;
      offPeakCost += cost;
    } else {
      normalKwh += r.energy_kwh;
      normalCost += cost;
    }
  });

  const baseCost = peakCost + normalCost + offPeakCost;
  const fixedCost = tariff.fixedMonthlyCharge || 0;
  const demandCost = maxDemand * (tariff.demandChargePerKw || 0);
  const subTotal = baseCost + fixedCost + demandCost;
  const taxCost = (subTotal * (tariff.taxPercentage || 0)) / 100;
  const totalCost = subTotal + taxCost;

  return {
    baseCost: Math.round(baseCost),
    fixedCost: Math.round(fixedCost),
    demandCost: Math.round(demandCost),
    taxCost: Math.round(taxCost),
    totalCost: Math.round(totalCost),
    peakKwh: Math.round(peakKwh * 10) / 10,
    normalKwh: Math.round(normalKwh * 10) / 10,
    offPeakKwh: Math.round(offPeakKwh * 10) / 10,
    peakCost: Math.round(peakCost),
    normalCost: Math.round(normalCost),
    offPeakCost: Math.round(offPeakCost),
    peakDemandKw: Math.round(maxDemand * 10) / 10
  };
}

// Compute Anomaly Points via Statistical Bounds
export function detectAnomalies(
  records: ElectricityRecord[]
): AnomalyPoint[] {
  if (records.length < 24) return [];

  // Group by (hour, building_id) to calculate baseline expected consumption
  const stats: Record<string, number[]> = {};
  records.forEach((r) => {
    const hour = new Date(r.timestamp).getHours();
    const key = `${r.building_id}_${hour}`;
    if (!stats[key]) stats[key] = [];
    stats[key].push(r.energy_kwh);
  });

  const meanStd: Record<string, { mean: number; std: number }> = {};
  Object.keys(stats).forEach((k) => {
    const vals = stats[k];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length || 1);
    meanStd[k] = { mean, std: Math.sqrt(variance) };
  });

  const anomalies: AnomalyPoint[] = [];

  records.forEach((r) => {
    const hour = new Date(r.timestamp).getHours();
    const key = `${r.building_id}_${hour}`;
    const baseline = meanStd[key];
    if (!baseline || baseline.std === 0) return;

    const zScore = (r.energy_kwh - baseline.mean) / baseline.std;
    if (zScore > 2.6 || zScore < -2.8) {
      const devPct = Math.round(((r.energy_kwh - baseline.mean) / (baseline.mean || 1)) * 100);
      anomalies.push({
        timestamp: r.timestamp,
        buildingId: r.building_id,
        meterId: r.meter_id,
        energyKwh: r.energy_kwh,
        expectedKwh: Math.round(baseline.mean * 10) / 10,
        deviationPercent: devPct,
        severity: zScore > 3.5 ? 'high' : 'medium',
        reason:
          zScore > 0
            ? `Unusual demand surge (${devPct}% above hourly mean of ${Math.round(baseline.mean)} kWh)`
            : `Abnormally low draw (${Math.abs(devPct)}% below hourly mean)`
      });
    }
  });

  return anomalies.slice(-15); // Return latest prominent anomalies
}

// Machine Learning Forecasting & Evaluation Engine
export function trainAndEvaluateForecast(
  records: ElectricityRecord[],
  weatherMap?: Map<string, WeatherRecord>,
  occupancyMap?: Map<string, OccupancyRecord>
): {
  evaluation: ForecastEvaluation;
  holdoutComparison: ForecastPoint[];
  next24hForecast: ForecastPoint[];
  next7dForecast: ForecastPoint[];
  featureImportance: { feature: string; importance: number }[];
} {
  // Aggregate records by hourly timestamp across active filters
  const hourlyAgg: Record<string, { kwh: number; timestamp: string }> = {};
  records.forEach((r) => {
    // Truncate to hour
    const d = new Date(r.timestamp);
    d.setMinutes(0, 0, 0);
    const iso = d.toISOString();
    if (!hourlyAgg[iso]) {
      hourlyAgg[iso] = { kwh: 0, timestamp: iso };
    }
    hourlyAgg[iso].kwh += r.energy_kwh;
  });

  const sortedPoints = Object.values(hourlyAgg).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sortedPoints.length < 48) {
    // Insufficient data safeguard
    return {
      evaluation: {
        mae: 0,
        rmse: 0,
        wape: 0,
        r2: 0,
        baselineMae: 0,
        baselineRmse: 0,
        baselineImprovementPct: 0,
        reliabilityScore: 0,
        sampleSize: sortedPoints.length,
        predictionIntervalNominal: 90,
        observedCoveragePct: 0,
        isInsufficientData: true,
        statusMessage: 'Insufficient historical data to assess forecast reliability (minimum 48 hourly intervals required).'
      },
      holdoutComparison: [],
      next24hForecast: [],
      next7dForecast: [],
      featureImportance: []
    };
  }

  // Feature Extraction
  // Split chronologically: first 75% training, last 25% (or last 7 days = 168 hours) holdout test set to prevent temporal leakage!
  const holdoutSize = Math.min(168, Math.max(24, Math.floor(sortedPoints.length * 0.25)));
  const trainSize = sortedPoints.length - holdoutSize;

  // Features:
  // 0: bias (1)
  // 1: sin(hour)
  // 2: cos(hour)
  // 3: sin(dayOfWeek)
  // 4: cos(dayOfWeek)
  // 5: lag-1h
  // 6: lag-24h
  // 7: rolling-6h
  // 8: temp (if available)
  // 9: occupancy (if available)

  const featureNames = [
    'Hour Cycle (Sin/Cos)',
    'Day of Week Cycle',
    'Lag-1h Auto-regression',
    'Lag-24h Daily Recurrence',
    'Rolling 6h Trend',
    'Ambient Temperature',
    'Occupancy Load'
  ];

  function extractFeatures(idx: number): number[] {
    const pt = sortedPoints[idx];
    const d = new Date(pt.timestamp);
    const h = d.getHours();
    const day = d.getDay();

    const sinH = Math.sin((h / 24) * 2 * Math.PI);
    const cosH = Math.cos((h / 24) * 2 * Math.PI);
    const sinD = Math.sin((day / 7) * 2 * Math.PI);
    const cosD = Math.cos((day / 7) * 2 * Math.PI);

    const lag1 = idx >= 1 ? sortedPoints[idx - 1].kwh : pt.kwh;
    const lag24 = idx >= 24 ? sortedPoints[idx - 24].kwh : lag1;

    let rolling6 = 0;
    const rollCount = Math.min(6, idx + 1);
    for (let i = 0; i < rollCount; i++) {
      rolling6 += sortedPoints[idx - i].kwh;
    }
    rolling6 = rolling6 / rollCount;

    const weather = weatherMap?.get(pt.timestamp);
    const temp = weather ? weather.temperature_c : 26.0;

    const occ = occupancyMap?.get(pt.timestamp);
    const occVal = occ ? occ.occupancy_count / 100 : (h >= 9 && h <= 18 ? 4.5 : 0.5);

    return [1, sinH, cosH, sinD, cosD, lag1 / 100, lag24 / 100, rolling6 / 100, temp / 30, occVal];
  }

  // Build Linear/Ridge Regression coefficients using normal equations or iterative descent
  // X: (N x K), y: (N x 1)
  const numFeatures = 10;
  const Xtrain: number[][] = [];
  const Ytrain: number[] = [];

  for (let i = 24; i < trainSize; i++) {
    Xtrain.push(extractFeatures(i));
    Ytrain.push(sortedPoints[i].kwh);
  }

  // Ridge Regression solve: (X^T X + lambda*I)^(-1) X^T y
  const lambda = 0.5;
  const XtX: number[][] = Array(numFeatures).fill(0).map(() => Array(numFeatures).fill(0));
  const XtY: number[] = Array(numFeatures).fill(0);

  for (let r = 0; r < Xtrain.length; r++) {
    const x = Xtrain[r];
    const y = Ytrain[r];
    for (let i = 0; i < numFeatures; i++) {
      XtY[i] += x[i] * y;
      for (let j = 0; j < numFeatures; j++) {
        XtX[i][j] += x[i] * x[j];
      }
    }
  }

  for (let i = 0; i < numFeatures; i++) {
    XtX[i][i] += lambda;
  }

  // Gaussian elimination to solve weights
  const weights = solveLinearSystem(XtX, XtY);

  function predict(features: number[]): number {
    let sum = 0;
    for (let i = 0; i < numFeatures; i++) {
      sum += (weights[i] || 0) * features[i];
    }
    return Math.max(0, sum);
  }

  // Evaluate on holdout test set
  let totalAbsError = 0;
  let totalSqError = 0;
  let totalActual = 0;
  let baselineTotalAbsError = 0;
  let baselineTotalSqError = 0;
  const residuals: number[] = [];
  const holdoutComparison: ForecastPoint[] = [];

  for (let i = trainSize; i < sortedPoints.length; i++) {
    const actual = sortedPoints[i].kwh;
    const feat = extractFeatures(i);
    const predicted = predict(feat);

    // Simple baseline: previous day same hour (lag-24) or previous week
    const baselinePred = i >= 24 ? sortedPoints[i - 24].kwh : sortedPoints[i - 1].kwh;

    const err = actual - predicted;
    residuals.push(err);

    totalAbsError += Math.abs(err);
    totalSqError += err * err;
    totalActual += actual;

    const baseErr = actual - baselinePred;
    baselineTotalAbsError += Math.abs(baseErr);
    baselineTotalSqError += baseErr * baseErr;

    holdoutComparison.push({
      timestamp: sortedPoints[i].timestamp,
      actual: Math.round(actual * 10) / 10,
      predicted: Math.round(predicted * 10) / 10,
      baselinePredicted: Math.round(baselinePred * 10) / 10,
      lowerBound: 0, // will fill after quantile calculation
      upperBound: 0,
      isFuture: false
    });
  }

  const N = holdoutSize || 1;
  const mae = totalAbsError / N;
  const rmse = Math.sqrt(totalSqError / N);
  const wape = totalActual > 0 ? (totalAbsError / totalActual) * 100 : 0;
  const meanActual = totalActual / N;

  // Baseline metrics
  const baselineMae = baselineTotalAbsError / N;
  const baselineRmse = Math.sqrt(baselineTotalSqError / N);
  const baselineImprovementPct = baselineMae > 0 ? ((baselineMae - mae) / baselineMae) * 100 : 0;

  // R^2 calculation
  const ssTot = holdoutComparison.reduce((sum, p) => sum + Math.pow((p.actual || 0) - meanActual, 2), 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - totalSqError / ssTot) : 0;

  // Forecast Reliability Score per PDF formula: S = 100 * max(0, 1 - MAE / mean_y) with data sample penalty
  let rawScore = meanActual > 0 ? Math.max(0, 1 - mae / meanActual) * 100 : 50;
  // If sample size is modest (< 100), discount reliability conservatively
  const samplePenalty = sortedPoints.length >= 300 ? 1.0 : Math.min(1.0, 0.8 + (sortedPoints.length / 300) * 0.2);
  const reliabilityScore = Math.round(rawScore * samplePenalty * 10) / 10;

  // 90% Prediction Intervals from empirical residual quantiles (5th to 95th percentiles)
  residuals.sort((a, b) => a - b);
  const q05 = residuals[Math.floor(residuals.length * 0.05)] || -mae * 1.64;
  const q95 = residuals[Math.floor(residuals.length * 0.95)] || mae * 1.64;

  let insideIntervalCount = 0;
  holdoutComparison.forEach((pt) => {
    pt.lowerBound = Math.max(0, Math.round((pt.predicted + q05) * 10) / 10);
    pt.upperBound = Math.round((pt.predicted + q95) * 10) / 10;
    if (pt.actual !== undefined && pt.actual >= pt.lowerBound && pt.actual <= pt.upperBound) {
      insideIntervalCount++;
    }
  });

  const observedCoveragePct = Math.round((insideIntervalCount / N) * 1000) / 10;

  // Generate Next-24-hour forecast
  const lastPoint = sortedPoints[sortedPoints.length - 1];
  const lastTime = new Date(lastPoint.timestamp).getTime();
  const next24hForecast: ForecastPoint[] = [];

  let simulatedLags = sortedPoints.slice(-24).map((p) => p.kwh);

  for (let step = 1; step <= 24; step++) {
    const futureTime = new Date(lastTime + step * 3600 * 1000);
    const iso = futureTime.toISOString();
    const h = futureTime.getHours();
    const day = futureTime.getDay();

    const sinH = Math.sin((h / 24) * 2 * Math.PI);
    const cosH = Math.cos((h / 24) * 2 * Math.PI);
    const sinD = Math.sin((day / 7) * 2 * Math.PI);
    const cosD = Math.cos((day / 7) * 2 * Math.PI);

    const lag1 = simulatedLags[simulatedLags.length - 1];
    const lag24 = simulatedLags[Math.max(0, simulatedLags.length - 24)];
    const roll6 = simulatedLags.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, simulatedLags.length);

    const weather = weatherMap?.get(iso);
    const temp = weather ? weather.temperature_c : 27.5;
    const occVal = h >= 9 && h <= 18 ? 5.2 : 0.8;

    const feat = [1, sinH, cosH, sinD, cosD, lag1 / 100, lag24 / 100, roll6 / 100, temp / 30, occVal];
    const pred = predict(feat);
    simulatedLags.push(pred);

    next24hForecast.push({
      timestamp: iso,
      predicted: Math.round(pred * 10) / 10,
      baselinePredicted: Math.round(lag24 * 10) / 10,
      lowerBound: Math.max(0, Math.round((pred + q05) * 10) / 10),
      upperBound: Math.round((pred + q95) * 10) / 10,
      isFuture: true
    });
  }

  // Next-7-day forecast (168 hours)
  const next7dForecast: ForecastPoint[] = [];
  for (let step = 1; step <= 168; step++) {
    const futureTime = new Date(lastTime + step * 3600 * 1000);
    const iso = futureTime.toISOString();
    const h = futureTime.getHours();
    const day = futureTime.getDay();

    const sinH = Math.sin((h / 24) * 2 * Math.PI);
    const cosH = Math.cos((h / 24) * 2 * Math.PI);
    const sinD = Math.sin((day / 7) * 2 * Math.PI);
    const cosD = Math.cos((day / 7) * 2 * Math.PI);

    const lag1 = simulatedLags[simulatedLags.length - 1];
    const lag24 = simulatedLags[Math.max(0, simulatedLags.length - 24)];
    const roll6 = simulatedLags.slice(-6).reduce((a, b) => a + b, 0) / 6;

    const feat = [1, sinH, cosH, sinD, cosD, lag1 / 100, lag24 / 100, roll6 / 100, 27.0 / 30, (h >= 9 && h <= 18 ? 4.5 : 0.6)];
    const pred = predict(feat);
    simulatedLags.push(pred);

    next7dForecast.push({
      timestamp: iso,
      predicted: Math.round(pred * 10) / 10,
      baselinePredicted: Math.round(lag24 * 10) / 10,
      lowerBound: Math.max(0, Math.round((pred + q05 * (1 + (step / 168) * 0.4)) * 10) / 10),
      upperBound: Math.round((pred + q95 * (1 + (step / 168) * 0.4)) * 10) / 10,
      isFuture: true
    });
  }

  // Feature Importance estimation based on standardized coefficient magnitudes
  const rawWeights = [
    Math.abs(weights[1]) + Math.abs(weights[2]),
    Math.abs(weights[3]) + Math.abs(weights[4]),
    Math.abs(weights[5]),
    Math.abs(weights[6]),
    Math.abs(weights[7]),
    Math.abs(weights[8]),
    Math.abs(weights[9])
  ];
  const sumW = rawWeights.reduce((a, b) => a + b, 0) || 1;
  const featureImportance = featureNames.map((name, i) => ({
    feature: name,
    importance: Math.round((rawWeights[i] / sumW) * 1000) / 10
  })).sort((a, b) => b.importance - a.importance);

  return {
    evaluation: {
      mae: Math.round(mae * 10) / 10,
      rmse: Math.round(rmse * 10) / 10,
      wape: Math.round(wape * 10) / 10,
      r2: Math.round(r2 * 1000) / 1000,
      baselineMae: Math.round(baselineMae * 10) / 10,
      baselineRmse: Math.round(baselineRmse * 10) / 10,
      baselineImprovementPct: Math.round(baselineImprovementPct * 10) / 10,
      reliabilityScore,
      sampleSize: sortedPoints.length,
      predictionIntervalNominal: 90,
      observedCoveragePct,
      isInsufficientData: false,
      statusMessage: 'Model evaluated using chronological holdout test set (no future leakage).'
    },
    holdoutComparison,
    next24hForecast,
    next7dForecast,
    featureImportance
  };
}

// Simple Gaussian solver for (A * x = b)
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-9) continue;

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) > 1e-9 ? sum / M[i][i] : 0;
  }
  return x;
}

// Constrained Optimization & Load Shifting Engine
export function runOptimizationEngine(
  records: ElectricityRecord[],
  equipment: EquipmentRecord[],
  tariff: TariffConfig
): {
  recommendations: OptimizationRecommendation[];
  baselineCost: number;
  optimizedCost: number;
  totalMonthlySavings: number;
  hourlyBaselineLoad: number[];
  hourlyOptimizedLoad: number[];
  waterfallData: { name: string; value: number }[];
} {
  // Aggregate hourly load profile (0-23)
  const hourlySums = Array(24).fill(0);
  const hourlyCounts = Array(24).fill(0);

  records.forEach((r) => {
    const h = new Date(r.timestamp).getHours();
    hourlySums[h] += r.energy_kwh;
    hourlyCounts[h]++;
  });

  const hourlyBaselineLoad = hourlySums.map((sum, h) =>
    hourlyCounts[h] > 0 ? Math.round((sum / hourlyCounts[h]) * 10) / 10 : 25
  );

  const hourlyOptimizedLoad = [...hourlyBaselineLoad];
  const recommendations: OptimizationRecommendation[] = [];

  // Filter only flexible loads
  const flexibleEquip = equipment.filter((e) => e.flexible_load);

  let totalDailySavings = 0;

  flexibleEquip.forEach((eq) => {
    const ratedKw = eq.rated_power_kw;
    const durationHours = Math.ceil((eq.required_runtime_minutes || 240) / 60);

    // Current unoptimized operating hours (usually set during business/peak hours)
    let currentStartHour = 10;
    let currentEndHour = 10 + durationHours;

    if (eq.equipment_id.includes('PUMP')) {
      currentStartHour = 10; // Peak morning
    } else if (eq.equipment_id.includes('TES')) {
      currentStartHour = 14; // Mid-day
    } else if (eq.equipment_id.includes('HVAC')) {
      currentStartHour = 11;
    } else if (eq.equipment_id.includes('LND')) {
      currentStartHour = 18; // Evening peak
    }

    currentEndHour = currentStartHour + durationHours;

    // Search for optimal window with lowest average tariff rate within allowed operating constraints
    const earliestAllowed = eq.earliest_start_time ? parseInt(eq.earliest_start_time.split(':')[0], 10) : 0;
    const latestAllowed = eq.latest_end_time ? parseInt(eq.latest_end_time.split(':')[0], 10) : 23;

    let bestStartHour = currentStartHour;
    let minCost = Infinity;

    // Evaluate valid starting hours
    for (let candidate = 0; candidate < 24; candidate++) {
      const candidateEnd = candidate + durationHours;
      // Check constraints
      const withinWindow = candidate >= earliestAllowed && candidateEnd <= latestAllowed;
      if (!withinWindow) continue;

      let candidateCost = 0;
      for (let h = candidate; h < candidateEnd; h++) {
        const hourWrapped = h % 24;
        const { rate } = getTariffPeriod(hourWrapped, tariff);
        candidateCost += ratedKw * rate;
      }

      if (candidateCost < minCost) {
        minCost = candidateCost;
        bestStartHour = candidate;
      }
    }

    // Baseline cost for this equipment run
    let baselineRunCost = 0;
    for (let h = currentStartHour; h < currentEndHour; h++) {
      const hourWrapped = h % 24;
      const { rate } = getTariffPeriod(hourWrapped, tariff);
      baselineRunCost += ratedKw * rate;
    }

    const savingsPerDay = Math.max(0, baselineRunCost - minCost);
    totalDailySavings += savingsPerDay;

    // Adjust load profile (shift load from current hours to best hours)
    for (let h = currentStartHour; h < currentEndHour; h++) {
      const hw = h % 24;
      hourlyOptimizedLoad[hw] = Math.max(0, Math.round((hourlyOptimizedLoad[hw] - ratedKw) * 10) / 10);
    }
    for (let h = bestStartHour; h < bestStartHour + durationHours; h++) {
      const hw = h % 24;
      hourlyOptimizedLoad[hw] = Math.round((hourlyOptimizedLoad[hw] + ratedKw) * 10) / 10;
    }

    const startStr = `${String(bestStartHour).padStart(2, '0')}:00`;
    const endStr = `${String(bestStartHour + durationHours).padStart(2, '0')}:00`;
    const currStr = `${String(currentStartHour).padStart(2, '0')}:00 - ${String(currentEndHour).padStart(2, '0')}:00`;

    recommendations.push({
      id: `REC-${eq.equipment_id}`,
      equipmentId: eq.equipment_id,
      equipmentType: eq.equipment_type,
      buildingId: eq.building_id,
      action: `Shift ${eq.equipment_type} operation to off-peak tariff window`,
      currentSchedule: currStr,
      recommendedSchedule: `${startStr} - ${endStr}`,
      loadShiftedKwh: ratedKw * durationHours,
      currentCostInr: Math.round(baselineRunCost),
      optimizedCostInr: Math.round(minCost),
      netSavingsInr: Math.round(savingsPerDay * 30), // Monthly projected
      energySavingsKwh: 0, // Strict PDF constraint: load shifting saves ₹, not kWh!
      priority: savingsPerDay * 30 > 15000 ? 'High' : 'Medium',
      feasibility: 'High',
      constraints: eq.operating_constraints || 'Must meet minimum service delivery requirements',
      rationale: `Moving ${ratedKw} kW load from ₹${tariff.peakRate}/kWh peak period to ₹${tariff.offPeakRate}/kWh off-peak window reduces energy bill without degrading facility service level.`
    });
  });

  // Calculate overall monthly baseline vs optimized cost
  const daysInMonth = 30;
  let dailyBaseCost = 0;
  let dailyOptCost = 0;

  for (let h = 0; h < 24; h++) {
    const { rate } = getTariffPeriod(h, tariff);
    dailyBaseCost += hourlyBaselineLoad[h] * rate;
    dailyOptCost += hourlyOptimizedLoad[h] * rate;
  }

  const baselineCost = Math.round(dailyBaseCost * daysInMonth);
  const optimizedCost = Math.round(dailyOptCost * daysInMonth);
  const totalMonthlySavings = Math.max(0, baselineCost - optimizedCost);

  // Waterfall Chart Breakdown
  const waterfallData = [
    { name: 'Baseline Spend', value: baselineCost },
    ...recommendations.map((r) => ({ name: r.equipmentType.split(' ')[0], value: -r.netSavingsInr })),
    { name: 'Optimized Spend', value: optimizedCost }
  ];

  return {
    recommendations,
    baselineCost,
    optimizedCost,
    totalMonthlySavings,
    hourlyBaselineLoad,
    hourlyOptimizedLoad,
    waterfallData
  };
}

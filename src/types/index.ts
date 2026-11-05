export interface ElectricityRecord {
  timestamp: string; // ISO string e.g. 2026-11-01T09:00:00+05:30
  building_id: string;
  meter_id: string;
  energy_kwh: number;
  average_power_kw?: number;
  meter_status?: 'normal' | 'estimated' | 'missing';
}

export interface WeatherRecord {
  timestamp: string;
  location_id: string;
  temperature_c: number;
  humidity_pct?: number;
  weather_condition?: string;
}

export interface OccupancyRecord {
  timestamp: string;
  building_id: string;
  occupancy_count: number;
  occupancy_source?: string;
}

export interface EquipmentRecord {
  equipment_id: string;
  building_id: string;
  equipment_type: string;
  rated_power_kw: number;
  flexible_load: boolean;
  earliest_start_time?: string; // "HH:MM" e.g. "00:00"
  latest_end_time?: string; // "HH:MM" e.g. "23:59"
  required_runtime_minutes?: number;
  operating_constraints?: string;
}

export interface TariffTimeBlock {
  name: string;
  startHour: number; // 0-23
  endHour: number; // 0-23
  type: 'peak' | 'normal' | 'off_peak';
  rate: number; // ₹/kWh
}

export interface TariffConfig {
  id: string;
  userId: string;
  name: string;
  peakRate: number; // ₹/kWh
  normalRate: number; // ₹/kWh
  offPeakRate: number; // ₹/kWh
  fixedMonthlyCharge: number; // ₹
  demandChargePerKw: number; // ₹/kW of peak demand
  taxPercentage: number; // % e.g. 18%
  peakHours: string; // e.g. "09:00-12:00, 18:00-22:00"
  normalHours: string; // e.g. "06:00-09:00, 12:00-18:00"
  offPeakHours: string; // e.g. "22:00-06:00"
  effectiveStartDate?: string;
  isCustom?: boolean;
}

export interface ValidationReport {
  fileName: string;
  datasetType: 'electricity' | 'weather' | 'occupancy' | 'equipment';
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  missingValuesCount: number;
  duplicateCount: number;
  timestampGapsCount: number;
  detectedIntervalMinutes: number;
  buildingsFound: string[];
  metersFound: string[];
  startDate?: string;
  endDate?: string;
  warnings: string[];
  errors: string[];
  isValid: boolean;
}

export interface AnomalyPoint {
  timestamp: string;
  buildingId: string;
  meterId: string;
  energyKwh: number;
  expectedKwh: number;
  deviationPercent: number;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export interface ForecastEvaluation {
  mae: number;
  rmse: number;
  wape: number;
  r2: number;
  baselineMae: number;
  baselineRmse: number;
  baselineImprovementPct: number;
  reliabilityScore: number; // 0 - 100%
  sampleSize: number;
  predictionIntervalNominal: number; // e.g. 90%
  observedCoveragePct: number;
  isInsufficientData: boolean;
  statusMessage: string;
}

export interface ForecastPoint {
  timestamp: string;
  actual?: number;
  predicted: number;
  baselinePredicted: number;
  lowerBound: number; // 90% lower
  upperBound: number; // 90% upper
  isFuture: boolean;
}

export interface OptimizationRecommendation {
  id: string;
  equipmentId: string;
  equipmentType: string;
  buildingId: string;
  action: string;
  currentSchedule: string;
  recommendedSchedule: string;
  loadShiftedKwh: number;
  currentCostInr: number;
  optimizedCostInr: number;
  netSavingsInr: number;
  energySavingsKwh: number; // strictly 0 if only shifted!
  priority: 'High' | 'Medium' | 'Low';
  feasibility: 'High' | 'Medium' | 'Low';
  constraints: string;
  rationale: string;
}

export interface UserHistoryItem {
  id: string;
  userId: string;
  title: string;
  buildingId: string;
  meterId: string;
  dateRange: string;
  totalKwh: number;
  totalCost: number;
  projectedSavings: number;
  forecastReliabilityScore: number;
  mae: number;
  rmse: number;
  datasetSummary: string;
  createdAt: string;
}

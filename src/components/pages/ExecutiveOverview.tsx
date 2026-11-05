import React from 'react';
import {
  Zap,
  TrendingUp,
  IndianRupee,
  Sparkles,
  Building,
  Target,
  Clock
} from 'lucide-react';
import { PlotlyChart } from '../common/PlotlyChart';
import type { ElectricityRecord, TariffConfig, ForecastPoint } from '../../types';
import { calculateElectricityCost } from '../../utils/analyticsEngine';
import { useAuth } from '../../context/AuthContext';
import { SAMPLE_BUILDINGS } from '../../utils/sampleData';

interface ExecutiveOverviewProps {
  records: ElectricityRecord[];
  tariff: TariffConfig;
  forecastPoints: ForecastPoint[];
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  records,
  tariff,
  forecastPoints
}) => {
  const { targetBudget } = useAuth();

  const costSummary = calculateElectricityCost(records, tariff);
  const totalKwh = records.reduce((sum, r) => sum + r.energy_kwh, 0);
  const avgCostPerKwh = totalKwh > 0 ? costSummary.totalCost / totalKwh : tariff.normalRate;

  // Forecast next 24h consumption
  const next24hKwh = forecastPoints
    .filter((p) => p.isFuture)
    .slice(0, 24)
    .reduce((sum, p) => sum + p.predicted, 0);

  // Daily Consumption & Expenditure Trend
  const dailyMap: Record<string, { kwh: number; cost: number; dateStr: string }> = {};
  records.forEach((r) => {
    const dStr = r.timestamp.slice(0, 10);
    if (!dailyMap[dStr]) {
      dailyMap[dStr] = { kwh: 0, cost: 0, dateStr: dStr };
    }
    dailyMap[dStr].kwh += r.energy_kwh;
    const hour = new Date(r.timestamp).getHours();
    const rate =
      hour >= 9 && hour <= 12
        ? tariff.peakRate
        : hour >= 22 || hour < 6
        ? tariff.offPeakRate
        : tariff.normalRate;
    dailyMap[dStr].cost += r.energy_kwh * rate;
  });

  const dailyKeys = Object.keys(dailyMap).sort();
  const dailyDates = dailyKeys;
  const dailyKwh = dailyKeys.map((k) => Math.round(dailyMap[k].kwh));
  const dailyCost = dailyKeys.map((k) => Math.round(dailyMap[k].cost));

  // Building-wise breakdown
  const buildingKwh: Record<string, number> = {};
  records.forEach((r) => {
    buildingKwh[r.building_id] = (buildingKwh[r.building_id] || 0) + r.energy_kwh;
  });
  const bldgLabels = Object.keys(buildingKwh).map((id) => {
    const b = SAMPLE_BUILDINGS.find((sb) => sb.id === id);
    return b ? `${id} (${b.name.split(' ')[0]})` : id;
  });
  const bldgValues = Object.values(buildingKwh).map((v) => Math.round(v));

  // Actual vs Forecast plot data (last 36 hours actuals + next 24 hours forecast)
  const recentActuals = records.slice(-36);
  const actualDates = recentActuals.map((r) => r.timestamp);
  const actualVals = recentActuals.map((r) => r.energy_kwh);

  const futurePoints = forecastPoints.filter((p) => p.isFuture).slice(0, 24);
  const futureDates = futurePoints.map((p) => p.timestamp);
  const futureVals = futurePoints.map((p) => p.predicted);

  // Budget calculations
  const budgetVariance = targetBudget - costSummary.totalCost;
  const budgetPctUsed = Math.round((costSummary.totalCost / (targetBudget || 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Campus Energy Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time electricity consumption, billing expenditures, and upcoming demand
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs shadow-2xs">
          <Target className="h-4 w-4 text-indigo-600" />
          <span className="text-slate-500">Monthly Budget Target:</span>
          <span className="font-mono font-bold text-slate-800">
            ₹{targetBudget.toLocaleString()}
          </span>
        </div>
      </div>

      {/* KPI Cards Row (Clean, readable, 4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Consumption */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Electricity Used</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {Math.round(totalKwh).toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1.5">kWh</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Across {records.length.toLocaleString()} interval readings
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Electricity Spend</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ₹{costSummary.totalCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Incl. ToU rates, demand &amp; taxes
          </div>
        </div>

        {/* Average Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Average Unit Rate</span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ₹{avgCostPerKwh.toFixed(2)}
            <span className="text-xs font-normal text-slate-500 ml-1.5">/kWh</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Blended effective unit price
          </div>
        </div>

        {/* Tomorrow's Forecast */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Tomorrow's Expected Demand</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {Math.round(next24hKwh).toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1.5">kWh</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Next 24-hour projected volume
          </div>
        </div>
      </div>

      {/* Row 1: Daily Energy & Spend Trend & Building Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily Energy & Spend Trend */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Daily Energy Consumption &amp; Daily Bill Trend
            </h3>
            <p className="text-[11px] text-slate-500">
              Blue bars show daily energy (kWh); Amber line shows daily electricity cost (₹)
            </p>
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: dailyDates,
                y: dailyKwh,
                type: 'bar',
                name: 'Daily Energy (kWh)',
                marker: { color: '#3b82f6', opacity: 0.85 }
              },
              {
                x: dailyDates,
                y: dailyCost,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Daily Spend (₹)',
                yaxis: 'y2',
                line: { color: '#f59e0b', width: 2.2 },
                marker: { size: 4, color: '#f59e0b' }
              }
            ]}
            layout={{
              yaxis: { title: 'Energy (kWh)', gridcolor: '#f1f5f9' },
              yaxis2: {
                title: 'Spend (₹)',
                overlaying: 'y',
                side: 'right',
                showgrid: false,
                color: '#f59e0b'
              },
              xaxis: { gridcolor: '#f1f5f9' },
              legend: { orientation: 'h', y: -0.22 }
            }}
          />
        </div>

        {/* Building Energy Share */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Building Energy Share
              </h3>
              <p className="text-[11px] text-slate-500">
                Proportionate distribution across facilities
              </p>
            </div>
            <Building className="h-4 w-4 text-slate-400" />
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                labels: bldgLabels,
                values: bldgValues,
                type: 'pie',
                hole: 0.5,
                textinfo: 'label+percent',
                marker: {
                  colors: ['#4f46e5', '#0ea5e9', '#f59e0b', '#ec4899']
                }
              }
            ]}
            layout={{
              showlegend: false,
              margin: { l: 15, r: 15, t: 15, b: 15 }
            }}
          />
        </div>
      </div>

      {/* Row 2: Recent Demand vs 24h Forecast & Budget Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Actual Demand vs Tomorrow's Forecast */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Recent Demand &amp; Next 24-Hour Forecast
            </h3>
            <p className="text-[11px] text-slate-500">
              Recent hourly readings paired with tomorrow's predicted demand curve
            </p>
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: actualDates,
                y: actualVals,
                type: 'scatter',
                mode: 'lines',
                name: 'Recent Actuals',
                line: { color: '#10b981', width: 2 }
              },
              {
                x: futureDates,
                y: futureVals,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Tomorrow Projected',
                line: { color: '#8b5cf6', width: 2.2, dash: 'dash' },
                marker: { size: 4, color: '#8b5cf6' }
              }
            ]}
            layout={{
              yaxis: { title: 'Energy (kWh)', gridcolor: '#f1f5f9' },
              xaxis: { gridcolor: '#f1f5f9' },
              legend: { orientation: 'h', y: -0.22 }
            }}
          />
        </div>

        {/* Budget Status Tracker */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-indigo-600" />
              Monthly Budget Status
            </h3>
            <span className={`text-xs font-mono font-bold ${budgetPctUsed > 90 ? 'text-rose-600' : 'text-indigo-600'}`}>
              {budgetPctUsed}% Used
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  budgetPctUsed > 90 ? 'bg-rose-500' : budgetPctUsed > 75 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.min(100, budgetPctUsed)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Spent So Far</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{costSummary.totalCost.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Variance</span>
                <span className={`font-mono font-bold ${budgetVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {budgetVariance >= 0 ? `+₹${budgetVariance.toLocaleString()}` : `-₹${Math.abs(budgetVariance).toLocaleString()}`}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              {budgetVariance >= 0
                ? 'Current spending is within the allocated monthly campus electricity budget.'
                : 'Spending has exceeded target budget ceiling.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

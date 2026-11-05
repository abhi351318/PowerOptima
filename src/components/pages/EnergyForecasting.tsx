import React, { useState } from 'react';
import {
  TrendingUp,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { PlotlyChart } from '../common/PlotlyChart';
import type { ForecastEvaluation, ForecastPoint } from '../../types';

interface EnergyForecastingProps {
  evaluation: ForecastEvaluation;
  holdoutComparison: ForecastPoint[];
  next24hForecast: ForecastPoint[];
  next7dForecast: ForecastPoint[];
}

export const EnergyForecasting: React.FC<EnergyForecastingProps> = ({
  evaluation,
  holdoutComparison,
  next24hForecast,
  next7dForecast
}) => {
  const [horizon, setHorizon] = useState<'24h' | '7d'>('24h');

  if (evaluation.isInsufficientData) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3 shadow-xs">
        <h2 className="text-sm font-bold text-slate-800">
          More historical data needed for forecasting
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          At least 48 hourly intervals are needed to train the predictive model.
        </p>
      </div>
    );
  }

  const activeForecast = horizon === '24h' ? next24hForecast : next7dForecast;
  const futureDates = activeForecast.map((p) => p.timestamp);
  const futurePredicted = activeForecast.map((p) => p.predicted);
  const futureLower = activeForecast.map((p) => p.lowerBound);
  const futureUpper = activeForecast.map((p) => p.upperBound);

  // Total forecast kWh
  const totalForecastKwh = Math.round(activeForecast.reduce((sum, p) => sum + p.predicted, 0));

  // Holdout actuals vs predicted (last 48 hours for clean visual)
  const recentHoldout = holdoutComparison.slice(-48);
  const holdoutDates = recentHoldout.map((p) => p.timestamp);
  const holdoutActuals = recentHoldout.map((p) => p.actual || 0);
  const holdoutPreds = recentHoldout.map((p) => p.predicted);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Energy Demand Forecasting
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Machine learning forecast of upcoming campus electricity demand with confidence intervals
          </p>
        </div>

        {/* 24h / 7d Horizon Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setHorizon('24h')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              horizon === '24h'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Next 24 Hours
          </button>
          <button
            onClick={() => setHorizon('7d')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              horizon === '7d'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7-Day Forecast
          </button>
        </div>
      </div>

      {/* Model Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
            Forecast Reliability
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {evaluation.reliabilityScore}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Historical validation score
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Average Error (MAE)
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            ±{evaluation.mae}
            <span className="text-xs font-normal text-slate-500 ml-1">kWh</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Average hourly variance
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Projected Total ({horizon.toUpperCase()})
          </span>
          <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">
            {totalForecastKwh.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">kWh</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Expected total draw
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
            Baseline Improvement
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            +{evaluation.baselineImprovementPct}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Outperforms naive lag benchmark
          </div>
        </div>
      </div>

      {/* Main Forecast Chart with Confidence Band */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Projected Electricity Demand Trajectory ({horizon.toUpperCase()})
            </h3>
            <p className="text-[11px] text-slate-500">
              Upcoming hourly load curve with shaded 90% confidence range
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
            90% Confidence Band
          </span>
        </div>

        <PlotlyChart
          className="w-full h-72"
          data={[
            {
              x: [...futureDates, ...futureDates.slice().reverse()],
              y: [...futureUpper, ...futureLower.slice().reverse()],
              fill: 'toself',
              fillcolor: 'rgba(99, 102, 241, 0.12)',
              line: { color: 'transparent' },
              name: '90% Uncertainty Range',
              hoverinfo: 'skip'
            },
            {
              x: futureDates,
              y: futurePredicted,
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Predicted Demand (kWh)',
              line: { color: '#6366f1', width: 2.2 },
              marker: { size: horizon === '24h' ? 5 : 2, color: '#6366f1' }
            }
          ]}
          layout={{
            yaxis: { title: 'Energy (kWh)', gridcolor: '#f1f5f9' },
            xaxis: { gridcolor: '#f1f5f9' },
            legend: { orientation: 'h', y: -0.22 }
          }}
        />
      </div>

      {/* Past Accuracy Verification */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Past Model Verification (Actual vs Predicted)
          </h3>
          <p className="text-[11px] text-slate-500">
            How closely model predictions tracked against measured electricity on holdout intervals
          </p>
        </div>

        <PlotlyChart
          className="w-full h-60"
          data={[
            {
              x: holdoutDates,
              y: holdoutActuals,
              type: 'scatter',
              mode: 'lines',
              name: 'Actual Measured',
              line: { color: '#10b981', width: 2 }
            },
            {
              x: holdoutDates,
              y: holdoutPreds,
              type: 'scatter',
              mode: 'lines',
              name: 'Model Predicted',
              line: { color: '#8b5cf6', dash: 'dash', width: 2 }
            }
          ]}
          layout={{
            yaxis: { title: 'Energy (kWh)', gridcolor: '#f1f5f9' },
            xaxis: { gridcolor: '#f1f5f9' },
            legend: { orientation: 'h', y: -0.22 }
          }}
        />
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Clock,
  Activity,
  Flame,
  AlertTriangle,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { PlotlyChart } from '../common/PlotlyChart';
import type { ElectricityRecord } from '../../types';
import { detectAnomalies } from '../../utils/analyticsEngine';

interface ConsumptionAnalysisProps {
  records: ElectricityRecord[];
}

export const ConsumptionAnalysis: React.FC<ConsumptionAnalysisProps> = ({ records }) => {
  const [highlightPeaks, setHighlightPeaks] = useState(true);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<number>>(new Set());

  const rawAnomalies = detectAnomalies(records);
  const activeAnomalies = rawAnomalies.filter((_, i) => !dismissedAnomalies.has(i));

  // 1. Hourly Load Profile (0-23 average and max)
  const hourlyStats: { sum: number; count: number; max: number }[] = Array(24)
    .fill(0)
    .map(() => ({ sum: 0, count: 0, max: 0 }));

  records.forEach((r) => {
    const h = new Date(r.timestamp).getHours();
    hourlyStats[h].sum += r.energy_kwh;
    hourlyStats[h].count++;
    if (r.energy_kwh > hourlyStats[h].max) hourlyStats[h].max = r.energy_kwh;
  });

  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  const avgHourlyKwh = hourlyStats.map((s) => (s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : 0));
  const maxHourlyKwh = hourlyStats.map((s) => Math.round(s.max * 10) / 10);

  // 2. Day of Week vs Hour Heatmap (7 days x 24 hours)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmapZ: number[][] = Array(7)
    .fill(0)
    .map(() => Array(24).fill(0));
  const heatmapCounts: number[][] = Array(7)
    .fill(0)
    .map(() => Array(24).fill(0));

  records.forEach((r) => {
    const d = new Date(r.timestamp);
    const day = d.getDay();
    const h = d.getHours();
    heatmapZ[day][h] += r.energy_kwh;
    heatmapCounts[day][h]++;
  });

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmapZ[d][h] =
        heatmapCounts[d][h] > 0 ? Math.round((heatmapZ[d][h] / heatmapCounts[d][h]) * 10) / 10 : 0;
    }
  }

  // 3. Weekday vs Weekend Comparison
  const weekdayHourly: { sum: number; count: number }[] = Array(24).fill(0).map(() => ({ sum: 0, count: 0 }));
  const weekendHourly: { sum: number; count: number }[] = Array(24).fill(0).map(() => ({ sum: 0, count: 0 }));

  records.forEach((r) => {
    const d = new Date(r.timestamp);
    const day = d.getDay();
    const h = d.getHours();
    const isWknd = day === 0 || day === 6;
    if (isWknd) {
      weekendHourly[h].sum += r.energy_kwh;
      weekendHourly[h].count++;
    } else {
      weekdayHourly[h].sum += r.energy_kwh;
      weekdayHourly[h].count++;
    }
  });

  const weekdayAvg = weekdayHourly.map((s) => (s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : 0));
  const weekendAvg = weekendHourly.map((s) => (s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : 0));

  // Top 5 Peak Demand intervals
  const sortedPeak = [...records]
    .sort((a, b) => b.energy_kwh - a.energy_kwh)
    .slice(0, 5);

  const toggleDismiss = (idx: number) => {
    setDismissedAnomalies((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Consumption &amp; Peak Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify daily consumption curves, peak demand intervals, and unusual spikes
          </p>
        </div>

        {/* Peak Window Highlight Toggle */}
        <button
          onClick={() => setHighlightPeaks(!highlightPeaks)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
            highlightPeaks
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter className="h-3.5 w-3.5 text-rose-500" />
          <span>{highlightPeaks ? 'Peak Hours Emphasized' : 'Standard Curve'}</span>
        </button>
      </div>

      {/* Row 1: Hourly Load Curve & Weekday vs Weekend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Hourly 24h Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                24-Hour Hourly Consumption Curve
              </h3>
              <p className="text-[11px] text-slate-500">
                Average consumption profile with maximum peak demand recorded at each hour
              </p>
            </div>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: hours,
                y: maxHourlyKwh,
                type: 'scatter',
                mode: 'lines',
                name: 'Maximum Recorded',
                line: { color: '#f43f5e', dash: 'dot', width: 1.8 }
              },
              {
                x: hours,
                y: avgHourlyKwh,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Average Demand (kWh)',
                line: { color: '#10b981', width: 2.2 },
                marker: { size: 4, color: '#10b981' },
                fill: 'tozeroy',
                fillcolor: 'rgba(16, 185, 129, 0.08)'
              }
            ]}
            layout={{
              yaxis: { title: 'Energy (kWh)', gridcolor: '#f1f5f9' },
              xaxis: { gridcolor: '#f1f5f9' },
              legend: { orientation: 'h', y: -0.22 }
            }}
          />
        </div>

        {/* Weekday vs Weekend Comparison */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Weekday vs Weekend Comparison
              </h3>
              <p className="text-[11px] text-slate-500">
                Compare working campus operations against weekend baselines
              </p>
            </div>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: hours,
                y: weekdayAvg,
                type: 'scatter',
                mode: 'lines',
                name: 'Weekday (Mon - Fri)',
                line: { color: '#3b82f6', width: 2.2 }
              },
              {
                x: hours,
                y: weekendAvg,
                type: 'scatter',
                mode: 'lines',
                name: 'Weekend (Sat - Sun)',
                line: { color: '#f59e0b', width: 2.2, dash: 'dash' }
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

      {/* Row 2: Weekly Heatmap & Top Peak Demands */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Heatmap (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Weekly Usage Heatmap (Day of Week vs Hour)
              </h3>
              <p className="text-[11px] text-slate-500">
                Darker red intervals indicate high energy draw
              </p>
            </div>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                z: heatmapZ,
                x: hours,
                y: dayNames,
                type: 'heatmap',
                colorscale: [
                  [0, '#f8fafc'],
                  [0.25, '#dbeafe'],
                  [0.5, '#60a5fa'],
                  [0.75, '#fbbf24'],
                  [1, '#ef4444']
                ],
                colorbar: { title: 'kWh', len: 0.8 }
              }
            ]}
            layout={{
              margin: { l: 45, r: 20, t: 15, b: 35 }
            }}
          />
        </div>

        {/* Highest Demand Spikes (1 col) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Top Peak Demand Spikes
              </h3>
              <p className="text-[11px] text-slate-500">
                Intervals with highest power draw
              </p>
            </div>
            <Flame className="h-4 w-4 text-rose-500" />
          </div>

          <div className="space-y-2 pt-1">
            {sortedPeak.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-800">
                    {new Date(p.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Bldg {p.building_id} • Meter {p.meter_id}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="font-bold text-rose-600 text-sm">
                    {p.energy_kwh} kWh
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: High-Consumption Alerts */}
      {activeAnomalies.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Unusual Demand Spikes &amp; Alerts ({activeAnomalies.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Click "Acknowledge" once reviewed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {rawAnomalies.slice(0, 6).map((anom, idx) => {
              const isDismissed = dismissedAnomalies.has(idx);
              if (isDismissed) return null;
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/80 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Bldg {anom.buildingId} ({anom.meterId})
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(anom.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{anom.reason}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-rose-600 font-mono font-bold">
                      +{anom.deviationPercent}% spike
                    </span>
                    <button
                      onClick={() => toggleDismiss(idx)}
                      className="px-2 py-0.5 rounded text-[10px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-medium"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  CloudSun,
  Users,
  Cpu,
  Thermometer,
  Filter,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { PlotlyChart } from '../common/PlotlyChart';
import type {
  ElectricityRecord,
  WeatherRecord,
  OccupancyRecord,
  EquipmentRecord
} from '../../types';

interface WeatherOccupancyEquipmentProps {
  records: ElectricityRecord[];
  weather: WeatherRecord[];
  occupancy: OccupancyRecord[];
  equipment: EquipmentRecord[];
  featureImportance: { feature: string; importance: number }[];
  onOpenUploadModal: () => void;
}

export const WeatherOccupancyEquipment: React.FC<WeatherOccupancyEquipmentProps> = ({
  records,
  weather,
  occupancy,
  equipment,
  onOpenUploadModal
}) => {
  const [equipmentFilter, setEquipmentFilter] = useState<'ALL' | 'FLEXIBLE' | 'FIXED'>('ALL');

  // Lookup maps
  const weatherMap = new Map<string, WeatherRecord>();
  weather.forEach((w) => weatherMap.set(w.timestamp, w));

  const occMap = new Map<string, OccupancyRecord>();
  occupancy.forEach((o) => occMap.set(`${o.timestamp}_${o.building_id}`, o));

  // Temperature vs Consumption Points
  const tempX: number[] = [];
  const tempY: number[] = [];
  records.forEach((r) => {
    const w = weatherMap.get(r.timestamp);
    if (w) {
      tempX.push(w.temperature_c);
      tempY.push(r.energy_kwh);
    }
  });

  // Occupancy vs Consumption Points
  const occX: number[] = [];
  const occY: number[] = [];
  records.forEach((r) => {
    const o = occMap.get(`${r.timestamp}_${r.building_id}`);
    if (o && o.occupancy_count > 0) {
      occX.push(o.occupancy_count);
      occY.push(r.energy_kwh);
    }
  });

  // Filtered Equipment list
  const filteredEquipment = equipment.filter((eq) => {
    if (equipmentFilter === 'FLEXIBLE') return eq.flexible_load;
    if (equipmentFilter === 'FIXED') return !eq.flexible_load;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Weather &amp; Facilities
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Key physical drivers impacting electricity consumption: outside temperature, campus headcount, and equipment inventory
          </p>
        </div>

        <button
          onClick={onOpenUploadModal}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition"
        >
          Upload Custom Datasets
        </button>
      </div>

      {/* Row 1: Temperature & Occupancy Impact Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Temperature Impact */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Weather Impact: Temperature vs Energy
              </h3>
              <p className="text-[11px] text-slate-500">
                Chiller cooling demand escalates as outside temperature exceeds 28°C
              </p>
            </div>
            <Thermometer className="h-4 w-4 text-amber-500" />
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: tempX,
                y: tempY,
                type: 'scatter',
                mode: 'markers',
                marker: {
                  size: 5,
                  color: tempX,
                  colorscale: 'Portland',
                  showscale: true,
                  colorbar: { title: '°C', len: 0.8 }
                }
              }
            ]}
            layout={{
              xaxis: { title: 'Outside Temperature (°C)', gridcolor: '#f1f5f9' },
              yaxis: { title: 'Energy (kWh)', gridcolor: '#f1f5f9' }
            }}
          />
        </div>

        {/* Occupancy Impact */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Occupancy Impact: People vs Energy
              </h3>
              <p className="text-[11px] text-slate-500">
                Relationship between campus headcount and base plug/lighting load
              </p>
            </div>
            <Users className="h-4 w-4 text-sky-500" />
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: occX,
                y: occY,
                type: 'scatter',
                mode: 'markers',
                marker: { size: 5, color: '#0ea5e9', opacity: 0.7 }
              }
            ]}
            layout={{
              xaxis: { title: 'Occupant Headcount', gridcolor: '#f1f5f9' },
              yaxis: { title: 'Energy (kWh)', gridcolor: '#f1f5f9' }
            }}
          />
        </div>
      </div>

      {/* Row 2: Equipment Register */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-600" />
              Campus Equipment Register
            </h3>
            <p className="text-[11px] text-slate-500">
              Operational specifications, power ratings, and constraints for registered facilities
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setEquipmentFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                equipmentFilter === 'ALL'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Assets ({equipment.length})
            </button>
            <button
              onClick={() => setEquipmentFilter('FLEXIBLE')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                equipmentFilter === 'FLEXIBLE'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flexible ({equipment.filter((e) => e.flexible_load).length})
            </button>
            <button
              onClick={() => setEquipmentFilter('FIXED')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                equipmentFilter === 'FIXED'
                  ? 'bg-white text-slate-800 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fixed / Critical ({equipment.filter((e) => !e.flexible_load).length})
            </button>
          </div>
        </div>

        {/* Equipment Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider bg-slate-50">
                <th className="py-2.5 px-3">Equipment</th>
                <th className="py-2.5 px-2">Building</th>
                <th className="py-2.5 px-2">Power</th>
                <th className="py-2.5 px-2">Runtime</th>
                <th className="py-2.5 px-2 text-center">Type</th>
                <th className="py-2.5 px-3">Operating Window / Constraint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEquipment.map((eq) => (
                <tr key={eq.equipment_id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800">{eq.equipment_type}</div>
                    <span className="text-[10px] font-mono text-slate-500">{eq.equipment_id}</span>
                  </td>
                  <td className="py-3 px-2 font-mono text-slate-700">{eq.building_id}</td>
                  <td className="py-3 px-2 font-mono text-slate-900 font-bold">{eq.rated_power_kw} kW</td>
                  <td className="py-3 px-2 font-mono text-slate-700">
                    {Math.round(((eq.required_runtime_minutes || 240) / 60) * 10) / 10} hrs
                  </td>
                  <td className="py-3 px-2 text-center">
                    {eq.flexible_load ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Flexible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                        <Lock className="h-3 w-3" />
                        Critical 24/7
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[11px] text-slate-600 max-w-sm">
                    {eq.operating_constraints || 'Continuous facility operation'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

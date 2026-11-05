import React, { useState } from 'react';
import {
  Receipt,
  IndianRupee,
  Clock,
  Settings2,
  Sliders,
  RotateCcw,
  Check,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { PlotlyChart } from '../common/PlotlyChart';
import type { ElectricityRecord, TariffConfig } from '../../types';
import { calculateElectricityCost, getTariffPeriod } from '../../utils/analyticsEngine';
import { useAuth } from '../../context/AuthContext';

interface TariffCostAnalysisProps {
  records: ElectricityRecord[];
  tariff: TariffConfig;
  onOpenTariffModal: () => void;
}

export const TariffCostAnalysis: React.FC<TariffCostAnalysisProps> = ({
  records,
  tariff,
  onOpenTariffModal
}) => {
  const { saveCustomTariff } = useAuth();

  // Slide-adjustable Tariff Simulator State
  const [simulatedPeak, setSimulatedPeak] = useState<number>(tariff.peakRate);
  const [simulatedNormal, setSimulatedNormal] = useState<number>(tariff.normalRate);
  const [simulatedOffPeak, setSimulatedOffPeak] = useState<number>(tariff.offPeakRate);

  // Baseline Cost with actual active tariff
  const baselineCost = calculateElectricityCost(records, tariff);

  // Simulated Cost with user slider adjustments
  const simulatedTariff: TariffConfig = {
    ...tariff,
    peakRate: simulatedPeak,
    normalRate: simulatedNormal,
    offPeakRate: simulatedOffPeak
  };

  const simulatedCost = calculateElectricityCost(records, simulatedTariff);

  // Cost variance between baseline and simulation
  const billDifference = simulatedCost.totalCost - baselineCost.totalCost;
  const isChanged =
    simulatedPeak !== tariff.peakRate ||
    simulatedNormal !== tariff.normalRate ||
    simulatedOffPeak !== tariff.offPeakRate;

  // 1. Hourly Tariff Schedule (0-23 hours) using simulated rates
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourPeriods = hours.map((h) => getTariffPeriod(h, simulatedTariff));

  // 2. Cost and Consumption breakdown by period
  const periodKwh = [simulatedCost.peakKwh, simulatedCost.normalKwh, simulatedCost.offPeakKwh];
  const periodCost = [simulatedCost.peakCost, simulatedCost.normalCost, simulatedCost.offPeakCost];
  const periodLabels = ['Peak Hours', 'Normal Hours', 'Off-Peak Night'];

  const resetSimulator = () => {
    setSimulatedPeak(tariff.peakRate);
    setSimulatedNormal(tariff.normalRate);
    setSimulatedOffPeak(tariff.offPeakRate);
  };

  const applySimulatedRates = async () => {
    await saveCustomTariff(simulatedTariff);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Tariff &amp; Bill Breakdown
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent breakdown of electricity expenses and slide-adjustable bill simulator
          </p>
        </div>

        <button
          onClick={onOpenTariffModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition"
        >
          <Settings2 className="h-3.5 w-3.5 text-indigo-600" />
          <span>Full Tariff Settings</span>
        </button>
      </div>

      {/* Slide-Adjustable Tariff & Bill Simulator Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Slide-Adjustable Tariff &amp; Bill Simulator
              </h3>
              <p className="text-[11px] text-slate-500">
                Move sliders below to immediately simulate the impact of new electricity rates on your campus bill
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {isChanged && (
              <>
                <button
                  onClick={resetSimulator}
                  className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium transition"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Rates</span>
                </button>
                <button
                  onClick={applySimulatedRates}
                  className="flex items-center gap-1 text-[11px] text-white px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-semibold shadow-2xs transition"
                >
                  <Check className="h-3 w-3 stroke-[2.5]" />
                  <span>Set as Active Tariff</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 3 Interactive Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Peak Rate Slider */}
          <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-800">Peak Rate (09-12 &amp; 18-22)</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-rose-200">
                ₹{simulatedPeak.toFixed(1)}/kWh
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={24}
              step={0.5}
              value={simulatedPeak}
              onChange={(e) => setSimulatedPeak(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>₹8/kWh</span>
              <span>₹16/kWh</span>
              <span>₹24/kWh</span>
            </div>
          </div>

          {/* Normal Rate Slider */}
          <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-800">Normal Daytime Rate</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-sky-200">
                ₹{simulatedNormal.toFixed(1)}/kWh
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={16}
              step={0.5}
              value={simulatedNormal}
              onChange={(e) => setSimulatedNormal(Number(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>₹5/kWh</span>
              <span>₹10/kWh</span>
              <span>₹16/kWh</span>
            </div>
          </div>

          {/* Off-Peak Rate Slider */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-800">Off-Peak Night Rate (22-06)</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-200">
                ₹{simulatedOffPeak.toFixed(1)}/kWh
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={12}
              step={0.5}
              value={simulatedOffPeak}
              onChange={(e) => setSimulatedOffPeak(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>₹3/kWh</span>
              <span>₹7/kWh</span>
              <span>₹12/kWh</span>
            </div>
          </div>
        </div>

        {/* Simulator Impact Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Baseline Active Bill:</span>
            <span className="font-mono font-bold text-slate-800 text-sm">
              ₹{baselineCost.totalCost.toLocaleString()}
            </span>
          </div>

          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 flex items-center justify-between">
            <span className="text-indigo-800 font-medium">Simulated Bill:</span>
            <span className="font-mono font-bold text-indigo-700 text-sm">
              ₹{simulatedCost.totalCost.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Projected Bill Variance:</span>
            <span
              className={`font-mono font-bold text-sm ${
                billDifference > 0
                  ? 'text-rose-600'
                  : billDifference < 0
                  ? 'text-emerald-600'
                  : 'text-slate-700'
              }`}
            >
              {billDifference > 0 ? `+₹${billDifference.toLocaleString()}` : billDifference < 0 ? `-₹${Math.abs(billDifference).toLocaleString()}` : '₹0 (No Change)'}
            </span>
          </div>
        </div>

        {/* 24-Hour Visual Schedule Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-medium">24-Hour Rate Schedule Timeline</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-rose-700">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span> Peak: ₹{simulatedPeak}/kWh
              </span>
              <span className="flex items-center gap-1 text-sky-700">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span> Normal: ₹{simulatedNormal}/kWh
              </span>
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Off-Peak: ₹{simulatedOffPeak}/kWh
              </span>
            </div>
          </div>

          <div className="grid grid-cols-24 gap-1 h-9 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {hourPeriods.map((hp, h) => {
              let bg = 'bg-sky-100 border-sky-300 text-sky-800';
              if (hp.period === 'peak') bg = 'bg-rose-100 border-rose-300 text-rose-800';
              if (hp.period === 'off_peak') bg = 'bg-emerald-100 border-emerald-300 text-emerald-800';

              return (
                <div
                  key={h}
                  className={`rounded flex items-center justify-center text-[10px] font-mono font-bold border ${bg}`}
                  title={`${h}:00 - ${h + 1}:00: ${hp.label}`}
                >
                  {h}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 px-1">
            <span>00:00 Midnight</span>
            <span>06:00 Morning</span>
            <span>12:00 Noon</span>
            <span>18:00 Evening</span>
            <span>23:00 Night</span>
          </div>
        </div>
      </div>

      {/* Row 1: Bill by Tariff Period & Current vs Simulated Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bill Breakdown by Tariff Period */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Electricity Bill by Tariff Period (₹)
            </h3>
            <p className="text-[11px] text-slate-500">
              Expenditure breakdown under current simulated rates
            </p>
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: periodLabels,
                y: periodCost,
                type: 'bar',
                marker: {
                  color: ['#f43f5e', '#0ea5e9', '#10b981']
                },
                text: periodCost.map((c) => `₹${c.toLocaleString()}`),
                textposition: 'auto'
              }
            ]}
            layout={{
              yaxis: { title: 'Spend (₹)', gridcolor: '#f1f5f9' },
              xaxis: { gridcolor: '#f1f5f9' }
            }}
          />
        </div>

        {/* Current Plan vs Simulated Plan Bill Comparison */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Current Plan vs Simulated Plan Total Bill
            </h3>
            <p className="text-[11px] text-slate-500">
              Side-by-side total bill comparison based on slider adjustments
            </p>
          </div>

          <PlotlyChart
            className="w-full h-64"
            data={[
              {
                x: ['Current Plan', 'Simulated Plan'],
                y: [baselineCost.totalCost, simulatedCost.totalCost],
                type: 'bar',
                marker: {
                  color: ['#64748b', '#4f46e5']
                },
                text: [`₹${baselineCost.totalCost.toLocaleString()}`, `₹${simulatedCost.totalCost.toLocaleString()}`],
                textposition: 'auto'
              }
            ]}
            layout={{
              yaxis: { title: 'Total Bill (₹)', gridcolor: '#f1f5f9' },
              xaxis: { gridcolor: '#f1f5f9' }
            }}
          />
        </div>
      </div>

      {/* Row 2: Tariff Structure Parameters Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Tariff Schedule Parameters
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Peak Window</span>
            <span className="font-mono font-bold text-slate-800 text-xs">
              {tariff.peakHours}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Off-Peak Window</span>
            <span className="font-mono font-bold text-slate-800 text-xs">
              {tariff.offPeakHours}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Fixed Monthly Charge</span>
            <span className="font-mono font-bold text-slate-800 text-xs">
              ₹{tariff.fixedMonthlyCharge?.toLocaleString() || '0'}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Demand Charge / Tax</span>
            <span className="font-mono font-bold text-slate-800 text-xs">
              ₹{tariff.demandChargePerKw || 0}/kW • {tariff.taxPercentage || 0}% Tax
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

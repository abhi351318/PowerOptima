import React, { useState } from 'react';
import { X, Check, RotateCcw, AlertTriangle, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { TariffConfig } from '../../types';
import { DEFAULT_TARIFF } from '../../utils/sampleData';

interface TariffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TariffModal: React.FC<TariffModalProps> = ({ isOpen, onClose }) => {
  const { activeTariff, setActiveTariff, saveCustomTariff, user } = useAuth();

  const [form, setForm] = useState<TariffConfig>({ ...activeTariff });
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TariffConfig = {
      ...form,
      isCustom: true
    };
    await saveCustomTariff(updated);
    setSuccessMsg('Tariff configuration applied successfully!');
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_TARIFF, userId: user ? user.uid : 'guest' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Electricity Tariff Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Configure commercial rates, time windows, fixed charges, and taxes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Utility Notice: Rates configured here are used directly to calculate electricity bills.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs text-slate-700">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tariff Plan Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Time-of-Use Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-rose-50/60 border border-rose-200 p-3.5 rounded-xl space-y-1.5">
              <span className="block font-semibold text-rose-800">Peak Rate (₹/kWh)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.peakRate}
                onChange={(e) => setForm({ ...form, peakRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-rose-300 rounded-lg px-3 py-1.5 text-slate-800 font-mono font-bold text-sm"
                required
              />
              <span className="text-[10px] text-slate-500 block">Peak demand hours</span>
            </div>

            <div className="bg-sky-50/60 border border-sky-200 p-3.5 rounded-xl space-y-1.5">
              <span className="block font-semibold text-sky-800">Normal Rate (₹/kWh)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.normalRate}
                onChange={(e) => setForm({ ...form, normalRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-sky-300 rounded-lg px-3 py-1.5 text-slate-800 font-mono font-bold text-sm"
                required
              />
              <span className="text-[10px] text-slate-500 block">Daytime hours</span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl space-y-1.5">
              <span className="block font-semibold text-emerald-800">Off-Peak Rate (₹/kWh)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.offPeakRate}
                onChange={(e) => setForm({ ...form, offPeakRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-slate-800 font-mono font-bold text-sm"
                required
              />
              <span className="text-[10px] text-slate-500 block">Night-time hours</span>
            </div>
          </div>

          {/* Time Windows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Peak Time Blocks (HH:MM-HH:MM)
              </label>
              <input
                type="text"
                value={form.peakHours}
                onChange={(e) => setForm({ ...form, peakHours: e.target.value })}
                placeholder="09:00-12:00, 18:00-22:00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Comma-separated 24-hr ranges.
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Off-Peak Time Blocks (HH:MM-HH:MM)
              </label>
              <input
                type="text"
                value={form.offPeakHours}
                onChange={(e) => setForm({ ...form, offPeakHours: e.target.value })}
                placeholder="22:00-06:00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Supports midnight cross intervals.
              </span>
            </div>
          </div>

          {/* Charges and Taxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Fixed Charges (₹/Month)</label>
              <input
                type="number"
                min="0"
                value={form.fixedMonthlyCharge}
                onChange={(e) => setForm({ ...form, fixedMonthlyCharge: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Demand Charge (₹/kW Peak)</label>
              <input
                type="number"
                min="0"
                value={form.demandChargePerKw}
                onChange={(e) => setForm({ ...form, demandChargePerKw: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Electricity Tax / Duty (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.taxPercentage}
                onChange={(e) => setForm({ ...form, taxPercentage: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
              />
            </div>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Check className="h-4 w-4" />
                <span>Apply Tariff</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

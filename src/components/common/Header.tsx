import React, { useState } from 'react';
import {
  Zap,
  Building2,
  Gauge,
  Calendar,
  Download,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Save,
  History,
  Settings2,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { downloadTemplate, exportResultsToCsv } from '../../utils/csvParser';
import { SAMPLE_BUILDINGS } from '../../utils/sampleData';

interface HeaderProps {
  selectedBuilding: string;
  setSelectedBuilding: (b: string) => void;
  selectedMeter: string;
  setSelectedMeter: (m: string) => void;
  dateRangeDays: number;
  setDateRangeDays: (d: number) => void;
  onOpenTariffModal: () => void;
  onOpenHistoryDrawer: () => void;
  onOpenUploadModal: () => void;
  onSaveCurrentSnapshot: () => void;
  processedRecordsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  selectedBuilding,
  setSelectedBuilding,
  selectedMeter,
  setSelectedMeter,
  dateRangeDays,
  setDateRangeDays,
  onOpenTariffModal,
  onOpenHistoryDrawer,
  onOpenUploadModal,
  onSaveCurrentSnapshot,
  processedRecordsCount
}) => {
  const { user, login, logout, activeTariff, historyItems } = useAuth();
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    onSaveCurrentSnapshot();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
              <Zap className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  PowerOptima
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  Campus Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Commercial Electricity Consumption &amp; Cost Dashboard
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="hidden md:flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
            {/* Building Filter */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              <select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                className="bg-transparent text-slate-700 outline-none cursor-pointer pr-1 font-medium"
              >
                <option value="ALL">All Buildings</option>
                {SAMPLE_BUILDINGS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Meter Filter */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <Gauge className="h-3.5 w-3.5 text-sky-600" />
              <select
                value={selectedMeter}
                onChange={(e) => setSelectedMeter(e.target.value)}
                className="bg-transparent text-slate-700 outline-none cursor-pointer pr-1 font-medium"
              >
                <option value="ALL">All Meters</option>
                <option value="M001">M001 (Incomer / HVAC)</option>
                <option value="M002">M002 (Plug Loads &amp; Labs)</option>
                <option value="M003">M003 (Pumps &amp; Heavy Aux)</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              <select
                value={dateRangeDays}
                onChange={(e) => setDateRangeDays(Number(e.target.value))}
                className="bg-transparent text-slate-700 outline-none cursor-pointer pr-1 font-medium"
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={28}>Full 28 Days</option>
              </select>
            </div>
          </div>

          {/* Action Buttons & Google User */}
          <div className="flex items-center gap-2">
            {/* Download Templates Menu */}
            <div className="relative">
              <button
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition"
                title="Download CSV / Excel Templates"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Templates</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showTemplateMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-lg py-2 z-50 text-xs"
                  onMouseLeave={() => setShowTemplateMenu(false)}
                >
                  <div className="px-3 py-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    Input Data Templates
                  </div>
                  <button
                    onClick={() => { downloadTemplate('electricity', 'csv'); setShowTemplateMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                  >
                    <span>Electricity Meter (.csv)</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Mandatory</span>
                  </button>
                  <button
                    onClick={() => { downloadTemplate('electricity', 'xlsx'); setShowTemplateMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                  >
                    <span>Electricity Meter (.xlsx)</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Mandatory</span>
                  </button>
                  <div className="my-1 border-t border-slate-100"></div>
                  <button
                    onClick={() => { downloadTemplate('weather', 'csv'); setShowTemplateMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                  >
                    Weather Observation (.csv)
                  </button>
                  <button
                    onClick={() => { downloadTemplate('occupancy', 'csv'); setShowTemplateMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                  >
                    Occupancy Headcount (.csv)
                  </button>
                  <button
                    onClick={() => { downloadTemplate('equipment', 'csv'); setShowTemplateMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                  >
                    Equipment Constraints (.csv)
                  </button>
                </div>
              )}
            </div>

            {/* Tariff Configuration Button */}
            <button
              onClick={onOpenTariffModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium transition"
              title="View or Configure Electricity Tariffs"
            >
              <Settings2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden lg:inline">Tariff: ₹{activeTariff.peakRate}/₹{activeTariff.offPeakRate}</span>
            </button>

            {/* Save Run Snapshot */}
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
              title="Save current analysis to account history"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Save Run</span>
                </>
              )}
            </button>

            {/* History Drawer Trigger */}
            <button
              onClick={onOpenHistoryDrawer}
              className="relative p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition"
              title="View Saved User History"
            >
              <History className="h-4 w-4" />
              {historyItems.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {historyItems.length}
                </span>
              )}
            </button>

            {/* Google Authentication */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-indigo-400 transition"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="h-8 w-8 rounded-full border border-indigo-200 shadow-2xs"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs">
                      {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </button>

                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-xl py-3 px-4 z-50 text-xs"
                    onMouseLeave={() => setShowUserMenu(false)}
                  >
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      {user.photoURL && (
                        <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" />
                      )}
                      <div className="overflow-hidden">
                        <div className="font-semibold text-slate-800 truncate">
                          {user.displayName || 'Energy Manager'}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate">{user.email}</div>
                      </div>
                    </div>

                    <div className="py-2 space-y-1">
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>Saved Cloud Runs:</span>
                        <span className="font-mono text-indigo-600 font-bold">{historyItems.length}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>Current Tariff:</span>
                        <span className="text-slate-700 truncate max-w-[130px] font-medium">{activeTariff.name}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      <button
                        onClick={() => { onOpenHistoryDrawer(); setShowUserMenu(false); }}
                        className="w-full text-left py-1.5 px-2 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center gap-2"
                      >
                        <History className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Manage Saved Runs</span>
                      </button>
                      <button
                        onClick={() => { logout(); setShowUserMenu(false); }}
                        className="w-full text-left py-1.5 px-2 hover:bg-rose-50 text-rose-600 rounded-lg flex items-center gap-2 transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                title="Sign in with Google to save history"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Google Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

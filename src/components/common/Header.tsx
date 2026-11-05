import React, { useState } from 'react';
import {
  Zap,
  Building2,
  Gauge,
  Calendar,
  Download,
  LogIn,
  LogOut,
  Save,
  History,
  Settings2,
  CheckCircle2,
  ChevronDown,
  AlertCircle,
  UserCheck,
  Loader2,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { downloadTemplate } from '../../utils/csvParser';

interface HeaderProps {
  selectedBuilding: string;
  setSelectedBuilding: (b: string) => void;
  selectedMeter: string;
  setSelectedMeter: (m: string) => void;
  availableBuildings?: string[];
  availableMeters?: string[];
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
  availableBuildings = ['B001', 'B002', 'B003'],
  availableMeters = ['M001', 'M002', 'M003'],
  dateRangeDays,
  setDateRangeDays,
  onOpenTariffModal,
  onOpenHistoryDrawer,
  onSaveCurrentSnapshot
}) => {
  const {
    user,
    isGuest,
    login,
    loginAsGuest,
    logout,
    authError,
    clearAuthError,
    activeTariff,
    historyItems
  } = useAuth();

  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSave = () => {
    onSaveCurrentSnapshot();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      await login();
    } catch {
      // Handled via authError in context
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <>
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
              {/* Dynamic Building Filter */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="bg-transparent text-slate-700 outline-none cursor-pointer pr-1 font-medium max-w-[140px] truncate"
                  title="Filter by Building"
                >
                  <option value="ALL">All Buildings ({availableBuildings.length})</option>
                  {availableBuildings.map((bId) => (
                    <option key={bId} value={bId}>
                      {bId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Meter Filter */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <Gauge className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                <select
                  value={selectedMeter}
                  onChange={(e) => setSelectedMeter(e.target.value)}
                  className="bg-transparent text-slate-700 outline-none cursor-pointer pr-1 font-medium max-w-[130px] truncate"
                  title="Filter by Meter"
                >
                  <option value="ALL">All Meters ({availableMeters.length})</option>
                  {availableMeters.map((mId) => (
                    <option key={mId} value={mId}>
                      {mId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <select
                  value={dateRangeDays}
                  onChange={(e) => setDateRangeDays(Number(e.target.value))}
                  className="bg-transparent text-slate-700 outline-none cursor-pointer pr-1 font-medium"
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={14}>Last 14 Days</option>
                  <option value={28}>Last 28 Days</option>
                  <option value={90}>Last 90 Days</option>
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
                      <span className="text-[10px] text-indigo-600 font-semibold">Standard</span>
                    </button>
                    <button
                      onClick={() => { downloadTemplate('electricity', 'xlsx'); setShowTemplateMenu(false); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                    >
                      <span>Electricity Meter (.xlsx)</span>
                      <span className="text-[10px] text-indigo-600 font-semibold">Excel</span>
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
                title="Save current analysis run to history"
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
                title="View Saved Runs History"
              >
                <History className="h-4 w-4" />
                {historyItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                    {historyItems.length}
                  </span>
                )}
              </button>

              {/* User Authentication Status */}
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
                          <span>Saved Analysis Runs:</span>
                          <span className="font-mono text-indigo-600 font-bold">{historyItems.length}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span>Active Tariff:</span>
                          <span className="text-slate-700 truncate max-w-[130px] font-medium">{activeTariff.name}</span>
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 pt-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Google Account Synced</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        <button
                          onClick={() => { onOpenHistoryDrawer(); setShowUserMenu(false); }}
                          className="w-full text-left py-1.5 px-2 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center gap-2"
                        >
                          <History className="h-3.5 w-3.5 text-indigo-600" />
                          <span>View Saved Runs</span>
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
              ) : isGuest ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                    <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                    <span>Demo Mode</span>
                  </div>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isSigningIn}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                    title="Connect Google Account"
                  >
                    {isSigningIn ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <LogIn className="h-3 w-3" />
                    )}
                    <span>Link Google</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isSigningIn}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                    title="Sign in with your Google Account"
                  >
                    {isSigningIn ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Google Login</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Auth Error / Vercel Guidance Modal */}
      {authError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Google Sign-In Notice
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authentication status and deployment guidance
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-2 leading-relaxed">
              <p className="font-medium text-slate-800">{authError}</p>
              {authError.includes('authorized in Firebase') && (
                <div className="text-[11px] text-slate-600 space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="font-semibold text-indigo-700">How to authorize Vercel URL in 1 minute:</div>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>Go to <span className="font-mono text-slate-800">console.firebase.google.com</span></li>
                    <li>Open Authentication &rarr; Settings &rarr; Authorized domains</li>
                    <li>Click &ldquo;Add domain&rdquo; and enter your Vercel host (<span className="font-mono text-indigo-600">{window.location.hostname}</span>)</li>
                  </ol>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  loginAsGuest();
                  clearAuthError();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Continue in Guest Mode
              </button>
              <button
                onClick={clearAuthError}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import React from 'react';
import { X, Trash2, Calendar, Zap, ArrowRight, ShieldAlert, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { UserHistoryItem } from '../../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSnapshot?: (item: UserHistoryItem) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onLoadSnapshot
}) => {
  const { user, login, historyItems, deleteHistory } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-600" />
              Saved Analysis Runs
            </h2>
            <p className="text-[11px] text-slate-500">
              Cloud-persisted analysis runs and forecast checkpoints
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!user && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-blue-800">
                <ShieldAlert className="h-4 w-4 text-blue-600" />
                <span>Guest Mode Active</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Sign in with your Google Account to persist your campus analysis runs and custom tariff rates securely to cloud storage.
              </p>
              <button
                onClick={login}
                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 shadow-2xs transition"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In with Google</span>
              </button>
            </div>
          )}

          {historyItems.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Calendar className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-semibold text-slate-800">No Saved Runs Yet</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Click "Save Run" in the top header to save your current campus electricity data, billing metrics, and forecast checkpoint.
              </p>
            </div>
          ) : (
            historyItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition space-y-2 text-xs text-slate-700 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">{item.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteHistory(item.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete saved run"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Total Electricity:</span>
                    <span className="text-slate-900 font-bold">{item.totalKwh.toLocaleString()} kWh</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Total Bill:</span>
                    <span className="text-amber-700 font-bold">₹{item.totalCost.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Forecast Accuracy:</span>
                    <span className="text-indigo-600 font-bold">{item.forecastReliabilityScore}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Average Error:</span>
                    <span className="text-slate-700 font-bold">±{item.mae} kWh</span>
                  </div>
                </div>

                {onLoadSnapshot && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        onLoadSnapshot(item);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold"
                    >
                      <span>Load into Dashboard</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 text-center">
          Persisted securely to cloud Firestore
        </div>
      </div>
    </div>
  );
};

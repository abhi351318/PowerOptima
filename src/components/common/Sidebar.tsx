import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Receipt,
  TrendingUp,
  CloudSun,
  UploadCloud,
  FileCheck2,
  Database
} from 'lucide-react';

export type DashboardPage =
  | 'overview'
  | 'consumption'
  | 'tariff'
  | 'forecasting'
  | 'weather-equipment'
  | 'data-ingestion';

interface SidebarProps {
  currentPage: DashboardPage;
  setCurrentPage: (page: DashboardPage) => void;
  datasetStats: {
    totalRecords: number;
    buildingsCount: number;
    metersCount: number;
    isSynthetic: boolean;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  setCurrentPage,
  datasetStats
}) => {
  const navItems: { id: DashboardPage; label: string; icon: React.ComponentType<{ className?: string }>; pageNum?: string }[] = [
    { id: 'overview', label: 'Campus Overview', icon: LayoutDashboard, pageNum: '1' },
    { id: 'consumption', label: 'Consumption & Peaks', icon: Activity, pageNum: '2' },
    { id: 'tariff', label: 'Tariff & Bill Simulator', icon: Receipt, pageNum: '3' },
    { id: 'forecasting', label: 'Demand Forecast', icon: TrendingUp, pageNum: '4' },
    { id: 'weather-equipment', label: 'Weather & Facilities', icon: CloudSun, pageNum: '5' },
    { id: 'data-ingestion', label: 'Upload & Validate Data', icon: UploadCloud }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Navigation Links */}
      <div className="p-3.5 space-y-1">
        <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          Analytics Pages
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-left">{item.label}</span>
              </div>
              {item.pageNum && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isActive ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.pageNum}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dataset & Campus Status Badge */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <div className="rounded-xl bg-white border border-slate-200 p-3 text-xs space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-indigo-600" />
              Active Dataset
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              datasetStats.isSynthetic
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {datasetStats.isSynthetic ? 'Demo Campus' : 'User Upload'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <div>
              <span className="block text-slate-800 font-mono font-bold">
                {datasetStats.totalRecords.toLocaleString()}
              </span>
              <span>Hourly Rows</span>
            </div>
            <div>
              <span className="block text-slate-800 font-mono font-bold">
                {datasetStats.buildingsCount} Bldgs / {datasetStats.metersCount} Mtrs
              </span>
              <span>Facilities</span>
            </div>
          </div>

          <button
            onClick={() => setCurrentPage('data-ingestion')}
            className="w-full mt-1.5 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 border border-slate-200 transition"
          >
            <FileCheck2 className="h-3.5 w-3.5 text-indigo-600" />
            <span>Upload Custom Data</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

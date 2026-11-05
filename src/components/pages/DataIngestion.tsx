import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Table,
  Check
} from 'lucide-react';
import {
  parseCSVorExcel,
  validateElectricityData,
  validateWeatherUpload,
  validateOccupancyUpload,
  validateEquipmentUpload,
  downloadTemplate,
  exportResultsToCsv
} from '../../utils/csvParser';
import type {
  ElectricityRecord,
  WeatherRecord,
  OccupancyRecord,
  EquipmentRecord,
  ValidationReport
} from '../../types';

interface DataIngestionProps {
  onLoadSyntheticData: () => void;
  onElectricityLoaded: (records: ElectricityRecord[], report: ValidationReport) => void;
  onWeatherLoaded: (records: WeatherRecord[], report: ValidationReport) => void;
  onOccupancyLoaded: (records: OccupancyRecord[], report: ValidationReport) => void;
  onEquipmentLoaded: (records: EquipmentRecord[], report: ValidationReport) => void;
  onNavigateToOverview?: () => void;
  currentReport: ValidationReport | null;
  activeDatasetStats: {
    totalRecords: number;
    buildingsCount: number;
    metersCount: number;
    isSynthetic: boolean;
  };
  electricityRecords: ElectricityRecord[];
}

export const DataIngestion: React.FC<DataIngestionProps> = ({
  onLoadSyntheticData,
  onElectricityLoaded,
  onWeatherLoaded,
  onOccupancyLoaded,
  onEquipmentLoaded,
  onNavigateToOverview,
  currentReport,
  activeDatasetStats,
  electricityRecords
}) => {
  const [activeUploadType, setActiveUploadType] = useState<'electricity' | 'weather' | 'occupancy' | 'equipment'>('electricity');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadedReport, setLastUploadedReport] = useState<ValidationReport | null>(currentReport);
  const [previewRecords, setPreviewRecords] = useState<any[]>([]);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    try {
      const { data, fileName } = await parseCSVorExcel(file);

      if (activeUploadType === 'electricity') {
        const { validRecords, report } = validateElectricityData(data, fileName);
        setLastUploadedReport(report);
        if (report.isValid && validRecords.length > 0) {
          onElectricityLoaded(validRecords, report);
          setPreviewRecords(validRecords.slice(0, 5));
          setUploadSuccessMessage(
            `Successfully loaded ${validRecords.length} electricity records from "${fileName}". Identified ${report.buildingsFound.length} building(s) and ${report.metersFound.length} meter(s).`
          );
        } else {
          setUploadError(report.errors[0] || 'Validation failed for electricity meter file.');
        }
      } else if (activeUploadType === 'weather') {
        const { validRecords, report } = validateWeatherUpload(data, fileName);
        setLastUploadedReport(report);
        if (validRecords.length > 0) {
          onWeatherLoaded(validRecords, report);
          setPreviewRecords(validRecords.slice(0, 5));
          setUploadSuccessMessage(`Loaded ${validRecords.length} weather observations.`);
        } else {
          setUploadError(report.errors[0] || 'No valid weather records found.');
        }
      } else if (activeUploadType === 'occupancy') {
        const { validRecords, report } = validateOccupancyUpload(data, fileName);
        setLastUploadedReport(report);
        if (validRecords.length > 0) {
          onOccupancyLoaded(validRecords, report);
          setPreviewRecords(validRecords.slice(0, 5));
          setUploadSuccessMessage(`Loaded ${validRecords.length} occupancy records.`);
        } else {
          setUploadError(report.errors[0] || 'No valid occupancy records found.');
        }
      } else if (activeUploadType === 'equipment') {
        const { validRecords, report } = validateEquipmentUpload(data, fileName);
        setLastUploadedReport(report);
        if (validRecords.length > 0) {
          onEquipmentLoaded(validRecords, report);
          setPreviewRecords(validRecords.slice(0, 5));
          setUploadSuccessMessage(`Loaded ${validRecords.length} equipment assets.`);
        } else {
          setUploadError(report.errors[0] || 'No valid equipment records found.');
        }
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error reading or parsing file.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportPowerBi = () => {
    exportResultsToCsv('powerbi_commercial_energy_dataset.csv', electricityRecords);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Data Ingestion &amp; Quality Validation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload custom CSV or Excel files for commercial campus buildings and meters
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPowerBi}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV Dataset</span>
          </button>

          <button
            onClick={() => {
              onLoadSyntheticData();
              setPreviewRecords([]);
              setUploadSuccessMessage('Reloaded default 28-day sample campus dataset.');
              setUploadError(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reload Demo Campus Data</span>
          </button>
        </div>
      </div>

      {/* Upload Success Banner with 1-click Dashboard Navigation */}
      {uploadSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <div>
              <div className="font-semibold text-emerald-900 text-xs sm:text-sm">
                File Ingested Successfully
              </div>
              <div className="text-xs text-emerald-700 mt-0.5">
                {uploadSuccessMessage}
              </div>
            </div>
          </div>
          {onNavigateToOverview && (
            <button
              onClick={onNavigateToOverview}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition shrink-0"
            >
              <span>View Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Dataset Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Electricity */}
        <div
          onClick={() => { setActiveUploadType('electricity'); setUploadError(null); }}
          className={`cursor-pointer rounded-xl p-4 border transition ${
            activeUploadType === 'electricity'
              ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-800">1. Electricity Meter</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
              Primary
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Hourly consumption intervals (kWh), building, and meter telemetry
          </p>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
            <span>Intervals: {activeDatasetStats.totalRecords}</span>
            <span className="text-indigo-600 font-semibold">Active</span>
          </div>
        </div>

        {/* Weather */}
        <div
          onClick={() => { setActiveUploadType('weather'); setUploadError(null); }}
          className={`cursor-pointer rounded-xl p-4 border transition ${
            activeUploadType === 'weather'
              ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-800">2. Weather</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              Optional
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Temperature (°C), humidity, and conditions
          </p>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
            <span>Status: Enabled</span>
            <span className="text-sky-600 font-medium">Select</span>
          </div>
        </div>

        {/* Occupancy */}
        <div
          onClick={() => { setActiveUploadType('occupancy'); setUploadError(null); }}
          className={`cursor-pointer rounded-xl p-4 border transition ${
            activeUploadType === 'occupancy'
              ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-800">3. Occupancy</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              Optional
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Headcount entries per building
          </p>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
            <span>Status: Enabled</span>
            <span className="text-sky-600 font-medium">Select</span>
          </div>
        </div>

        {/* Equipment */}
        <div
          onClick={() => { setActiveUploadType('equipment'); setUploadError(null); }}
          className={`cursor-pointer rounded-xl p-4 border transition ${
            activeUploadType === 'equipment'
              ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-800">4. Equipment</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              Optional
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Power (kW) ratings and runtime limits
          </p>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
            <span>Status: Enabled</span>
            <span className="text-sky-600 font-medium">Select</span>
          </div>
        </div>
      </div>

      {/* Upload Drop Zone & Schema Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Drop Zone */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-indigo-600" />
              Upload {activeUploadType.toUpperCase()} Dataset (.csv or .xlsx)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadTemplate(activeUploadType, 'csv')}
                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition"
              >
                <Download className="h-3 w-3" />
                <span>CSV Template</span>
              </button>
              <button
                onClick={() => downloadTemplate(activeUploadType, 'xlsx')}
                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition"
              >
                <Download className="h-3 w-3" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition space-y-2.5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Click or drag &amp; drop your {activeUploadType} file here
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Supports Standard CSV or Excel (.xlsx) files
              </p>
            </div>
            {isProcessing && (
              <div className="text-xs text-indigo-600 animate-pulse font-medium">
                Reading file, parsing dates, and checking schema...
              </div>
            )}
          </div>

          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Required Format Reference */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>Smart Format Acceptance</span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            The engine automatically recognizes common column naming variations:
          </p>

          <div className="space-y-1.5 font-mono text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
            <div className="text-indigo-700 font-bold">Supported Columns:</div>
            <div>• timestamp / date / datetime</div>
            <div>• energy_kwh / kwh / energy / consumption</div>
            <div>• building_id / building (optional)</div>
            <div>• meter_id / meter (optional)</div>
            <div>• average_power_kw / power (optional)</div>
          </div>

          <div className="text-[10px] text-slate-500 space-y-1 pt-1">
            <p className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Accepts Excel dates and multiple ISO/local string formats
            </p>
            <p className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Filters duplicate timestamps automatically
            </p>
            <p className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Defaults single-meter files to Main Campus / Incomer
            </p>
          </div>
        </div>
      </div>

      {/* Live Data Preview Table (First 5 Rows) */}
      {previewRecords.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Table className="h-4 w-4 text-indigo-600" />
              Ingested Rows Preview (First 5 Records)
            </h3>
            <span className="text-[11px] text-slate-500">
              Visual verification of mapped fields
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Timestamp (ISO)</th>
                  <th className="py-2 px-3">Building ID</th>
                  <th className="py-2 px-3">Meter ID</th>
                  <th className="py-2 px-3">Energy (kWh)</th>
                  <th className="py-2 px-3">Power (kW)</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                {previewRecords.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-400 font-sans">{i + 1}</td>
                    <td className="py-2 px-3">{r.timestamp}</td>
                    <td className="py-2 px-3 font-sans font-medium text-indigo-600">{r.building_id || '-'}</td>
                    <td className="py-2 px-3 font-sans font-medium text-sky-600">{r.meter_id || '-'}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{r.energy_kwh?.toFixed ? r.energy_kwh.toFixed(2) : r.energy_kwh}</td>
                    <td className="py-2 px-3">{r.average_power_kw?.toFixed ? r.average_power_kw.toFixed(2) : (r.average_power_kw || '-')}</td>
                    <td className="py-2 px-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">
                        {r.meter_status || 'normal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation Report Card */}
      {lastUploadedReport && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-emerald-600" />
                Validation Audit: {lastUploadedReport.fileName}
              </h3>
              <p className="text-[11px] text-slate-500">
                Summary of validated records and interval checks
              </p>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              lastUploadedReport.isValid
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {lastUploadedReport.isValid ? 'Schema Valid & Accepted' : 'Rejected Rows Detected'}
            </span>
          </div>

          {/* Validation Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Total Read</span>
              <span className="text-lg font-mono font-bold text-slate-800">
                {lastUploadedReport.totalRows}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] text-emerald-600 block">Accepted Rows</span>
              <span className="text-lg font-mono font-bold text-emerald-600">
                {lastUploadedReport.acceptedRows}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] text-rose-600 block">Rejected Rows</span>
              <span className="text-lg font-mono font-bold text-rose-600">
                {lastUploadedReport.rejectedRows}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] text-amber-600 block">Duplicates Filtered</span>
              <span className="text-lg font-mono font-bold text-amber-600">
                {lastUploadedReport.duplicateCount}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] text-sky-600 block">Detected Interval</span>
              <span className="text-lg font-mono font-bold text-sky-600">
                {lastUploadedReport.detectedIntervalMinutes} min
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] text-purple-600 block">Timestamp Gaps</span>
              <span className="text-lg font-mono font-bold text-purple-600">
                {lastUploadedReport.timestampGapsCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

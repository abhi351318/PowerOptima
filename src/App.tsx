import React, { useState, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar, type DashboardPage } from './components/common/Sidebar';
import { TariffModal } from './components/common/TariffModal';
import { HistoryDrawer } from './components/common/HistoryDrawer';

import { ExecutiveOverview } from './components/pages/ExecutiveOverview';
import { ConsumptionAnalysis } from './components/pages/ConsumptionAnalysis';
import { TariffCostAnalysis } from './components/pages/TariffCostAnalysis';
import { EnergyForecasting } from './components/pages/EnergyForecasting';
import { WeatherOccupancyEquipment } from './components/pages/WeatherOccupancyEquipment';
import { DataIngestion } from './components/pages/DataIngestion';

import {
  generateSampleDataset,
  SAMPLE_EQUIPMENT
} from './utils/sampleData';
import {
  calculateElectricityCost,
  trainAndEvaluateForecast
} from './utils/analyticsEngine';
import type {
  ElectricityRecord,
  WeatherRecord,
  OccupancyRecord,
  EquipmentRecord,
  ValidationReport,
  UserHistoryItem
} from './types';

function DashboardContent() {
  const { activeTariff, saveHistorySnapshot } = useAuth();

  // Initial multi-building campus dataset
  const initialData = useMemo(() => generateSampleDataset(), []);

  const [electricity, setElectricity] = useState<ElectricityRecord[]>(initialData.electricity);
  const [weather, setWeather] = useState<WeatherRecord[]>(initialData.weather);
  const [occupancy, setOccupancy] = useState<OccupancyRecord[]>(initialData.occupancy);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>(initialData.equipment);
  const [isSynthetic, setIsSynthetic] = useState(true);
  const [currentReport, setCurrentReport] = useState<ValidationReport | null>(null);

  // Filter State
  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const [selectedMeter, setSelectedMeter] = useState<string>('ALL');
  const [dateRangeDays, setDateRangeDays] = useState<number>(28);

  // Navigation State
  const [currentPage, setCurrentPage] = useState<DashboardPage>('overview');

  // Modals & Drawers
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Filter records
  const filteredElectricity = useMemo(() => {
    let result = electricity;

    if (selectedBuilding !== 'ALL') {
      result = result.filter((r) => r.building_id === selectedBuilding);
    }
    if (selectedMeter !== 'ALL') {
      result = result.filter((r) => r.meter_id === selectedMeter);
    }

    if (result.length > 0 && dateRangeDays < 28) {
      const maxDate = new Date(result[result.length - 1].timestamp).getTime();
      const cutoff = maxDate - dateRangeDays * 24 * 3600 * 1000;
      result = result.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    }

    return result;
  }, [electricity, selectedBuilding, selectedMeter, dateRangeDays]);

  // Lookup maps for weather and occupancy
  const weatherMap = useMemo(() => {
    const map = new Map<string, WeatherRecord>();
    weather.forEach((w) => map.set(w.timestamp, w));
    return map;
  }, [weather]);

  const occupancyMap = useMemo(() => {
    const map = new Map<string, OccupancyRecord>();
    occupancy.forEach((o) => map.set(o.timestamp, o));
    return map;
  }, [occupancy]);

  // Analytical & Forecasting Computations
  const forecastResults = useMemo(() => {
    return trainAndEvaluateForecast(filteredElectricity, weatherMap, occupancyMap);
  }, [filteredElectricity, weatherMap, occupancyMap]);

  const costSummary = useMemo(() => {
    return calculateElectricityCost(filteredElectricity, activeTariff);
  }, [filteredElectricity, activeTariff]);

  // Save Snapshot Action
  const handleSaveCurrentSnapshot = () => {
    const totalKwh = filteredElectricity.reduce((sum, r) => sum + r.energy_kwh, 0);
    const item: Omit<UserHistoryItem, 'userId'> = {
      id: `snapshot_${Date.now()}`,
      title: `${selectedBuilding === 'ALL' ? 'Campus Total' : `Building ${selectedBuilding}`} (${selectedMeter}) - ${dateRangeDays}d`,
      buildingId: selectedBuilding,
      meterId: selectedMeter,
      dateRange: `Last ${dateRangeDays} Days`,
      totalKwh: Math.round(totalKwh),
      totalCost: costSummary.totalCost,
      projectedSavings: 0,
      forecastReliabilityScore: forecastResults.evaluation.reliabilityScore,
      mae: forecastResults.evaluation.mae,
      rmse: forecastResults.evaluation.rmse,
      datasetSummary: `Intervals: ${filteredElectricity.length}, Tariff: ${activeTariff.name}`,
      createdAt: new Date().toISOString()
    };
    saveHistorySnapshot(item);
  };

  // Restore snapshot handler
  const handleLoadSnapshot = (item: UserHistoryItem) => {
    if (item.buildingId) setSelectedBuilding(item.buildingId);
    if (item.meterId) setSelectedMeter(item.meterId);
  };

  // Dataset statistics
  const buildingsCount = useMemo(() => {
    return new Set(electricity.map((r) => r.building_id)).size;
  }, [electricity]);

  const metersCount = useMemo(() => {
    return new Set(electricity.map((r) => r.meter_id)).size;
  }, [electricity]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Header */}
      <Header
        selectedBuilding={selectedBuilding}
        setSelectedBuilding={setSelectedBuilding}
        selectedMeter={selectedMeter}
        setSelectedMeter={setSelectedMeter}
        dateRangeDays={dateRangeDays}
        setDateRangeDays={setDateRangeDays}
        onOpenTariffModal={() => setIsTariffModalOpen(true)}
        onOpenHistoryDrawer={() => setIsHistoryDrawerOpen(true)}
        onOpenUploadModal={() => setCurrentPage('data-ingestion')}
        onSaveCurrentSnapshot={handleSaveCurrentSnapshot}
        processedRecordsCount={filteredElectricity.length}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          datasetStats={{
            totalRecords: electricity.length,
            buildingsCount,
            metersCount,
            isSynthetic
          }}
        />

        {/* Dashboard Main View Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentPage === 'overview' && (
            <ExecutiveOverview
              records={filteredElectricity}
              tariff={activeTariff}
              forecastPoints={forecastResults.next24hForecast}
            />
          )}

          {currentPage === 'consumption' && (
            <ConsumptionAnalysis records={filteredElectricity} />
          )}

          {currentPage === 'tariff' && (
            <TariffCostAnalysis
              records={filteredElectricity}
              tariff={activeTariff}
              onOpenTariffModal={() => setIsTariffModalOpen(true)}
            />
          )}

          {currentPage === 'forecasting' && (
            <EnergyForecasting
              evaluation={forecastResults.evaluation}
              holdoutComparison={forecastResults.holdoutComparison}
              next24hForecast={forecastResults.next24hForecast}
              next7dForecast={forecastResults.next7dForecast}
            />
          )}

          {currentPage === 'weather-equipment' && (
            <WeatherOccupancyEquipment
              records={filteredElectricity}
              weather={weather}
              occupancy={occupancy}
              equipment={equipment}
              featureImportance={forecastResults.featureImportance}
              onOpenUploadModal={() => setCurrentPage('data-ingestion')}
            />
          )}

          {currentPage === 'data-ingestion' && (
            <DataIngestion
              onLoadSyntheticData={() => {
                const fresh = generateSampleDataset();
                setElectricity(fresh.electricity);
                setWeather(fresh.weather);
                setOccupancy(fresh.occupancy);
                setEquipment(fresh.equipment);
                setIsSynthetic(true);
                setCurrentReport(null);
              }}
              onElectricityLoaded={(records, report) => {
                setElectricity(records);
                setIsSynthetic(false);
                setCurrentReport(report);
              }}
              onWeatherLoaded={(records) => {
                setWeather(records);
              }}
              onOccupancyLoaded={(records) => {
                setOccupancy(records);
              }}
              onEquipmentLoaded={(records) => {
                setEquipment(records);
              }}
              currentReport={currentReport}
              activeDatasetStats={{
                totalRecords: electricity.length,
                buildingsCount,
                metersCount,
                isSynthetic
              }}
              electricityRecords={electricity}
            />
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <TariffModal
        isOpen={isTariffModalOpen}
        onClose={() => setIsTariffModalOpen(false)}
      />

      <HistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        onLoadSnapshot={handleLoadSnapshot}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}

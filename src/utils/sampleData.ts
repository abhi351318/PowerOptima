import type {
  ElectricityRecord,
  WeatherRecord,
  OccupancyRecord,
  EquipmentRecord,
  TariffConfig
} from '../types';

export const DEFAULT_TARIFF: TariffConfig = {
  id: 'default-commercial-tariff',
  userId: 'system',
  name: 'Commercial ToU Tariff (Illustrative)',
  peakRate: 12.0, // ₹12/kWh
  normalRate: 8.5, // ₹8.5/kWh
  offPeakRate: 4.8, // ₹4.8/kWh
  fixedMonthlyCharge: 15000, // ₹15,000
  demandChargePerKw: 250, // ₹250 / kW of monthly peak demand
  taxPercentage: 18.0, // 18% GST
  peakHours: '09:00-12:00, 18:00-22:00',
  normalHours: '06:00-09:00, 12:00-18:00',
  offPeakHours: '22:00-06:00',
  effectiveStartDate: '2026-10-01',
  isCustom: false
};

export const SAMPLE_BUILDINGS = [
  { id: 'B001', name: 'Academic & Admin Block', areaM2: 12500, type: 'Academic/Administrative' },
  { id: 'B002', name: 'Innovation & Research Labs', areaM2: 18200, type: 'Laboratories & Computing' },
  { id: 'B003', name: 'Hostel & Central Library', areaM2: 14800, type: 'Residential & Library' }
];

export const SAMPLE_EQUIPMENT: EquipmentRecord[] = [
  {
    equipment_id: 'EQ-PUMP-01',
    building_id: 'B001',
    equipment_type: 'Raw Water & Booster Pump',
    rated_power_kw: 45,
    flexible_load: true,
    earliest_start_time: '00:00',
    latest_end_time: '23:59',
    required_runtime_minutes: 240, // 4 hours
    operating_constraints: 'Overhead tank level must reach minimum 80% before 07:00 AM'
  },
  {
    equipment_id: 'EQ-TES-01',
    building_id: 'B002',
    equipment_type: 'Thermal Energy Storage (Ice/Chilled Water)',
    rated_power_kw: 85,
    flexible_load: true,
    earliest_start_time: '22:00',
    latest_end_time: '08:00',
    required_runtime_minutes: 360, // 6 hours
    operating_constraints: 'Must charge fully during night off-peak window to discharge during noon peak'
  },
  {
    equipment_id: 'EQ-HVAC-02',
    building_id: 'B002',
    equipment_type: 'Secondary Chilled Loop & Air Handling Units',
    rated_power_kw: 65,
    flexible_load: true,
    earliest_start_time: '05:00',
    latest_end_time: '19:00',
    required_runtime_minutes: 480, // 8 hours
    operating_constraints: 'Pre-cool building between 05:00-08:00 to reduce chiller duty during 09:00-12:00 peak'
  },
  {
    equipment_id: 'EQ-LND-01',
    building_id: 'B003',
    equipment_type: 'Commercial Laundry & Heat Pump Dryers',
    rated_power_kw: 38,
    flexible_load: true,
    earliest_start_time: '05:00',
    latest_end_time: '23:00',
    required_runtime_minutes: 240, // 4 hours
    operating_constraints: 'Batch runs can be shifted to night or early afternoon off-peak periods'
  },
  {
    equipment_id: 'EQ-LGT-01',
    building_id: 'B001',
    equipment_type: 'Campus Pathway & Facade Lighting',
    rated_power_kw: 28,
    flexible_load: false,
    earliest_start_time: '18:30',
    latest_end_time: '06:00',
    required_runtime_minutes: 690,
    operating_constraints: 'Safety lighting - cannot shift, dimmable by 20% after midnight only'
  },
  {
    equipment_id: 'EQ-SRV-01',
    building_id: 'B002',
    equipment_type: 'Data Center & HPC Cluster Cooling',
    rated_power_kw: 110,
    flexible_load: false,
    earliest_start_time: '00:00',
    latest_end_time: '23:59',
    required_runtime_minutes: 1440,
    operating_constraints: 'Mission critical 24/7 continuous operation'
  }
];

// Generator for synthetic multi-building campus electricity, weather, and occupancy data
export function generateSampleDataset(): {
  electricity: ElectricityRecord[];
  weather: WeatherRecord[];
  occupancy: OccupancyRecord[];
  equipment: EquipmentRecord[];
} {
  const electricity: ElectricityRecord[] = [];
  const weather: WeatherRecord[] = [];
  const occupancy: OccupancyRecord[] = [];

  // Generate 28 days of hourly intervals ending yesterday
  const now = new Date();
  const startDate = new Date(now.getTime() - 28 * 24 * 3600 * 1000);
  startDate.setMinutes(0, 0, 0);

  const buildings = ['B001', 'B002', 'B003'];
  const meters: Record<string, string[]> = {
    B001: ['M001', 'M002'],
    B002: ['M001', 'M002'],
    B003: ['M001', 'M003']
  };

  const totalHours = 28 * 24;

  for (let h = 0; h < totalHours; h++) {
    const currentInterval = new Date(startDate.getTime() + h * 3600 * 1000);
    const isoString = currentInterval.toISOString();
    const hour = currentInterval.getHours();
    const dayOfWeek = currentInterval.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Weather generation (diurnal temperature variation)
    const baseTemp = 26;
    const tempVariation = Math.sin(((hour - 9) / 24) * 2 * Math.PI) * 7;
    const tempNoise = Math.sin(h * 0.1) * 2;
    const tempC = Math.round((baseTemp + tempVariation + tempNoise) * 10) / 10;
    const humidity = Math.max(35, Math.min(92, Math.round(75 - (tempC - 20) * 2.2 + Math.cos(h * 0.2) * 5)));
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Clear'];
    const weatherCondition = tempC > 31 ? 'Hot & Sunny' : conditions[h % conditions.length];

    weather.push({
      timestamp: isoString,
      location_id: 'LOC-CAMPUS-01',
      temperature_c: tempC,
      humidity_pct: humidity,
      weather_condition: weatherCondition
    });

    // Generate occupancy and meter readings per building
    for (const bId of buildings) {
      let baseOccupants = 0;
      let maxOccupancy = 600;

      if (bId === 'B001') maxOccupancy = 750;
      else if (bId === 'B002') maxOccupancy = 500;
      else if (bId === 'B003') maxOccupancy = 400;

      if (!isWeekend) {
        if (hour >= 8 && hour <= 18) {
          baseOccupants = Math.round(maxOccupancy * (0.65 + 0.3 * Math.sin(((hour - 8) / 10) * Math.PI)));
        } else if (hour > 18 && hour <= 21) {
          baseOccupants = Math.round(maxOccupancy * 0.25);
        } else {
          baseOccupants = bId === 'B003' ? Math.round(maxOccupancy * 0.6) : Math.round(maxOccupancy * 0.04);
        }
      } else {
        // Weekend
        baseOccupants = bId === 'B003' ? Math.round(maxOccupancy * 0.55) : Math.round(maxOccupancy * 0.08);
      }

      // Add occupancy record
      occupancy.push({
        timestamp: isoString,
        building_id: bId,
        occupancy_count: baseOccupants,
        occupancy_source: 'RFID Turnstile & IoT Sensor'
      });

      // Meter readings
      const bMeters = meters[bId];
      for (const mId of bMeters) {
        let baseKwh = 15;
        if (bId === 'B001') baseKwh = mId === 'M001' ? 42 : 28;
        if (bId === 'B002') baseKwh = mId === 'M001' ? 68 : 45;
        if (bId === 'B003') baseKwh = mId === 'M001' ? 32 : 22;

        // Peak hour multipliers (09-12 and 18-22)
        let timeMultiplier = 0.45;
        if (hour >= 8 && hour <= 18) {
          timeMultiplier = isWeekend ? 0.65 : 1.15;
        }
        if ((hour >= 9 && hour <= 12) || (hour >= 18 && hour <= 21)) {
          timeMultiplier += isWeekend ? 0.2 : 0.4;
        }

        // Weather impact (HVAC cooling loads rise non-linearly when temp > 28°C)
        const coolingPenalty = tempC > 28 ? (tempC - 28) * (mId === 'M001' ? 2.8 : 0.8) : 0;

        // Occupancy load factor
        const occFactor = (baseOccupants / (maxOccupancy || 1)) * (mId === 'M002' ? 12 : 6);

        // Small random noise
        const noise = (Math.sin(h * 3.7 + (mId === 'M001' ? 1 : 2)) * 0.06);

        let energyKwh = Math.round((baseKwh * timeMultiplier + coolingPenalty + occFactor) * (1 + noise) * 10) / 10;
        if (energyKwh < 3) energyKwh = 3.5;

        // Simulate rare synthetic anomalies (e.g. equipment left running over weekend or spike)
        let status: 'normal' | 'estimated' | 'missing' = 'normal';
        if (h === totalHours - 48 && bId === 'B002' && mId === 'M001') {
          energyKwh = Math.round(energyKwh * 2.1 * 10) / 10; // Chiller surge anomaly
        } else if (h === totalHours - 110 && bId === 'B001' && mId === 'M002') {
          energyKwh = Math.round(energyKwh * 1.85 * 10) / 10; // Weekend lighting override
        }

        electricity.push({
          timestamp: isoString,
          building_id: bId,
          meter_id: mId,
          energy_kwh: energyKwh,
          average_power_kw: Math.round(energyKwh * 1.05 * 10) / 10,
          meter_status: status
        });
      }
    }
  }

  return {
    electricity,
    weather,
    occupancy,
    equipment: SAMPLE_EQUIPMENT
  };
}

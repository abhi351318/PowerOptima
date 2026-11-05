import { calculateElectricityCost, getTariffPeriod } from '../utils/analyticsEngine';
import { DEFAULT_TARIFF } from '../utils/sampleData';
import type { ElectricityRecord } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runTests() {
  console.log('--- Running PowerOptima Unit Tests ---');

  // Test 1: ToU Tariff Period matching
  const peakPeriod = getTariffPeriod(10, DEFAULT_TARIFF); // 10:00 is in 09:00-12:00
  assert(peakPeriod.period === 'peak', 'Hour 10:00 must be identified as Peak period');
  assert(peakPeriod.rate === DEFAULT_TARIFF.peakRate, 'Peak rate must match tariff rate');

  const offPeakPeriod = getTariffPeriod(23, DEFAULT_TARIFF); // 23:00 is in 22:00-06:00
  assert(offPeakPeriod.period === 'off_peak', 'Hour 23:00 must be identified as Off-Peak period');

  const normalPeriod = getTariffPeriod(15, DEFAULT_TARIFF); // 15:00 is Normal
  assert(normalPeriod.period === 'normal', 'Hour 15:00 must be identified as Normal period');

  // Test 2: Cost Calculation
  const mockRecords: ElectricityRecord[] = [
    { timestamp: '2026-11-01T10:00:00Z', building_id: 'B001', meter_id: 'M001', energy_kwh: 100 },
    { timestamp: '2026-11-01T23:00:00Z', building_id: 'B001', meter_id: 'M001', energy_kwh: 100 }
  ];

  const cost = calculateElectricityCost(mockRecords, DEFAULT_TARIFF);
  assert(cost.peakKwh === 100, 'Peak kWh must equal 100');
  assert(cost.offPeakKwh === 100, 'Off-peak kWh must equal 100');
  // Test 3: Flexible CSV validation
  const { validateElectricityData } = await import('../utils/csvParser');
  const mockFlexibleRows = [
    { 'Date Time': '2026-11-01 09:00:00', 'Building': 'Engineering HQ', 'Meter ID': 'MTR-HVAC', 'kWh': 142.5 },
    { 'Date Time': '2026-11-01 10:00:00', 'Building': 'Engineering HQ', 'Meter ID': 'MTR-HVAC', 'kWh': 165.2 }
  ];
  const validation = validateElectricityData(mockFlexibleRows, 'test_meter.csv');
  assert(validation.report.isValid === true, 'Flexible CSV with custom headers must be valid');
  assert(validation.validRecords.length === 2, 'Must extract 2 valid records');
  assert(validation.validRecords[0].building_id === 'Engineering HQ', 'Building must match custom string');
  assert(validation.validRecords[0].energy_kwh === 142.5, 'Energy must match parsed kWh');

  console.log('--- All Unit Tests Passed Successfully ---');
}

runTests();

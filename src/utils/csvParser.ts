import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
  ElectricityRecord,
  WeatherRecord,
  OccupancyRecord,
  EquipmentRecord,
  ValidationReport
} from '../types';

export function parseCSVorExcel(
  file: File
): Promise<{ data: any[]; errors: string[]; fileName: string }> {
  return new Promise((resolve, reject) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          resolve({ data: jsonData, errors: [], fileName: file.name });
        } catch (err: any) {
          reject(new Error(`Failed to parse Excel file: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          resolve({
            data: results.data,
            errors: results.errors.map((e) => e.message),
            fileName: file.name
          });
        },
        error: (err) => reject(new Error(`CSV parsing error: ${err.message}`))
      });
    }
  });
}

export function validateElectricityData(
  rawData: any[],
  fileName: string
): { validRecords: ElectricityRecord[]; report: ValidationReport } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const validRecords: ElectricityRecord[] = [];

  let duplicateCount = 0;
  let missingValuesCount = 0;
  let rejectedRows = 0;
  const seenKeys = new Set<string>();
  const buildingsFound = new Set<string>();
  const metersFound = new Set<string>();

  if (!rawData || rawData.length === 0) {
    errors.push('The uploaded file is empty or contains no readable rows.');
    return {
      validRecords: [],
      report: {
        fileName,
        datasetType: 'electricity',
        totalRows: 0,
        acceptedRows: 0,
        rejectedRows: 0,
        missingValuesCount: 0,
        duplicateCount: 0,
        timestampGapsCount: 0,
        detectedIntervalMinutes: 60,
        buildingsFound: [],
        metersFound: [],
        warnings,
        errors,
        isValid: false
      }
    };
  }

  // Check required columns
  const firstRow = rawData[0];
  const requiredCols = ['timestamp', 'building_id', 'meter_id', 'energy_kwh'];
  const missingCols = requiredCols.filter(
    (col) => !(col in firstRow) && !(col.toLowerCase() in firstRow)
  );

  if (missingCols.length > 0) {
    errors.push(`Missing mandatory column(s): ${missingCols.join(', ')}`);
  }

  // Detect cumulative vs interval check
  let isMonotonicallyIncreasing = true;
  let prevKwh = -1;
  let checkedCount = 0;

  rawData.forEach((row, idx) => {
    // Column normalization
    const timestampRaw = row.timestamp || row.Timestamp || row.TIMESTAMP;
    const buildingIdRaw = row.building_id || row.building || row.Building_ID || row.BUILDING_ID;
    const meterIdRaw = row.meter_id || row.meter || row.Meter_ID || row.METER_ID;
    const energyKwhRaw = row.energy_kwh ?? row.energy ?? row.kWh ?? row.Energy_kWh;
    const powerKwRaw = row.average_power_kw ?? row.power_kw ?? row.Power_kW;
    const statusRaw = row.meter_status || row.status || 'normal';

    if (!timestampRaw || !buildingIdRaw || !meterIdRaw || energyKwhRaw === undefined || energyKwhRaw === '') {
      rejectedRows++;
      missingValuesCount++;
      return;
    }

    const energyNum = Number(energyKwhRaw);
    if (isNaN(energyNum) || energyNum < 0) {
      rejectedRows++;
      warnings.push(`Row ${idx + 1}: Invalid energy_kwh value "${energyKwhRaw}". Must be non-negative number.`);
      return;
    }

    // Cumulative check
    if (checkedCount < 50) {
      if (prevKwh !== -1 && energyNum > prevKwh * 1.5 && prevKwh > 50) {
        // Potential cumulative meter reading detection
      }
      prevKwh = energyNum;
      checkedCount++;
    }

    // Date check
    const parsedDate = new Date(timestampRaw);
    if (isNaN(parsedDate.getTime())) {
      rejectedRows++;
      warnings.push(`Row ${idx + 1}: Invalid timestamp format "${timestampRaw}". Expected ISO format.`);
      return;
    }

    const bId = String(buildingIdRaw).trim();
    const mId = String(meterIdRaw).trim();
    const key = `${parsedDate.toISOString()}_${bId}_${mId}`;

    if (seenKeys.has(key)) {
      duplicateCount++;
      rejectedRows++;
      return; // Skip duplicate
    }
    seenKeys.add(key);

    buildingsFound.add(bId);
    metersFound.add(mId);

    validRecords.push({
      timestamp: parsedDate.toISOString(),
      building_id: bId,
      meter_id: mId,
      energy_kwh: energyNum,
      average_power_kw: powerKwRaw !== undefined && !isNaN(Number(powerKwRaw)) ? Number(powerKwRaw) : undefined,
      meter_status: ['normal', 'estimated', 'missing'].includes(String(statusRaw).toLowerCase())
        ? (String(statusRaw).toLowerCase() as any)
        : 'normal'
    });
  });

  // Sort chronologically
  validRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Detect interval & gaps
  let timestampGapsCount = 0;
  let detectedIntervalMinutes = 60;
  if (validRecords.length > 2) {
    const diffs: number[] = [];
    for (let i = 1; i < Math.min(validRecords.length, 50); i++) {
      const d1 = new Date(validRecords[i - 1].timestamp).getTime();
      const d2 = new Date(validRecords[i].timestamp).getTime();
      const diffMin = Math.round((d2 - d1) / 60000);
      if (diffMin > 0) diffs.push(diffMin);
    }
    if (diffs.length > 0) {
      // Find median interval
      diffs.sort((a, b) => a - b);
      detectedIntervalMinutes = diffs[Math.floor(diffs.length / 2)] || 60;
    }

    // Scan for gap intervals greater than 1.5x expected interval
    for (let i = 1; i < validRecords.length; i++) {
      const d1 = new Date(validRecords[i - 1].timestamp).getTime();
      const d2 = new Date(validRecords[i].timestamp).getTime();
      const diffMin = (d2 - d1) / 60000;
      if (diffMin > detectedIntervalMinutes * 1.8) {
        timestampGapsCount++;
      }
    }
  }

  const isValid = errors.length === 0 && validRecords.length > 0;

  return {
    validRecords,
    report: {
      fileName,
      datasetType: 'electricity',
      totalRows: rawData.length,
      acceptedRows: validRecords.length,
      rejectedRows,
      missingValuesCount,
      duplicateCount,
      timestampGapsCount,
      detectedIntervalMinutes,
      buildingsFound: Array.from(buildingsFound),
      metersFound: Array.from(metersFound),
      startDate: validRecords[0]?.timestamp,
      endDate: validRecords[validRecords.length - 1]?.timestamp,
      warnings,
      errors,
      isValid
    }
  };
}

export function validateWeatherUpload(
  rawData: any[],
  fileName: string
): { validRecords: WeatherRecord[]; report: ValidationReport } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const validRecords: WeatherRecord[] = [];

  rawData.forEach((row, idx) => {
    const ts = row.timestamp || row.Timestamp;
    const loc = row.location_id || row.location || 'LOC-01';
    const temp = row.temperature_c ?? row.temperature ?? row.temp;
    const hum = row.humidity_pct ?? row.humidity;
    const cond = row.weather_condition || row.condition || 'Clear';

    if (!ts || temp === undefined || isNaN(Number(temp))) {
      return;
    }
    const d = new Date(ts);
    if (isNaN(d.getTime())) return;

    validRecords.push({
      timestamp: d.toISOString(),
      location_id: String(loc).trim(),
      temperature_c: Number(temp),
      humidity_pct: hum !== undefined && !isNaN(Number(hum)) ? Number(hum) : undefined,
      weather_condition: String(cond).trim()
    });
  });

  return {
    validRecords,
    report: {
      fileName,
      datasetType: 'weather',
      totalRows: rawData.length,
      acceptedRows: validRecords.length,
      rejectedRows: rawData.length - validRecords.length,
      missingValuesCount: 0,
      duplicateCount: 0,
      timestampGapsCount: 0,
      detectedIntervalMinutes: 60,
      buildingsFound: [],
      metersFound: [],
      warnings,
      errors,
      isValid: validRecords.length > 0
    }
  };
}

export function validateOccupancyUpload(
  rawData: any[],
  fileName: string
): { validRecords: OccupancyRecord[]; report: ValidationReport } {
  const validRecords: OccupancyRecord[] = [];
  rawData.forEach((row) => {
    const ts = row.timestamp || row.Timestamp;
    const bId = row.building_id || row.building;
    const count = row.occupancy_count ?? row.count ?? row.occupancy;
    if (!ts || !bId || count === undefined || isNaN(Number(count))) return;

    const d = new Date(ts);
    if (isNaN(d.getTime())) return;

    validRecords.push({
      timestamp: d.toISOString(),
      building_id: String(bId).trim(),
      occupancy_count: Math.max(0, Math.round(Number(count))),
      occupancy_source: row.occupancy_source || 'Access System'
    });
  });

  return {
    validRecords,
    report: {
      fileName,
      datasetType: 'occupancy',
      totalRows: rawData.length,
      acceptedRows: validRecords.length,
      rejectedRows: rawData.length - validRecords.length,
      missingValuesCount: 0,
      duplicateCount: 0,
      timestampGapsCount: 0,
      detectedIntervalMinutes: 60,
      buildingsFound: Array.from(new Set(validRecords.map((r) => r.building_id))),
      metersFound: [],
      warnings: [],
      errors: [],
      isValid: validRecords.length > 0
    }
  };
}

export function validateEquipmentUpload(
  rawData: any[],
  fileName: string
): { validRecords: EquipmentRecord[]; report: ValidationReport } {
  const validRecords: EquipmentRecord[] = [];
  rawData.forEach((row) => {
    const eqId = row.equipment_id || row.id;
    const bId = row.building_id || row.building;
    const type = row.equipment_type || row.type;
    const kw = row.rated_power_kw ?? row.power_kw ?? row.power;
    const flex = row.flexible_load;

    if (!eqId || !bId || !type || kw === undefined || isNaN(Number(kw))) return;

    validRecords.push({
      equipment_id: String(eqId).trim(),
      building_id: String(bId).trim(),
      equipment_type: String(type).trim(),
      rated_power_kw: Number(kw),
      flexible_load: String(flex).toLowerCase() === 'true' || flex === 1 || flex === true,
      earliest_start_time: row.earliest_start_time || '00:00',
      latest_end_time: row.latest_end_time || '23:59',
      required_runtime_minutes: Number(row.required_runtime_minutes) || 240,
      operating_constraints: row.operating_constraints || ''
    });
  });

  return {
    validRecords,
    report: {
      fileName,
      datasetType: 'equipment',
      totalRows: rawData.length,
      acceptedRows: validRecords.length,
      rejectedRows: rawData.length - validRecords.length,
      missingValuesCount: 0,
      duplicateCount: 0,
      timestampGapsCount: 0,
      detectedIntervalMinutes: 0,
      buildingsFound: Array.from(new Set(validRecords.map((r) => r.building_id))),
      metersFound: [],
      warnings: [],
      errors: [],
      isValid: validRecords.length > 0
    }
  };
}

// Downloadable templates generator (CSV & Excel)
export function downloadTemplate(
  type: 'electricity' | 'weather' | 'occupancy' | 'equipment',
  format: 'csv' | 'xlsx'
) {
  let sampleRows: any[] = [];
  let fileName = `template_${type}.${format}`;

  if (type === 'electricity') {
    sampleRows = [
      { timestamp: '2026-11-01T09:00:00+05:30', building_id: 'B001', meter_id: 'M001', energy_kwh: 42.5, average_power_kw: 42.5, meter_status: 'normal' },
      { timestamp: '2026-11-01T10:00:00+05:30', building_id: 'B001', meter_id: 'M001', energy_kwh: 48.2, average_power_kw: 48.2, meter_status: 'normal' },
      { timestamp: '2026-11-01T11:00:00+05:30', building_id: 'B001', meter_id: 'M002', energy_kwh: 31.7, average_power_kw: 31.7, meter_status: 'normal' }
    ];
  } else if (type === 'weather') {
    sampleRows = [
      { timestamp: '2026-11-01T09:00:00+05:30', location_id: 'LOC-CAMPUS-01', temperature_c: 28.5, humidity_pct: 65, weather_condition: 'Sunny' },
      { timestamp: '2026-11-01T10:00:00+05:30', location_id: 'LOC-CAMPUS-01', temperature_c: 31.2, humidity_pct: 58, weather_condition: 'Partly Cloudy' }
    ];
  } else if (type === 'occupancy') {
    sampleRows = [
      { timestamp: '2026-11-01T09:00:00+05:30', building_id: 'B001', occupancy_count: 420, occupancy_source: 'Access Turnstiles' },
      { timestamp: '2026-11-01T10:00:00+05:30', building_id: 'B001', occupancy_count: 580, occupancy_source: 'Access Turnstiles' }
    ];
  } else if (type === 'equipment') {
    sampleRows = [
      { equipment_id: 'EQ-PUMP-01', building_id: 'B001', equipment_type: 'Booster Pump', rated_power_kw: 45, flexible_load: 'true', earliest_start_time: '00:00', latest_end_time: '23:59', required_runtime_minutes: 240, operating_constraints: 'Overhead tank target min 85%' },
      { equipment_id: 'EQ-TES-01', building_id: 'B002', equipment_type: 'Thermal Storage', rated_power_kw: 85, flexible_load: 'true', earliest_start_time: '22:00', latest_end_time: '08:00', required_runtime_minutes: 360, operating_constraints: 'Night off-peak charge only' }
    ];
  }

  if (format === 'csv') {
    const csvContent = Papa.unparse(sampleRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  } else {
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, fileName);
  }
}

// Download processed results / Power BI dataset
export function exportResultsToCsv(filename: string, rows: any[]) {
  const csvContent = Papa.unparse(rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
  ElectricityRecord,
  WeatherRecord,
  OccupancyRecord,
  EquipmentRecord,
  ValidationReport
} from '../types';

/**
 * Normalizes an object's keys by lowercasing and stripping punctuation and whitespace
 */
function normalizeKeys(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const cleanKey = key.toLowerCase().replace(/[\s_\-\(\)\/\\.]/g, '');
    normalized[cleanKey] = row[key];
  }
  return normalized;
}

/**
 * Robustly parses multiple date formats including Excel serial numbers,
 * standard ISO strings, DD/MM/YYYY, and epoch timestamps.
 */
function parseDateRobust(raw: any): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

  if (typeof raw === 'number') {
    // Excel serial dates: e.g. 45000 is ~2023
    if (raw > 20000 && raw < 80000) {
      return new Date(Math.round((raw - 25569) * 86400 * 1000));
    }
    // Unix epoch ms or seconds
    if (raw > 1000000000000) return new Date(raw);
    if (raw > 1000000000) return new Date(raw * 1000);
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Standard ISO / JS string parse
  const directDate = new Date(str);
  if (!isNaN(directDate.getTime()) && directDate.getFullYear() > 1990 && directDate.getFullYear() < 2100) {
    return directDate;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const h = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const m = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const s = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, h, m, s);
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const h = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const m = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const s = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, h, m, s);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

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
          const workbook = XLSX.read(buffer, {
            type: 'array',
            cellDates: true,
            dateNF: 'yyyy-mm-dd hh:mm:ss'
          });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          resolve({ data: jsonData, errors: [], fileName: file.name });
        } catch (err: any) {
          reject(new Error(`Failed to parse Excel file: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed.'));
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
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

  // Inspect headers in first available row
  const firstRow = normalizeKeys(rawData[0] || {});
  const hasTimestamp = 'timestamp' in firstRow || 'datetime' in firstRow || 'date' in firstRow || 'time' in firstRow;
  const hasEnergy = 'energykwh' in firstRow || 'kwh' in firstRow || 'energy' in firstRow || 'consumption' in firstRow || 'usage' in firstRow || 'value' in firstRow;

  if (!hasTimestamp) {
    errors.push('Missing timestamp column. Expected header named "timestamp", "date", or "datetime".');
  }
  if (!hasEnergy) {
    errors.push('Missing electricity consumption column. Expected header named "energy_kwh", "kwh", "energy", or "consumption".');
  }

  if (errors.length > 0) {
    return {
      validRecords: [],
      report: {
        fileName,
        datasetType: 'electricity',
        totalRows: rawData.length,
        acceptedRows: 0,
        rejectedRows: rawData.length,
        missingValuesCount: rawData.length,
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

  rawData.forEach((rawRow, idx) => {
    if (!rawRow || typeof rawRow !== 'object') {
      rejectedRows++;
      return;
    }

    const norm = normalizeKeys(rawRow);

    // Resolve timestamp
    const tsRaw = norm['timestamp'] ?? norm['datetime'] ?? norm['date'] ?? norm['time'];
    const parsedDate = parseDateRobust(tsRaw);
    if (!parsedDate) {
      rejectedRows++;
      missingValuesCount++;
      if (idx < 5) warnings.push(`Row ${idx + 1}: Unrecognized or missing timestamp "${tsRaw}".`);
      return;
    }

    // Resolve energy
    const energyRaw = norm['energykwh'] ?? norm['kwh'] ?? norm['energy'] ?? norm['consumption'] ?? norm['usage'] ?? norm['value'];
    if (energyRaw === undefined || energyRaw === null || energyRaw === '') {
      rejectedRows++;
      missingValuesCount++;
      return;
    }
    const energyNum = Number(energyRaw);
    if (isNaN(energyNum) || energyNum < 0) {
      rejectedRows++;
      if (idx < 5) warnings.push(`Row ${idx + 1}: Non-numeric or negative consumption "${energyRaw}".`);
      return;
    }

    // Resolve building ID & meter ID (graceful fallbacks if file is single-meter)
    const bId = String(norm['buildingid'] ?? norm['building'] ?? norm['site'] ?? norm['facility'] ?? 'Main Campus').trim();
    const mId = String(norm['meterid'] ?? norm['meter'] ?? norm['sensor'] ?? 'M001').trim();

    // Resolve power (kW)
    const powerRaw = norm['averagepowerkw'] ?? norm['powerkw'] ?? norm['power'] ?? norm['kw'];
    const powerNum = powerRaw !== undefined && powerRaw !== '' && !isNaN(Number(powerRaw)) ? Number(powerRaw) : energyNum;

    // Resolve status
    const statusRaw = String(norm['meterstatus'] ?? norm['status'] ?? 'normal').toLowerCase();
    const meterStatus = ['normal', 'estimated', 'missing'].includes(statusRaw) ? (statusRaw as any) : 'normal';

    const key = `${parsedDate.toISOString()}_${bId}_${mId}`;
    if (seenKeys.has(key)) {
      duplicateCount++;
      rejectedRows++;
      return;
    }
    seenKeys.add(key);

    buildingsFound.add(bId);
    metersFound.add(mId);

    validRecords.push({
      timestamp: parsedDate.toISOString(),
      building_id: bId,
      meter_id: mId,
      energy_kwh: energyNum,
      average_power_kw: powerNum,
      meter_status: meterStatus
    });
  });

  // Sort records chronologically
  validRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Detect interval and gap patterns
  let timestampGapsCount = 0;
  let detectedIntervalMinutes = 60;
  if (validRecords.length > 2) {
    const diffs: number[] = [];
    for (let i = 1; i < Math.min(validRecords.length, 60); i++) {
      const d1 = new Date(validRecords[i - 1].timestamp).getTime();
      const d2 = new Date(validRecords[i].timestamp).getTime();
      const diffMin = Math.round((d2 - d1) / 60000);
      if (diffMin > 0) diffs.push(diffMin);
    }
    if (diffs.length > 0) {
      diffs.sort((a, b) => a - b);
      detectedIntervalMinutes = diffs[Math.floor(diffs.length / 2)] || 60;
    }

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
    if (!row || typeof row !== 'object') return;
    const norm = normalizeKeys(row);

    const tsRaw = norm['timestamp'] ?? norm['datetime'] ?? norm['date'];
    const parsedDate = parseDateRobust(tsRaw);
    if (!parsedDate) return;

    const loc = String(norm['locationid'] ?? norm['location'] ?? 'LOC-01').trim();
    const tempRaw = norm['temperaturec'] ?? norm['temperature'] ?? norm['temp'];
    const humRaw = norm['humiditypct'] ?? norm['humidity'];
    const cond = String(norm['weathercondition'] ?? norm['condition'] ?? 'Clear').trim();

    if (tempRaw === undefined || tempRaw === null || tempRaw === '' || isNaN(Number(tempRaw))) {
      return;
    }

    validRecords.push({
      timestamp: parsedDate.toISOString(),
      location_id: loc,
      temperature_c: Number(tempRaw),
      humidity_pct: humRaw !== undefined && !isNaN(Number(humRaw)) ? Number(humRaw) : undefined,
      weather_condition: cond
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
    if (!row || typeof row !== 'object') return;
    const norm = normalizeKeys(row);

    const tsRaw = norm['timestamp'] ?? norm['datetime'] ?? norm['date'];
    const parsedDate = parseDateRobust(tsRaw);
    if (!parsedDate) return;

    const bId = String(norm['buildingid'] ?? norm['building'] ?? 'Main Campus').trim();
    const countRaw = norm['occupancycount'] ?? norm['count'] ?? norm['occupancy'] ?? norm['headcount'];
    if (countRaw === undefined || isNaN(Number(countRaw))) return;

    validRecords.push({
      timestamp: parsedDate.toISOString(),
      building_id: bId,
      occupancy_count: Math.max(0, Math.round(Number(countRaw))),
      occupancy_source: String(norm['occupancysource'] ?? norm['source'] ?? 'Access System')
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
    if (!row || typeof row !== 'object') return;
    const norm = normalizeKeys(row);

    const eqId = String(norm['equipmentid'] ?? norm['id'] ?? norm['assetid'] ?? '').trim();
    const bId = String(norm['buildingid'] ?? norm['building'] ?? 'Main Campus').trim();
    const type = String(norm['equipmenttype'] ?? norm['type'] ?? 'General Load').trim();
    const kwRaw = norm['ratedpowerkw'] ?? norm['powerkw'] ?? norm['power'] ?? norm['kw'];

    if (!eqId || kwRaw === undefined || isNaN(Number(kwRaw))) return;

    const flexRaw = norm['flexibleload'] ?? norm['flexible'];

    validRecords.push({
      equipment_id: eqId,
      building_id: bId,
      equipment_type: type,
      rated_power_kw: Number(kwRaw),
      flexible_load: String(flexRaw).toLowerCase() === 'true' || flexRaw === 1 || flexRaw === true,
      earliest_start_time: norm['earlieststarttime'] || '00:00',
      latest_end_time: norm['latestendtime'] || '23:59',
      required_runtime_minutes: Number(norm['requiredruntimeminutes']) || 240,
      operating_constraints: norm['operatingconstraints'] || ''
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
  const fileName = `template_${type}.${format}`;

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

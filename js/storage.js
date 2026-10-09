import { convertInchesToDecimal } from './conversion.js';

export const STORAGE_KEY = 'samir-wardrobe-calculator:saved-calculations';
export const SETTINGS_KEY = 'samir-wardrobe-calculator:settings';

export function generateId(prefix = 'id') {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function generateCalculationId() {
  return generateId('calc');
}

export function generateWardrobeId() {
  return generateId('wardrobe');
}

function safeParseJson(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Invalid JSON in localStorage:', error);
    return null;
  }
}

function readStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Unable to read from localStorage:', error);
    return null;
  }
}

function writeStorageValue(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error('Unable to write to localStorage:', error);
    return false;
  }
}

export function normalizeWardrobeRow(row, fallbackId = generateWardrobeId()) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const height = typeof row.height === 'string' ? row.height : row.height === undefined || row.height === null ? '' : String(row.height);
  const width = typeof row.width === 'string' ? row.width : row.width === undefined || row.width === null ? '' : String(row.width);
  const included = row.included !== false;

  return {
    id: typeof row.id === 'string' && row.id.trim() !== '' ? row.id : fallbackId,
    height,
    width,
    included,
  };
}

export function isValidStoredCalculation(calculation) {
  if (!calculation || typeof calculation !== 'object') {
    return false;
  }

  if (typeof calculation.id !== 'string' || calculation.id.trim() === '') {
    return false;
  }

  if (typeof calculation.name !== 'string') {
    return false;
  }

  if (!Array.isArray(calculation.rows)) {
    return false;
  }

  if (typeof calculation.createdAt !== 'string' || calculation.createdAt.trim() === '') {
    return false;
  }

  if (typeof calculation.updatedAt !== 'string' || calculation.updatedAt.trim() === '') {
    return false;
  }

  for (let index = 0; index < calculation.rows.length; index += 1) {
    const row = calculation.rows[index];
    if (!normalizeWardrobeRow(row, `wardrobe-${index}`)) {
      return false;
    }

    if (typeof row.height === 'string' && row.height.trim() !== '') {
      const heightCheck = convertInchesToDecimal(row.height);
      if (!heightCheck.valid) {
        return false;
      }
    }

    if (typeof row.width === 'string' && row.width.trim() !== '') {
      const widthCheck = convertInchesToDecimal(row.width);
      if (!widthCheck.valid) {
        return false;
      }
    }
  }

  return true;
}

export function sanitizeCalculation(calculation) {
  if (!isValidStoredCalculation(calculation)) {
    return null;
  }

  return {
    id: String(calculation.id),
    name: String(calculation.name).trim() || 'Untitled Calculation',
    createdAt: String(calculation.createdAt),
    updatedAt: String(calculation.updatedAt),
    rows: calculation.rows.map((row, index) => normalizeWardrobeRow(row, `wardrobe-${index}`)),
  };
}

export function saveCalculation(calculation) {
  const sanitized = sanitizeCalculation(calculation);

  if (!sanitized) {
    throw new Error('The calculation data is invalid and could not be saved.');
  }

  const allCalculations = loadAllSavedCalculations();
  const existingIndex = allCalculations.findIndex((item) => item.id === sanitized.id);

  if (existingIndex >= 0) {
    allCalculations.splice(existingIndex, 1, sanitized);
  } else {
    allCalculations.push(sanitized);
  }

  const ok = writeStorageValue(STORAGE_KEY, JSON.stringify(allCalculations));
  if (!ok) {
    throw new Error('Saving failed because local storage is unavailable.');
  }

  return sanitized;
}

export function loadAllSavedCalculations() {
  const rawValue = readStorageValue(STORAGE_KEY);
  const parsed = safeParseJson(rawValue);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => sanitizeCalculation(item))
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function loadCalculationById(id) {
  if (typeof id !== 'string' || id.trim() === '') {
    return null;
  }

  return loadAllSavedCalculations().find((item) => item.id === id) || null;
}

export function updateSavedCalculation(calculation) {
  if (!calculation || typeof calculation.id !== 'string' || calculation.id.trim() === '') {
    throw new Error('A calculation ID is required to update a saved item.');
  }

  const saved = loadCalculationById(calculation.id);
  if (!saved) {
    return saveCalculation(calculation);
  }

  const nextRecord = {
    ...saved,
    ...sanitizeCalculation(calculation),
    createdAt: saved.createdAt,
    updatedAt: new Date().toISOString(),
  };

  return saveCalculation(nextRecord);
}

export function deleteCalculation(id) {
  if (typeof id !== 'string' || id.trim() === '') {
    return false;
  }

  const allCalculations = loadAllSavedCalculations();
  const kept = allCalculations.filter((item) => item.id !== id);
  const ok = writeStorageValue(STORAGE_KEY, JSON.stringify(kept));
  return ok;
}

export function duplicateCalculation(id) {
  const original = loadCalculationById(id);
  if (!original) {
    return null;
  }

  const duplicateRecord = {
    ...original,
    id: generateCalculationId(),
    name: `${original.name.trim() || 'Untitled Calculation'} Copy`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rows: original.rows.map((row) => ({
      ...row,
      id: generateWardrobeId(),
    })),
  };

  return saveCalculation(duplicateRecord);
}

export function replaceAllCalculations(calculations) {
  const normalized = Array.isArray(calculations)
    ? calculations
        .map((entry) => sanitizeCalculation(entry))
        .filter(Boolean)
    : [];

  const ok = writeStorageValue(STORAGE_KEY, JSON.stringify(normalized));
  if (!ok) {
    throw new Error('Storage is not available, so the backup import could not be completed.');
  }

  return normalized;
}

export function loadSettings() {
  const rawValue = readStorageValue(SETTINGS_KEY);
  const parsed = safeParseJson(rawValue);
  const defaultSettings = {
    displayPrecision: 4,
  };

  if (!parsed || typeof parsed !== 'object') {
    return defaultSettings;
  }

  const precision = Number(parsed.displayPrecision);

  return {
    displayPrecision: Number.isInteger(precision) && precision >= 2 && precision <= 4 ? precision : 4,
  };
}

export function saveSettings(settings) {
  const nextSettings = {
    displayPrecision: Number.isInteger(Number(settings?.displayPrecision)) && Number(settings.displayPrecision) >= 2 && Number(settings.displayPrecision) <= 4
      ? Number(settings.displayPrecision)
      : 4,
  };

  const ok = writeStorageValue(SETTINGS_KEY, JSON.stringify(nextSettings));
  if (!ok) {
    throw new Error('The settings could not be saved because local storage is unavailable.');
  }

  return nextSettings;
}

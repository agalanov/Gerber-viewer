/**
 * validation.ts — Валидация маппинга Gerber-файлов
 *
 * Проверяет:
 * - Наличие обязательных слоёв (outline, copper)
 * - Отсутствие дубликатов маппинга
 * - Корректность данных
 */

import type { GerberFile, LayerMapping, LayerType } from '../types';

/** Результат валидации */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/** Ошибка валидации */
export interface ValidationError {
  code: string;
  message: string;
  fileName?: string;
}

/** Предупреждение валидации */
export interface ValidationWarning {
  code: string;
  message: string;
  fileName?: string;
}

/** Обязательные типы слоёв */
const REQUIRED_LAYER_TYPES: LayerType[] = ['outline', 'copper'];

/**
 * Валидация маппинга файлов
 */
export function validateMapping(
  files: GerberFile[],
  mappings: LayerMapping[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Проверка 1: есть ли файлы
  if (files.length === 0) {
    errors.push({
      code: 'NO_FILES',
      message: 'Не загружено ни одного Gerber-файла',
    });
    return { valid: false, errors, warnings };
  }

  // Проверка 2: все ли файлы имеют маппинг
  for (const file of files) {
    const hasMapping = mappings.some((m) => m.fileName === file.name);
    if (!hasMapping) {
      warnings.push({
        code: 'UNMAPPED_FILE',
        message: `Файл "${file.name}" не имеет маппинга слоя`,
        fileName: file.name,
      });
    }
  }

  // Проверка 3: наличие обязательных слоёв
  const mappedTypes = new Set<LayerType>();
  for (const file of files) {
    mappedTypes.add(file.type);
  }

  for (const required of REQUIRED_LAYER_TYPES) {
    if (!mappedTypes.has(required)) {
      warnings.push({
        code: 'MISSING_REQUIRED_LAYER',
        message: `Отсутствует обязательный слой: ${required}`,
      });
    }
  }

  // Проверка 4: дубликаты имён файлов в маппинге
  const mappingNames = mappings.map((m) => m.fileName);
  const duplicates = mappingNames.filter(
    (name, index) => mappingNames.indexOf(name) !== index
  );
  if (duplicates.length > 0) {
    errors.push({
      code: 'DUPLICATE_MAPPING',
      message: `Обнаружены дубликаты маппинга: ${[...new Set(duplicates)].join(', ')}`,
    });
  }

  // Проверка 5: пустые файлы
  for (const file of files) {
    if (!file.data || file.data.trim().length === 0) {
      errors.push({
        code: 'EMPTY_FILE',
        message: `Файл "${file.name}" пуст`,
        fileName: file.name,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Проверка, является ли строка валидным Gerber-форматом
 * (базовая проверка по наличию Gerber-команд)
 */
export function isValidGerberData(data: string): boolean {
  if (!data || data.trim().length === 0) return false;

  // Gerber-файлы обычно содержат определённые команды
  const gerberPatterns = [
    /^%FS/i,      // Формат
    /^%MO/i,      // Единицы измерения
    /^%ADD/i,     // Определение апертуры
    /^G04/i,      // Комментарий
    /^G75/i,      // Включение апертуры
    /^D\d+/i,     // Команда апертуры
    /^X\d+/i,     // Координата X
    /^M02/i,      // Конец файла
  ];

  const lines = data.split('\n').map((l) => l.trim()).filter(Boolean);

  // Проверяем первые несколько строк на наличие Gerber-команд
  const headLines = lines.slice(0, 20);
  const matchCount = headLines.filter((line) =>
    gerberPatterns.some((p) => p.test(line))
  ).length;

  // Если хотя бы 2 строки похожи на Gerber — считаем валидным
  return matchCount >= 2;
}
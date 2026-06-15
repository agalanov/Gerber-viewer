/**
 * metrics.ts — Вычисление метрик печатной платы
 *
 * Анализирует Gerber-файлы для извлечения:
 * - Размеров платы (из outline-слоя)
 * - Количества слоёв
 * - Минимального диаметра сверла
 * - Количества отверстий
 */

import type { GerberFile, ProjectMetrics } from '../types';

/** Единицы измерения Gerber-файла */
type GerberUnit = 'mm' | 'inch';

/**
 * Вычисление метрик проекта на основе загруженных файлов
 */
export function computeMetrics(files: GerberFile[]): ProjectMetrics {
  const outlineFile = files.find((f) => f.type === 'outline');
  const drillFiles = files.filter((f) => f.type === 'drill');

  const { length, width } = extractBoardDimensions(outlineFile);
  const { minDrill, holesCount } = extractDrillMetrics(drillFiles);

  return {
    length,
    width,
    layersCount: files.length,
    minDrill,
    holesCount,
  };
}

/**
 * Извлечение размеров платы из outline-слоя
 */
function extractBoardDimensions(
  outlineFile?: GerberFile
): { length: number; width: number } {
  if (!outlineFile) {
    return { length: 0, width: 0 };
  }

  const unit = detectUnit(outlineFile.data);
  const coords = extractCoordinates(outlineFile.data);

  if (coords.length === 0) {
    return { length: 0, width: 0 };
  }

  const xs = coords.map((c) => c.x);
  const ys = coords.map((c) => c.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let width = maxX - minX;
  let height = maxY - minY;

  // Конвертация дюймов в мм
  if (unit === 'inch') {
    width *= 25.4;
    height *= 25.4;
  }

  return {
    length: Math.round(height * 100) / 100,
    width: Math.round(width * 100) / 100,
  };
}

/**
 * Извлечение метрик сверления из drill-файлов
 */
function extractDrillMetrics(
  drillFiles: GerberFile[]
): { minDrill: number; holesCount: number } {
  let minDrill = Infinity;
  let holesCount = 0;

  for (const file of drillFiles) {
    const unit = detectUnit(file.data);
    const lines = file.data.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Excellon: T01C0.035 — определение инструмента
      const toolMatch = trimmed.match(/^T\d+C([\d.]+)/i);
      if (toolMatch) {
        let diameter = parseFloat(toolMatch[1]);
        if (unit === 'inch') diameter *= 25.4;
        if (diameter > 0 && diameter < minDrill) {
          minDrill = diameter;
        }
      }

      // Excellon: X...Y... — координата отверстия
      if (/^X[\d.]+Y[\d.]+/i.test(trimmed)) {
        holesCount++;
      }
    }
  }

  return {
    minDrill: minDrill === Infinity ? 0 : Math.round(minDrill * 1000) / 1000,
    holesCount,
  };
}

/**
 * Определение единиц измерения из Gerber-файла
 */
function detectUnit(data: string): GerberUnit {
  const match = data.match(/^%MO(IN|MM)\*/im);
  if (match) {
    return match[1] === 'IN' ? 'inch' : 'mm';
  }
  // По умолчанию — дюймы (стандарт Gerber)
  return 'inch';
}

/**
 * Извлечение координат из Gerber-данных
 */
function extractCoordinates(
  data: string
): Array<{ x: number; y: number }> {
  const coords: Array<{ x: number; y: number }> = [];
  const lines = data.split('\n');

  // Определение формата координат (количество целых и дробных цифр)
  const fsMatch = data.match(/^%FS([LT])?([AX])(\d)(\d)\*/im);
  const decDigits = fsMatch ? parseInt(fsMatch[4], 10) : 4;
  const divisor = Math.pow(10, decDigits);

  for (const line of lines) {
    const trimmed = line.trim();

    // Поиск строк с координатами: X12345Y67890D02*
    const coordMatch = trimmed.match(/^X([\d]+)Y([\d]+)/i);
    if (coordMatch) {
      const x = parseInt(coordMatch[1], 10) / divisor;
      const y = parseInt(coordMatch[2], 10) / divisor;
      coords.push({ x, y });
    }
  }

  return coords;
}
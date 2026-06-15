/**
 * mapping.ts — Логика авто-маппинга Gerber-файлов на слои
 *
 * Определяет тип слоя и сторону платы на основе
 * стандартных соглашений именования Gerber-файлов.
 */

import type { GerberFile, LayerType, BoardSide } from '../types';

/** Паттерны для определения типа слоя */
const TYPE_PATTERNS: Array<{ type: LayerType; patterns: RegExp[] }> = [
  {
    type: 'drill',
    patterns: [
      /\.drl$/i,
      /\.txt$/i,
      /drill/i,
      /hole/i,
      /\.xln$/i,
      /\.exc$/i,
      /ncdrill/i,
    ],
  },
  {
    type: 'copper',
    patterns: [
      /\.g[lL]\d/i,
      /\.gt[lL]/i,
      /\.gb[lL]/i,
      /copper/i,
      /\.cu$/i,
      /signal/i,
      /\.art$/i,
      /cmp/i,
      /sst/i,
      /smt/i,
    ],
  },
  {
    type: 'soldermask',
    patterns: [
      /\.gts/i,
      /\.gbs/i,
      /solder.?mask/i,
      /soldermask/i,
      /solder/i,
      /mask/i,
      /\.sst$/i,
      /\.smt$/i,
      /resists/i,
      /res/i,
    ],
  },
  {
    type: 'silkscreen',
    patterns: [
      /\.gto/i,
      /\.gbo/i,
      /silk.?screen/i,
      /silkscreen/i,
      /silk/i,
      /screen/i,
      /\.plc$/i,
      /legend/i,
      /top silk/i,
      /bot silk/i,
    ],
  },
  {
    type: 'paste',
    patterns: [
      /\.gtp/i,
      /\.gbp/i,
      /paste/i,
      /stencil/i,
      /solder.?paste/i,
      /\.crt$/i,
    ],
  },
  {
    type: 'outline',
    patterns: [
      /\.gko/i,
      /\.gm\d/i,
      /outline/i,
      /edge.?cut/i,
      /board/i,
      /cut/i,
      /rout/i,
      /profile/i,
      /dimension/i,
      /\.gml$/i,
    ],
  },
];

/** Паттерны для определения стороны платы */
const SIDE_PATTERNS: Array<{ side: BoardSide; patterns: RegExp[] }> = [
  {
    side: 'top',
    patterns: [
      /\.gt[lts]/i,
      /\.gto/i,
      /top/i,
      /front/i,
      /cmp/i,
      /component/i,
      /f_/i,
      /_f$/i,
    ],
  },
  {
    side: 'bottom',
    patterns: [
      /\.gb[lts]/i,
      /\.gbo/i,
      /bot/i,
      /bottom/i,
      /sold/i,
      /solder/i,
      /b_/i,
      /_b$/i,
    ],
  },
  {
    side: 'inner',
    patterns: [
      /\.g[lL]\d/i,
      /inner/i,
      /in\d/i,
      /l\d/i,
      /layer/i,
      /mid/i,
    ],
  },
];

/**
 * Авто-определение типа слоя по имени файла
 */
export function detectLayerType(fileName: string): LayerType {
  for (const { type, patterns } of TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(fileName)) {
        return type;
      }
    }
  }
  return 'other';
}

/**
 * Авто-определение стороны платы по имени файла
 */
export function detectBoardSide(fileName: string): BoardSide {
  for (const { side, patterns } of SIDE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(fileName)) {
        return side;
      }
    }
  }
  return 'top';
}

/**
 * Авто-маппинг массива Gerber-файлов
 * Заполняет type, side и order для каждого файла
 */
export function autoMapFiles(files: GerberFile[]): GerberFile[] {
  return files.map((file, index) => ({
    ...file,
    type: detectLayerType(file.name),
    side: detectBoardSide(file.name),
    order: index,
  }));
}

/**
 * Сортировка файлов по типу и стороне для оптимального порядка отрисовки
 */
export function sortFilesByRenderOrder(files: GerberFile[]): GerberFile[] {
  const orderPriority: Record<LayerType, number> = {
    outline: 0,
    copper: 1,
    soldermask: 2,
    paste: 3,
    silkscreen: 4,
    drill: 5,
    other: 6,
  };

  return [...files].sort((a, b) => {
    // Сначала по типу
    const typeDiff = orderPriority[a.type] - orderPriority[b.type];
    if (typeDiff !== 0) return typeDiff;

    // Потом по стороне (top -> bottom -> inner)
    const sideOrder: Record<BoardSide, number> = { top: 0, bottom: 1, inner: 2 };
    return sideOrder[a.side] - sideOrder[b.side];
  });
}
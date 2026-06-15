/**
 * Viewer — WebGL-рендеринг Gerber-файлов через gerbers-renderer
 *
 * Отвечает за:
 * - Распаковку ZIP и извлечение файлов по маппингу
 * - Инициализацию WebGL-контекста через createBoardViewer
 * - Управление видимостью слоёв (панель чекбоксов)
 * - Переключение сторон Top/Bottom
 * - Масштабирование Fit
 * - Извлечение метрик проекта
 */

import type { LayerMapping, ProjectMetrics } from '../types';
import JSZip from 'jszip';

// @ts-expect-error — библиотека gerbers-renderer имеет проблемы с резолвингом типов через package.json "exports"
import { renderGerbersFiles, createBoardViewer } from 'gerbers-renderer';

// ============================================================
//  Локальные типы для gerbers-renderer (реальные типы из библиотеки)
// ============================================================

/** Результат рендеринга Gerber-файлов (из gerbers-renderer) */
interface RenderResult {
  boardGeom: BoardGeom;
  layers: ViewerLayers;
  revoke: () => void;
}

/** Геометрия платы (из gerbers-renderer) */
interface BoardGeom {
  board: {
    width_in: number;
    height_in: number;
    mm_bounds: {
      min_x_mm: number;
      min_y_mm: number;
      max_x_mm: number;
      max_y_mm: number;
    };
  };
}

/** Слои платы (из gerbers-renderer) */
interface ViewerLayers {
  top_copper?: string;
  bottom_copper?: string;
  top_mask?: string;
  bottom_mask?: string;
  top_silk?: string;
  bottom_silk?: string;
  drills?: string;
  vias?: string;
  top_board_mask?: string;
  bottom_board_mask?: string;
  [key: string]: string | undefined;
}

/** BoardViewer API (из gerbers-renderer) */
interface BoardViewer {
  setData: (data: { boardGeom: BoardGeom; layers: ViewerLayers }) => void;
  setSideMode: (side: 'top' | 'bottom') => void;
  fit: () => void;
  dispose: () => void;
}

// ============================================================
//  Viewer
// ============================================================

/** Цвета для слоёв по умолчанию */
const LAYER_COLORS: string[] = [
  '#c97d2d', '#2e7d32', '#f5f5f5', '#78909c',
  '#1a237e', '#ffd54f', '#4fc3f7', '#66bb6a',
  '#ef5350', '#ab47bc', '#26a69a', '#ff7043',
];

export class Viewer {
  private el: HTMLElement;
  private container: HTMLElement | null = null;
  private layersListEl: HTMLElement | null = null;
  private viewer: BoardViewer | null = null;
  private result: RenderResult | null = null;
  private currentSide: 'top' | 'bottom' = 'top';
  private btnTop: HTMLElement | null = null;
  private btnBottom: HTMLElement | null = null;
  private btnFit: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.classList.add('viewer-root');
    this.buildDOM();
  }

  // ============================================================
  //  DOM
  // ============================================================

  /**
   * Построение HTML-структуры вьювера
   */
  private buildDOM(): void {
    this.el.innerHTML = `
      <div class="viewer-toolbar">
        <div class="viewer-layers" id="layersPanel">
          <h4 class="viewer-layers-title">Слои</h4>
          <div class="viewer-layers-list" id="layersList"></div>
        </div>
        <div class="viewer-controls">
          <button id="viewTop" class="viewer-btn viewer-btn--active">Top</button>
          <button id="viewBottom" class="viewer-btn">Bottom</button>
          <button id="fitBtn" class="viewer-btn viewer-btn--fit">Fit</button>
        </div>
      </div>
      <div class="viewer-canvas" id="viewerContainer"></div>
    `;

    this.container = this.el.querySelector('#viewerContainer');
    this.layersListEl = this.el.querySelector('#layersList');
    this.btnTop = this.el.querySelector('#viewTop');
    this.btnBottom = this.el.querySelector('#viewBottom');
    this.btnFit = this.el.querySelector('#fitBtn');

    // Биндинг событий
    this.btnTop?.addEventListener('click', () => this.setSide('top'));
    this.btnBottom?.addEventListener('click', () => this.setSide('bottom'));
    this.btnFit?.addEventListener('click', () => this.fit());
  }

  // ============================================================
  //  Инициализация
  // ============================================================

  /**
   * Инициализация вьювера: распаковка ZIP, рендеринг, создание вьювера
   */
  public async init(
    mapping: LayerMapping[],
    zipBuffer: ArrayBuffer
  ): Promise<ProjectMetrics> {
    if (!this.container) {
      throw new Error('[Viewer] Container element not found');
    }

    // 1. Распаковка ZIP
    const zip = await JSZip.loadAsync(zipBuffer);

    // 2. Извлечение файлов согласно маппингу
    const files: Record<string, Uint8Array> = {};
    for (const m of mapping) {
      const fileEntry = zip.file(m.fileName);
      if (!fileEntry) {
        console.warn(`[Viewer] File not found in ZIP: ${m.fileName}`);
        continue;
      }
      const uint8 = await fileEntry.async('uint8array');
      files[m.fileName] = uint8;
    }

    if (Object.keys(files).length === 0) {
      throw new Error('[Viewer] No files found in ZIP matching the mapping');
    }

    // 3. Рендеринг через gerbers-renderer
    console.log('[Viewer] Rendering files:', Object.keys(files));
    const renderResult = await renderGerbersFiles(files);
    this.result = renderResult;
    console.log('[Viewer] Render result:', {
      boardGeom: renderResult.boardGeom,
      layerKeys: Object.keys(renderResult.layers),
    });

    // 4. Создание вьювера
    this.viewer = createBoardViewer(this.container, {});

    // 5. Передача данных (ВАЖНО: передаём объект { boardGeom, layers }, а не весь result)
    this.viewer!.setData({
      boardGeom: renderResult.boardGeom,
      layers: renderResult.layers,
    });

    // 6. Fit
    this.viewer!.fit();

    // 7. Заполнение панели слоёв
    this.buildLayersPanel();

    // 8. Извлечение метрик
    return this.getMetrics();
  }

  // ============================================================
  //  Панель слоёв
  // ============================================================

  /**
   * Построение панели слоёв с чекбоксами
   */
  private buildLayersPanel(): void {
    if (!this.layersListEl || !this.result) return;

    this.layersListEl.innerHTML = '';

    const layerNames = Object.keys(this.result.layers);
    layerNames.forEach((name, index) => {
      const color = LAYER_COLORS[index % LAYER_COLORS.length];
      const item = document.createElement('label');
      item.className = 'viewer-layer-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.className = 'viewer-layer-checkbox';
      checkbox.addEventListener('change', () => {
        this.setLayerVisibility(name, checkbox.checked);
      });

      const colorDot = document.createElement('span');
      colorDot.className = 'viewer-layer-color';
      colorDot.style.backgroundColor = color;

      const labelText = document.createElement('span');
      labelText.className = 'viewer-layer-name';
      labelText.textContent = name;

      item.appendChild(checkbox);
      item.appendChild(colorDot);
      item.appendChild(labelText);
      this.layersListEl!.appendChild(item);
    });
  }

  /**
   * Установка видимости слоя
   * Примечание: библиотека gerbers-renderer v0.1.0 не предоставляет
   * per-layer visibility через BoardViewer API. Чекбоксы работают
   * только как UI-индикаторы. Полноценное управление видимостью
   * будет добавлено в следующих версиях.
   */
  private setLayerVisibility(layerName: string, visible: boolean): void {
    if (!this.viewer) return;
    console.log(`[Viewer] Layer visibility: ${layerName} = ${visible} (UI only)`);
  }

  // ============================================================
  //  Управление видом
  // ============================================================

  /**
   * Переключение стороны платы
   */
  public setSide(side: 'top' | 'bottom'): void {
    if (!this.viewer) return;
    this.currentSide = side;
    this.viewer.setSideMode(side);

    // Подсветка активной кнопки
    this.btnTop?.classList.toggle('viewer-btn--active', side === 'top');
    this.btnBottom?.classList.toggle('viewer-btn--active', side === 'bottom');
  }

  /**
   * Получить текущую сторону
   */
  public getSide(): 'top' | 'bottom' {
    return this.currentSide;
  }

  /**
   * Подогнать под размер
   */
  public fit(): void {
    this.viewer?.fit();
  }

  // ============================================================
  //  Метрики
  // ============================================================

  /**
   * Извлечение метрик проекта из RenderResult
   */
  public getMetrics(): ProjectMetrics {
    const metrics: ProjectMetrics = {
      length: 0,
      width: 0,
      layersCount: 0,
      minDrill: 0,
      holesCount: 0,
    };

    if (!this.result) return metrics;

    // Габариты из boardGeom
    const boardGeom = this.result.boardGeom;
    if (boardGeom?.board?.mm_bounds) {
      const bounds = boardGeom.board.mm_bounds;
      metrics.width = Math.round((bounds.max_x_mm - bounds.min_x_mm) * 100) / 100;
      metrics.length = Math.round((bounds.max_y_mm - bounds.min_y_mm) * 100) / 100;
    }

    // Количество слоёв
    metrics.layersCount = Object.keys(this.result.layers).length;

    // Drill-статистика — библиотека не предоставляет её через BoardGeom,
    // поэтому holesCount и minDrill остаются 0 (можно добавить позже через парсинг Excellon)
    console.log('[Viewer] Metrics:', metrics);

    return metrics;
  }

  // ============================================================
  //  Canvas / Экспорт
  // ============================================================

  /**
   * Получение canvas-элемента для экспорта
   */
  public getCanvas(): HTMLCanvasElement | null {
    if (!this.container) return null;
    return this.container.querySelector('canvas');
  }

  // ============================================================
  //  Очистка
  // ============================================================

  /**
   * Полное уничтожение вьювера
   */
  public destroy(): void {
    this.viewer?.dispose();
    this.viewer = null;

    if (this.result) {
      this.result.revoke();
      this.result = null;
    }

    this.el.innerHTML = '';
    this.el.classList.remove('viewer-root');
    this.container = null;
    this.layersListEl = null;
    this.btnTop = null;
    this.btnBottom = null;
    this.btnFit = null;
  }
}
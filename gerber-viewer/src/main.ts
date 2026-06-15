/**
 * Gerber Viewer — точка входа SPA
 *
 * Инициализирует приложение:
 * 1. Создаёт Uploader (Drag & Drop загрузка ZIP)
 * 2. После загрузки файлов — создаёт Mapper (таблица маппинга)
 * 3. После применения маппинга — инициализирует Viewer, Summary, Export и Bridge
 */

import './styles/main.css';
import type { ViewerConfig, PostMessagePayload, GerberFile, LayerMapping } from './types';
import { Uploader } from './components/Uploader';
import { Mapper } from './components/Mapper';
import { Viewer } from './components/Viewer';
import { Summary } from './components/Summary';
import { Export } from './components/Export';
import { Bridge } from './components/Bridge';

/** Текущая конфигурация вьювера */
let config: ViewerConfig = {
  theme: 'dark',
  lang: 'ru',
  maxFileSize: 50 * 1024 * 1024, // 50 MB
  showToolbar: true,
};

/** Экземпляры компонентов */
let uploader: Uploader | null = null;
let mapper: Mapper | null = null;
let viewer: Viewer | null = null;
let summary: Summary | null = null;
let exportComp: Export | null = null;
let bridge: Bridge | null = null;

/** DOM-элементы */
let uploaderContainer: HTMLElement | null = null;
let mapperContainer: HTMLElement | null = null;
let viewerContainer: HTMLElement | null = null;
let summaryContainer: HTMLElement | null = null;
let exportContainer: HTMLElement | null = null;
let bridgeContainer: HTMLElement | null = null;

/** Хранилище оригинального zip-файла для Bridge */
let currentZipFile: File | null = null;

/**
 * Инициализация приложения
 */
async function initApp(): Promise<void> {
  const appEl = document.getElementById('app');
  if (!appEl) {
    console.error('[GerberViewer] #app element not found');
    return;
  }

  // Читаем конфигурацию из URL-параметров (для iframe)
  const params = new URLSearchParams(window.location.search);
  if (params.get('theme') === 'light') config.theme = 'light';
  if (params.get('lang') === 'en') config.lang = 'en';
  if (params.get('toolbar') === '0') config.showToolbar = false;

  // Применяем тему
  document.documentElement.setAttribute('data-theme', config.theme ?? 'dark');

  // Создаём структуру приложения
  appEl.innerHTML = `
    <div class="viewer-container">
      <div class="app-header">
        <h1 class="app-title">Gerber Viewer</h1>
      </div>
      <div class="app-body">
        <div class="app-sidebar" id="sidebar">
          <div id="uploaderContainer"></div>
          <div id="mapperContainer" style="display:none"></div>
          <div id="summaryContainer" style="display:none"></div>
          <div id="exportContainer" style="display:none"></div>
          <div id="bridgeContainer" style="display:none"></div>
        </div>
        <div class="app-main" id="mainArea">
          <div id="viewerPlaceholder" class="app-loading">
            <p>Загрузите Gerber-файлы для просмотра</p>
          </div>
          <div id="viewerContainer" style="display:none"></div>
        </div>
      </div>
    </div>
  `;

  uploaderContainer = document.getElementById('uploaderContainer');
  mapperContainer = document.getElementById('mapperContainer');
  summaryContainer = document.getElementById('summaryContainer');
  exportContainer = document.getElementById('exportContainer');
  bridgeContainer = document.getElementById('bridgeContainer');
  viewerContainer = document.getElementById('viewerContainer');

  if (!uploaderContainer || !mapperContainer || !viewerContainer || !summaryContainer || !exportContainer || !bridgeContainer) {
    console.error('[GerberViewer] Required DOM elements not found');
    return;
  }

  // Создаём Uploader
  uploader = new Uploader(uploaderContainer, onFilesLoaded);
  uploader.render();

  // Уведомляем родительское окно о готовности
  notifyParent({ type: 'ready', data: { version: '1.0.0' } });

  console.log('[GerberViewer] App initialized', config);
}

/**
 * Колбэк: файлы загружены — передаём в Mapper, сохраняем буфер ZIP и оригинальный File
 */
function onFilesLoaded(files: GerberFile[], zipBuffer: ArrayBuffer, zipFile?: File): void {
  console.log(`[GerberViewer] Loaded ${files.length} files`);

  if (!mapperContainer || !viewerContainer) return;

  // Сохраняем оригинальный zip-файл для Bridge
  if (zipFile) {
    currentZipFile = zipFile;
  }

  // Показываем контейнер маппера, скрываем заглушку
  mapperContainer.style.display = '';
  viewerContainer.style.display = 'none';

  // Уничтожаем предыдущий Mapper, если был
  if (mapper) {
    mapper.destroy();
  }

  // Создаём новый Mapper с колбэком, который имеет доступ к zipBuffer
  mapper = new Mapper(mapperContainer, (mapping) => {
    onApplyMapping(mapping, zipBuffer);
  });
  mapper.render();
  mapper.setFiles(files);
}

/**
 * Колбэк: маппинг применён — инициализируем Viewer, Summary, Export, Bridge
 */
async function onApplyMapping(mapping: LayerMapping[], zipBuffer: ArrayBuffer): Promise<void> {
  console.log(`[GerberViewer] Mapping applied: ${mapping.length} layers`);

  if (!viewerContainer || !summaryContainer || !exportContainer || !bridgeContainer) return;

  // Показываем контейнер вьювера
  viewerContainer.style.display = '';
  viewerContainer.innerHTML = '';

  // Уничтожаем предыдущий Viewer, если был
  if (viewer) {
    viewer.destroy();
  }

  // Создаём новый Viewer
  viewer = new Viewer(viewerContainer);

  try {
    // Инициализация вьювера
    const metrics = await viewer.init(mapping, zipBuffer);

    // --- Summary ---
    summaryContainer.style.display = '';
    if (!summary) {
      summary = new Summary(summaryContainer);
    }
    summary.render();
    summary.setMetrics(metrics);

    // --- Export ---
    exportContainer.style.display = '';
    if (!exportComp) {
      exportComp = new Export(exportContainer);
    }
    exportComp.render();

    // Передаём canvas из Viewer в Export
    const canvas = viewer.getCanvas();
    if (canvas) {
      exportComp.setCanvas(canvas);
    }

    // --- Bridge ---
    bridgeContainer.style.display = '';
    if (!bridge) {
      bridge = new Bridge(bridgeContainer);
    }
    bridge.render();
    bridge.setViewer(() => viewer!.getMetrics());
    if (currentZipFile) {
      bridge.setZipFile(currentZipFile);
    }
    bridge.enable();

    // Уведомляем родительское окно о метриках
    notifyParent({
      type: 'metrics',
      data: {
        layersCount: metrics.layersCount,
        length: metrics.length,
        width: metrics.width,
        minDrill: metrics.minDrill,
        holesCount: metrics.holesCount,
        mappings: mapping.map((m) => ({
          fileName: m.fileName,
          layerId: m.layerId,
          visible: m.visible,
        })),
      },
    });
  } catch (err) {
    console.error('[GerberViewer] Viewer init failed:', err);
    viewerContainer.innerHTML = `
      <div class="app-loading">
        <p>Ошибка инициализации вьювера: ${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
}

/**
 * Отправка сообщения в родительское окно (WordPress)
 */
function notifyParent(payload: PostMessagePayload): void {
  if (window.parent !== window) {
    window.parent.postMessage(payload, '*');
  }
}

// Экспорт для отладки из консоли
export { config, initApp, notifyParent, uploader, mapper, viewer, summary, exportComp, bridge };

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch((err) => {
    console.error('[GerberViewer] Init failed:', err);
  });
});
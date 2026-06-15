# API-документация: `gerbers-renderer`

> **Версия:** 1.1.6  
> **Репозиторий:** [github.com/asappcb/gerbers-renderer](https://github.com/asappcb/gerbers-renderer)  
> **NPM:** [npmjs.com/package/gerbers-renderer](https://www.npmjs.com/package/gerbers-renderer)  
> **Демо:** [asappcb.github.io/gerbers-renderer](https://asappcb.github.io/gerbers-renderer/)  
> **Лицензия:** MIT

---

## 1. Установка

```bash
npm install gerbers-renderer
```

Пакет имеет единственную зависимость — [`jszip`](https://www.npmjs.com/package/jszip) (для распаковки ZIP).  
Для поддержки RAR требуется дополнительный файл `libarchive.js` (см. раздел 3.2).

---

## 2. Импорт (ESM / CJS)

Пакет опубликован как **ESM-модуль** (`"type": "module"` в `package.json`), но также предоставляет UMD-сборку.

| Формат | Путь |
|--------|------|
| ESM (рекомендуется) | `import { ... } from "gerbers-renderer"` → `./dist/gerbers-renderer.es.js` |
| CJS / UMD | `const { ... } = require("gerbers-renderer")` → `./dist/gerbers-renderer.umd.js` |
| CDN (jsDelivr) | `https://cdn.jsdelivr.net/npm/gerbers-renderer/dist/gerbers-renderer.umd.js` |
| CDN (unpkg) | `https://unpkg.com/gerbers-renderer/dist/gerbers-renderer.umd.js` |

**TypeScript**: декларации типов находятся в `./dist/index.d.ts`.

```typescript
// ESM
import { renderGerbers, createIntegratedViewer } from "gerbers-renderer";

// CJS
const { renderGerbers, createIntegratedViewer } = require("gerbers-renderer");
```

---

## 3. Рендеринг Gerber-файлов

### 3.1. `renderGerbers(input, options?)` — главная функция

```typescript
function renderGerbers(
  input: ArrayBuffer | Uint8Array,
  options?: {
    archiveWorkerUrl?: string; // требуется для .rar
  }
): Promise<RenderResult>;
```

**Параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `input` | `ArrayBuffer \| Uint8Array` | Содержимое ZIP/RAR-архива с Gerber-файлами |
| `options.archiveWorkerUrl` | `string` (опц.) | URL до `libarchive-worker-bundle.js` (обязателен для `.rar`) |

**Что делает:**
1. Определяет тип архива (ZIP/RAR)
2. Распаковывает файлы
3. Классифицирует слои (топ/боттом, медь/маска/шёлк)
4. Парсит Gerber и Excellon drill файлы
5. Возвращает готовые данные для вьювера

**Возвращает:** `Promise<RenderResult>`

```typescript
type RenderResult = {
  boardGeom: BoardGeom;   // геометрия платы
  layers: ViewerLayers;   // распознанные слои (blob URL-ы)
  revoke: () => void;     // освободить blob URL-ы
};
```

> ⚠️ **Важно:** Всегда вызывайте `result.revoke()` при замене рендера, чтобы избежать утечки памяти.

---

### 3.2. `renderGerbersZip(input)` — только ZIP

```typescript
function renderGerbersZip(
  input: File | Blob | ArrayBuffer | Uint8Array
): Promise<RenderResult>;
```

Упрощённая обёртка для ZIP-архивов. Не требует `archiveWorkerUrl`.

---

### 3.3. `renderGerbersFiles(files)` — низкоуровневый API

```typescript
function renderGerbersFiles(
  files: Record<string, Uint8Array>
): Promise<RenderResult>;
```

Используется, когда файлы уже распакованы. Ключи — имена файлов, значения — их содержимое.

---

### 3.4. Поддержка RAR

Для `.rar` архивов требуется хостинг `libarchive-worker-bundle.js`:

```bash
# Скопировать из node_modules
cp node_modules/libarchive.js/dist/worker-bundle.js public/libarchive-worker-bundle.js
```

```typescript
const buffer = await file.arrayBuffer();
const result = await renderGerbers(buffer, {
  archiveWorkerUrl: "/libarchive-worker-bundle.js",
});
```

---

### 3.5. Поддерживаемые форматы

| Формат | Статус | Механизм |
|--------|--------|----------|
| `.zip` | ✅ | JSZip (нативный) |
| `.rar` | ✅ | libarchive.js (WASM) |
| `.7z` | ❌ (детекция работает) | — |
| `.tar` | ❌ (детекция работает) | — |
| Директория (файлы) | ✅ | `renderGerbersFiles()` |

---

## 4. Типы возвращаемых данных

### 4.1. `BoardGeom` — геометрия платы

```typescript
type BoardGeom = {
  board: {
    width_in: number;       // ширина в дюймах
    height_in: number;      // высота в дюймах
    mm_bounds: {
      min_x_mm: number;
      min_y_mm: number;
      max_x_mm: number;
      max_y_mm: number;
    };
  };
};
```

**Метрики, которые можно получить:**
- **Габариты платы в мм:** `boardGeom.board.mm_bounds.max_x_mm - boardGeom.board.mm_bounds.min_x_mm` (ширина), `boardGeom.board.mm_bounds.max_y_mm - boardGeom.board.mm_bounds.min_y_mm` (высота)
- **Габариты в дюймах:** `boardGeom.board.width_in`, `boardGeom.board.height_in`

### 4.2. `ViewerLayers` — распознанные слои

```typescript
type ViewerLayers = Partial<{
  top_copper: string;       // верхний слой меди (blob URL)
  bottom_copper: string;    // нижний слой меди (blob URL)
  top_mask: string;         // верхняя паяльная маска
  bottom_mask: string;      // нижняя паяльная маска
  top_silk: string;         // верхний шёлк
  bottom_silk: string;      // нижний шёлк
  drills: string;           // сверловка (Excellon)
  vias: string;             // переходные отверстия
  top_board_mask: string;   // верхняя маска платы
  bottom_board_mask: string; // нижняя маска платы
}>;
```

**Количество слоёв:** `Object.keys(layers).length` — покажет, сколько слоёв было распознано.

---

## 5. Детекция Gerber-бандла

### 5.1. `detectGerberBundle(input)`

```typescript
function detectGerberBundle(
  input: ArrayBuffer | Uint8Array | Record<string, Uint8Array>
): Promise<GerberDetectResult>;
```

Позволяет проверить, является ли входной файл Gerber-бандлом, **до** попытки рендеринга.

```typescript
type GerberDetectResult = {
  isGerber: boolean;                    // true, если это Gerber-бандл
  archiveType: GerberBundleType;        // тип архива
  confidence: number;                   // 0.0 – 1.0
  reasons: string[];                    // причины заключения
  files?: string[];                     // список файлов (если распознан)
};

type GerberBundleType =
  | "zip" | "rar" | "7z" | "tar"
  | "directory" | "single-file" | "unknown";
```

### 5.2. `listGerberFiles(input)`

```typescript
function listGerberFiles(
  input: ArrayBuffer | Uint8Array | Record<string, Uint8Array>
): Promise<GerberFileListResult>;
```

Возвращает список распознанных слоёв без полного рендеринга.

```typescript
type GerberFileListResult = {
  layers: ListedLayer[];
  boardOutlinePresent: boolean;
  drillPresent: boolean;
};

type ListedLayer = {
  filename: string;
  type: "copper" | "mask" | "silk" | "drill" | "outline" | "unknown";
  side?: "top" | "bottom" | "inner";
};
```

---

## 6. Integrated Viewer (`createIntegratedViewer`)

### 6.1. Создание вьювера

```typescript
function createIntegratedViewer(
  host: HTMLElement,
  opts?: IntegratedViewerOptions
): IntegratedViewerAPI;
```

```typescript
type IntegratedViewerOptions = {
  onDownload?: () => void;          // колбэк при нажатии кнопки Download
  showDownloadButton?: boolean;     // показать/скрыть кнопку Download (по умолч. true)
};
```

### 6.2. Возвращаемый API

```typescript
type IntegratedViewerAPI = {
  // Установка данных платы
  setData: (data: {
    boardGeom: BoardGeom;
    layers: ViewerLayers;
  }) => void;

  // Переключение стороны (топ/боттом)
  setSideMode: (mode: ViewerSideMode) => void;

  // Автоматическое масштабирование под размер контейнера
  fit: () => void;

  // Уничтожение вьювера (очистка ресурсов)
  dispose: () => void;

  // Доступ к базовому Viewer (см. раздел 7)
  viewer: Viewer;

  // Управление видимостью слоёв
  visibility: VisibilityManager;

  // Реестр оверлеев
  overlayRegistry: OverlayRegistry;

  // Рендерер маркеров
  markerRenderer: MarkerRenderer;

  // Установка выделенной области
  setSelection: (selection: Selection | null) => void;

  // Добавление/удаление маркеров
  addMarker: (marker: Marker) => void;
  removeMarker: (id: string) => void;
};
```

### 6.3. Полный пример использования

```typescript
import { createIntegratedViewer, renderGerbers } from "gerbers-renderer";

// 1. Создать вьювер
const viewer = createIntegratedViewer(
  document.getElementById("pcb-container")!,
  {
    showDownloadButton: false,
  }
);

// 2. Загрузить файл
const file = inputElement.files[0];
const buffer = await file.arrayBuffer();
const result = await renderGerbers(buffer);

// 3. Передать данные во вьювер
viewer.setData({
  boardGeom: result.boardGeom,
  layers: result.layers,
});

// 4. Масштабировать
viewer.fit();

// 5. Освободить blob URL-ы (после того, как вьювер их скопировал)
result.revoke();

// 6. Переключить сторону
viewer.setSideMode("bottom");
```

---

## 7. Класс `Viewer` (базовый)

Доступен через `integratedViewer.viewer`.

### 7.1. Управление камерой

```typescript
// Установить камеру
viewer.setCamera(camera: Partial<CameraState>): void;

// Получить текущее состояние камеры
viewer.getCamera(): Required<CameraState>;

type CameraState = {
  center_mm: Vec2;        // центр в мм
  zoom: number;           // пикселей на мм
  rotation_rad?: number;  // поворот в радианах
  mirrorX?: boolean;      // отражение по X
  mirrorY?: boolean;      // отражение по Y
};

type Vec2 = { x: number; y: number };
```

### 7.2. Преобразование координат

```typescript
// Из мм в пиксели экрана
viewer.boardToScreen(boardX: number, boardY: number): Vec2;

// Из пикселей экрана в мм
viewer.screenToBoard(screenX: number, screenY: number): Vec2;
```

### 7.3. Управление видимостью

```typescript
// Установить видимость Gerber-слоя
viewer.setGerberVisibility(
  layer: keyof VisibilityState['gerber'],
  visible: boolean
): void;

// Установить видимость оверлея
viewer.setOverlayVisibility(id: string, visible: boolean): void;

// Включить/выключить маркеры
viewer.setMarkersVisibility(visible: boolean): void;

// Переключить слой
viewer.toggleGerberLayer(layer: keyof VisibilityState['gerber']): void;
viewer.toggleOverlay(id: string): void;
viewer.toggleMarkers(): void;

// Применить пресет
viewer.applyVisibilityPreset(
  preset: 'all' | 'none' | 'copper-only' | 'minimal'
): void;

// Получить состояние видимости
viewer.getVisibility(): VisibilityState;

// Подписаться на изменения видимости
viewer.onVisibilityChange(
  callback: (state: VisibilityState) => void
): () => void; // возвращает функцию отписки
```

```typescript
type VisibilityState = {
  gerber: {
    copper: boolean;
    solderMask: boolean;
    silk: boolean;
    outline: boolean;
  };
  overlays: Record<string, boolean>;
  markers: boolean;
};
```

### 7.4. Управление маркерами

```typescript
// Добавить маркер
viewer.addMarker(marker: Marker): void;

// Добавить несколько маркеров (эффективнее)
viewer.addMarkers(markers: Marker[]): void;

// Обновить маркер
viewer.updateMarker(id: string, updates: Partial<Marker>): void;

// Удалить маркер
viewer.removeMarker(id: string): void;

// Получить маркер по ID
viewer.getMarker(id: string): Marker | undefined;

// Список всех маркеров
viewer.listMarkers(): Marker[];

// Очистить все маркеры
viewer.clearMarkers(): void;

// Пикер маркеров (клик по координатам экрана)
viewer.pickMarker(
  x_px: number,
  y_px: number,
  pickRadius_px?: number  // радиус захвата (по умолч. 4px)
): MarkerHit | null;

// Выбрать маркер
viewer.selectMarker(
  id: string | null,
  opts?: { center?: boolean; animate?: boolean }
): void;

// Получить выбранный маркер
viewer.getSelectedMarker(): Marker | null;

// Состояние выбора/наведения
viewer.getMarkerState(): {
  selectedId: string | null;
  hoverId: string | null;
};
```

```typescript
type Marker = {
  id: string;
  x_mm: number;
  y_mm: number;
  layer?: "top" | "bottom";
  severity?: "error" | "warning" | "info";
  radius_mm?: number;
  data?: Record<string, any>;
};

type MarkerHit = {
  id: string;
  marker: Marker;
  distance_px: number;
};
```

### 7.5. Управление оверлеями

```typescript
// Добавить слой оверлея
viewer.addOverlayLayer(overlay: Overlay): void;

// Удалить оверлей
viewer.removeOverlay(id: string): void;

// Получить реестр оверлеев
viewer.getOverlayRegistry(): OverlayRegistry;

// Получить API оверлеев
viewer.getOverlayApi(): OverlayApi;
```

```typescript
type Overlay = {
  id: string;
  zIndex: number;
  visible: boolean;
  drawInWorldSpace?: boolean;  // true = мм, false = px
  draw: (ctx: CanvasRenderingContext2D, api: OverlayApi) => void;
  onAdd?: (api: OverlayApi) => void;
  onRemove?: () => void;
};
```

### 7.6. Render Passes

```typescript
// Добавить кастомный render pass
viewer.addPass(pass: RenderPass): void;

// Удалить pass
viewer.removePass(id: string): boolean;

// Получить pass по ID
viewer.getPass(id: string): RenderPass | undefined;

// Запросить перерендер
viewer.requestRender(reason: string): void;

// Принудительный рендер
viewer.render(): void;
```

```typescript
type RenderPass = {
  id: string;
  order: number;  // 0-99: Gerber, 100-199: Overlays, 200-299: Markers, 300-399: Selection
  enabled: (rc: RenderCtx) => boolean;
  draw: (rc: RenderCtx) => void;
};
```

### 7.7. События

```typescript
// Подписка на события
viewer.on<K extends keyof ViewerEvents>(
  event: K,
  cb: (payload: ViewerEvents[K]) => void
): Unsubscribe;

// Одноразовая подписка
viewer.once<K extends keyof ViewerEvents>(
  event: K,
  cb: (payload: ViewerEvents[K]) => void
): Unsubscribe;

// Отписка
viewer.off<K extends keyof ViewerEvents>(
  event: K,
  cb: (payload: ViewerEvents[K]) => void
): void;

// Инициализация обработчиков мыши (вызвать один раз)
viewer.setupEventListeners(): void;
```

```typescript
type ViewerEvents = {
  "hover:marker": {
    markerId: string | null;
    marker?: Marker;
  };
  "select:marker": {
    markerId: string | null;
    marker?: Marker;
  };
  "click:board": {
    x_mm: number;
    y_mm: number;
  };
  "view:change": {
    center_mm: { x: number; y: number };
    zoom: number;
    rotation_rad: number;
  };
};
```

### 7.8. Отладка

```typescript
viewer.getDebugInfo(): {
  passes: { id: string; order: number; enabled: boolean }[];
  pendingRender: boolean;
  pendingReasons: string[];
  camera: Required<CameraState>;
  visibility: VisibilityState;
};
```

---

## 8. Встроенные оверлеи

```typescript
import {
  createViolationDotsOverlay,
  createTooltipOverlay,
  createGridOverlay,
  createPulsingMarkerOverlay,
} from "gerbers-renderer";

// Сетка с шагом 1мм
viewer.addOverlayLayer(createGridOverlay(1));

// Точки нарушений (DFM)
viewer.addOverlayLayer(createViolationDotsOverlay());

// Анимированный маркер
viewer.addOverlayLayer(
  createPulsingMarkerOverlay({ x_mm: 25, y_mm: 30 })
);

// Тултип
viewer.addOverlayLayer(
  createTooltipOverlay(() => getCurrentHover())
);
```

---

## 9. `OverlayApi` — API для оверлеев

```typescript
type OverlayApi = {
  // Конвертация координат
  boardToScreen: (p: { x_mm: number; y_mm: number }) => { x_px: number; y_px: number };
  screenToBoard: (p: { x_px: number; y_px: number }) => { x_mm: number; y_mm: number };

  // Состояние вьюпорта
  getViewState: () => {
    center_mm: { x: number; y: number };
    zoom: number;
    rotation_rad: number;
  };

  // Размер канваса
  getViewport: () => { width_px: number; height_px: number };

  // Границы платы
  getBoardBounds: () => {
    minX_mm: number;
    minY_mm: number;
    maxX_mm: number;
    maxY_mm: number;
  };

  // Запрос перерендера
  requestRender: (reason: string) => void;
};
```

---

## 10. `OverlayRegistry` — реестр оверлеев

```typescript
class OverlayRegistry {
  add(overlay: Overlay): void;
  remove(id: string): Overlay | undefined;
  get(id: string): Overlay | undefined;
  setVisible(id: string, visible: boolean): void;
  setZIndex(id: string, zIndex: number): void;
  list(): Overlay[];
  getSortedVisible(): Overlay[];
}
```

---

## 11. `VisibilityManager` — управление видимостью

```typescript
class VisibilityManager {
  constructor(initialState?: Partial<VisibilityState>);

  getState(): VisibilityState;
  setState(updates: Partial<VisibilityState>): void;
  setGerberVisibility(layer: keyof VisibilityState['gerber'], visible: boolean): void;
  setOverlayVisibility(overlayId: string, visible: boolean): void;
  setMarkersVisibility(visible: boolean): void;
  toggleGerberLayer(layer: keyof VisibilityState['gerber']): void;
  toggleOverlay(overlayId: string): void;
  toggleMarkers(): void;
  subscribe(listener: (state: VisibilityState) => void): () => void;
  isGerberLayerVisible(layer: keyof VisibilityState['gerber']): boolean;
  isOverlayVisible(overlayId: string): boolean;
  areMarkersVisible(): boolean;
  applyPreset(preset: 'all' | 'none' | 'copper-only' | 'minimal'): void;
}
```

---

## 12. Обработка ошибок

```typescript
import { GerberError } from "gerbers-renderer";

class GerberError extends Error {
  code:
    | "NOT_AN_ARCHIVE"       // не архив
    | "UNSUPPORTED_ARCHIVE"  // неподдерживаемый тип архива
    | "NOT_GERBER"           // не Gerber-файл
    | "MISSING_LAYERS"       // не найдены слои
    | "PARSE_ERROR";         // ошибка парсинга
  details?: unknown;
}
```

Пример обработки:

```typescript
try {
  const result = await renderGerbers(buffer);
} catch (err) {
  if (err instanceof GerberError) {
    switch (err.code) {
      case "NOT_AN_ARCHIVE":
        showError("Файл не является архивом");
        break;
      case "UNSUPPORTED_ARCHIVE":
        showError("Неподдерживаемый формат архива");
        break;
      case "NOT_GERBER":
        showError("В архиве нет Gerber-файлов");
        break;
      case "MISSING_LAYERS":
        showError("Не удалось распознать слои");
        break;
      case "PARSE_ERROR":
        showError("Ошибка парсинга Gerber");
        break;
    }
  }
}
```

---

## 13. Экспорт в PNG

Пакет не предоставляет специального метода для экспорта в PNG, но это можно сделать через стандартный Canvas API, так как `Viewer` использует `HTMLCanvasElement`:

```typescript
// Получить canvas из вьювера
const canvas = viewer.viewer['canvas']; // приватное поле, но доступно

// Альтернатива: если есть доступ к контейнеру
const canvas = document.querySelector('#pcb-container canvas') as HTMLCanvasElement;

// Экспорт в PNG
const dataUrl = canvas.toDataURL('image/png');

// Скачать
const link = document.createElement('a');
link.download = 'board.png';
link.href = dataUrl;
link.click();
```

> **Примечание:** Поле `canvas` в классе `Viewer` — приватное (`private canvas`). Для полноценного экспорта PNG потребуется либо модификация библиотеки, либо доступ к DOM-элементу `<canvas>` внутри контейнера вьювера.

---

## 14. Получение метрик платы

### Габариты платы

```typescript
const bounds = result.boardGeom.board.mm_bounds;
const widthMm = bounds.max_x_mm - bounds.min_x_mm;
const heightMm = bounds.max_y_mm - bounds.min_y_mm;
const widthIn = result.boardGeom.board.width_in;
const heightIn = result.boardGeom.board.height_in;
```

### Количество слоёв

```typescript
const layerCount = Object.keys(result.layers).length;
```

### Минимальный диаметр отверстий

Пакет не предоставляет прямой функции для получения статистики по отверстиям.  
Однако тип `DrillHole` определён в `pcb-model.d.ts`:

```typescript
type DrillHole = {
  x: number;
  y: number;
  diameter: number;   // диаметр в мм
  plated: boolean;    // металлизированное
};
```

Для получения drill-статистики потребуется либо:
- Использовать внутренние API (`PcbModelGeometry.drills`)
- Либо реализовать парсинг Excellon-файла из `result.layers.drills`

---

## 15. `ViewportTransform` — трансформация координат

```typescript
import { ViewportTransform } from "gerbers-renderer";

const transform = new ViewportTransform(
  { center_mm: { x: 50, y: 25 }, zoom: 10 },
  { width_px: 800, height_px: 600 }
);

// мм → px
const screenPos = transform.boardToScreen({ x: 10, y: 5 });

// px → мм
const boardPos = transform.screenToBoard({ x: 400, y: 300 });

// Установить камеру
transform.setCamera({ center_mm: { x: 0, y: 0 }, zoom: 5 });

// Установить вьюпорт
transform.setViewport({ width_px: 1024, height_px: 768 });

// Получить матрицы трансформации
const worldToScreen = transform.getWorldToScreenMatrix(); // Mat3
const screenToWorld = transform.getScreenToWorldMatrix(); // Mat3
```

---

## 16. `RenderScheduler` — планировщик рендера

```typescript
class RenderScheduler {
  constructor(onFrame: (reasons: string[]) => void);
  requestRender(reason?: string): void;
  isPending(): boolean;
  getPendingReasons(): string[];
}
```

---

## 17. `MarkerStore` и `MarkerPicker` — внутренние компоненты

```typescript
class MarkerStore {
  clear(): void;
  addMany(markers: Marker[]): void;
  add(marker: Marker): void;
  updateMany(partials: (Partial<Marker> & { id: string })[]): void;
  remove(id: string): void;
  get(id: string): Marker | undefined;
  list(): Marker[];
  queryNear(x_mm: number, y_mm: number, radius_mm: number): Marker[];
}

class MarkerPicker {
  constructor(store: MarkerStore);
  pick(rc: RenderCtx, x_px: number, y_px: number, pickRadius_px?: number): MarkerHit | null;
}
```

---

## 18. `Emitter` — система событий

```typescript
type Unsubscribe = () => void;

class Emitter<EventMap extends Record<string, any>> {
  on<K extends keyof EventMap>(event: K, cb: (payload: EventMap[K]) => void): Unsubscribe;
  once<K extends keyof EventMap>(event: K, cb: (payload: EventMap[K]) => void): Unsubscribe;
  off<K extends keyof EventMap>(event: K, cb: (payload: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
  clear(): void;
}
```

---

## 19. Внутренние утилиты (IO)

```typescript
// Распаковка архива
function unpackGerberArchive(
  input: ArrayBuffer | Uint8Array,
  init?: { workerUrl?: string }
): Promise<UnpackResult>;

type UnpackResult = {
  archiveType: "zip" | "rar";
  files: Record<string, Uint8Array>;
};

// Распаковка ZIP
function unzipGerbersZip(input: File | Blob | ArrayBuffer): Promise<ZipEntry[]>;

// Классификация файлов
function classifyFiles(
  entries: ZipEntry[],
  hints?: LayerHints
): ClassifiedFiles;

// Классификация имён слоёв
function classifyLayerNames(names: string[]): Classified;

// Нормализация текста
function normalizeGerberText(raw: string): string;
function normalizeDrillText(raw: string): string;
```

---

## 20. Резюме: что экспортирует пакет

| Экспорт | Тип | Описание |
|---------|-----|----------|
| `renderGerbers` | функция | Главный рендеринг (ZIP/RAR) |
| `renderGerbersZip` | функция | Рендеринг только ZIP |
| `renderGerbersFiles` | функция | Рендеринг из готовых файлов |
| `detectGerberBundle` | функция | Детекция Gerber-бандла |
| `listGerberFiles` | функция | Список слоёв без рендеринга |
| `createIntegratedViewer` | функция | Создание вьювера |
| `GerberError` | класс | Типизированная ошибка |
| `Viewer` | класс | Базовый вьювер |
| `ViewportTransform` | класс | Трансформация координат |
| `RenderScheduler` | класс | Планировщик рендера |
| `VisibilityManager` | класс | Управление видимостью |
| `OverlayRegistry` | класс | Реестр оверлеев |
| `MarkerStore` | класс | Хранилище маркеров |
| `MarkerRenderer` | класс | Рендерер маркеров |
| `MarkerPicker` | класс | Пикер маркеров |
| `Emitter` | класс | Система событий |
| `SelectionRenderer` | класс | Рендерер выделения |
| `createGerberPass` | функция | Создание Gerber pass |
| `createSelectionPass` | функция | Создание selection pass |
| `createOverlayPass` | функция | Создание overlay pass |
| `createMarkerPass` | функция | Создание marker pass |
| `createViolationDotsOverlay` | функция | Оверлей точек нарушений |
| `createTooltipOverlay` | функция | Оверлей тултипа |
| `createGridOverlay` | функция | Оверлей сетки |
| `createPulsingMarkerOverlay` | функция | Анимированный маркер |
| `UniformGridIndex` | класс | Пространственный индекс |
| `RenderResult` | тип | Результат рендеринга |
| `BoardGeom` | тип | Геометрия платы |
| `ViewerLayers` | тип | Слои платы |
| `ViewerSideMode` | тип | `"top" \| "bottom"` |
| `Marker` | тип | Маркер |
| `MarkerHit` | тип | Результат пика маркера |
| `Overlay` | тип | Оверлей |
| `OverlayApi` | тип | API оверлея |
| `RenderCtx` | тип | Контекст рендера |
| `RenderPass` | тип | Render pass |
| `VisibilityState` | тип | Состояние видимости |
| `CameraState` | тип | Состояние камеры |
| `Viewport` | тип | Вьюпорт |
| `Vec2` | тип | 2D-вектор |
| `Mat3` | тип | Матрица 3x3 |
| `ViewerEvents` | тип | События вьювера |
| `Selection` | тип | Выделение |
| `OverlayHelpers` | тип | Хелперы оверлея |
| `IntegratedViewerOptions` | тип | Опции integrated viewer |
| `Unsubscribe` | тип | Функция отписки |
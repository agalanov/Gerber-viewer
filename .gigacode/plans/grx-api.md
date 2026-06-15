# Исследование Gerber-вьюверов для браузера

> **Дата:** 2026-06-15
> **Цель:** Выбор библиотеки для отображения Gerber-файлов в браузерном Gerber-вьювере

---

## 1. Пакет `@tsalvo/grx` — НЕ ДОСТУПЕН

### Статус

| Параметр | Значение |
|----------|----------|
| **npm** | `@tsalvo/grx` — страница существует на npmjs.com, но пакет **не найден в registry** (404) |
| **GitHub** | Пользователь `tsalvo` существует, но репозитория `grx` нет |
| **Codeberg** | Пользователь `tsalvo` существует, репозитория `grx` нет |
| **Поисковики** | Не индексируется (0 результатов в DuckDuckGo, Google) |
| **CDN** | unpkg, jsdelivr, esm.sh — все 404 |
| **npm install** | `npm install @tsalvo/grx` — 404 Not Found |

**Вывод:** Пакет `@tsalvo/grx` недоступен для использования. Возможно, был удалён (unpublished) или является приватным.

---

## 2. Альтернатива: `gerbers-renderer` (рекомендуется)

> **npm:** [`gerbers-renderer`](https://www.npmjs.com/package/gerbers-renderer)
> **GitHub:** [asappcb/gerbers-renderer](https://github.com/asappcb/gerbers-renderer)
> **Лицензия:** MIT
> **Описание:** Pure frontend Gerber rendering for the web. Render PCB Gerber bundles (`.zip`, `.rar`) directly in the browser with zero backend, zero native dependencies.

### 2.1 Установка

```bash
npm install gerbers-renderer
```

### 2.2 Импорт

```typescript
import {
  createIntegratedViewer,
  renderGerbers,
  renderGerbersZip,
  renderGerbersFiles,
  detectGerberBundle,
  GerberError,
} from "gerbers-renderer";
```

### 2.3 Быстрый старт

```typescript
import { createIntegratedViewer, renderGerbers } from "gerbers-renderer";

// 1. Создать вьювер в DOM-контейнере
const viewer = createIntegratedViewer(document.getElementById("pcb")!);

// 2. Загрузить Gerber-файл (zip-архив)
const file = input.files[0];
const buffer = await file.arrayBuffer();

// 3. Отрендерить
const result = await renderGerbers(buffer);

// 4. Передать данные во вьювер
viewer.setData({
  boardGeom: result.boardGeom,
  layers: result.layers,
});
viewer.fit();

// 5. Очистка blob URL при замене
// result.revoke();
```

### 2.4 Основные API

#### Рендеринг

| Функция | Описание |
|---------|----------|
| `renderGerbers(input, options?)` | Высокоуровневый entrypoint. Определяет архив, распаковывает, валидирует и рендерит |
| `renderGerbersZip(input)` | Для ZIP-файлов (обёртка) |
| `renderGerbersFiles(files)` | Низкоуровневый API — принимает `Record<string, Uint8Array>` |

**Параметры `renderGerbers`:**

- `input: ArrayBuffer | Uint8Array`
- `options.archiveWorkerUrl?: string` — требуется только для `.rar`

**Возвращает:**

```typescript
type RenderResult = {
  boardGeom: BoardGeom;      // геометрия платы
  layers: ViewerLayers;      // слои для отображения
  revoke: () => void;        // отозвать blob URL
};
```

#### Вьювер

```typescript
const viewer = createIntegratedViewer(container, {
  onDownload?: () => void;        // колбэк при клике Download
  showDownloadButton?: boolean;   // показывать кнопку (по умолч. true)
});

// Управление данными
viewer.setData({ boardGeom, layers });

// Переключение стороны
viewer.setSideMode("top" | "bottom");

// Масштабирование
viewer.fit();

// Камера
viewer.viewer.setCamera({ center_mm: { x: 50, y: 25 }, zoom: 10 });

// Очистка
viewer.dispose();
```

#### Управление слоями

```typescript
// Видимость слоёв — через выпадающий список (dropdown) встроенный
// Программное управление:
viewer.visibility.setOverlayVisibility("grid", true);   // показать/скрыть сетку
viewer.visibility.setMarkersVisibility(false);           // показать/скрыть маркеры
```

#### Маркеры (DFM-аннотации)

```typescript
viewer.addMarker({
  id: "via-too-close",
  x_mm: 12.5,
  y_mm: 8.3,
  severity: "error",     // "error" | "warning" | "info"
  data: { issue: "Via too close to trace" },
});

viewer.addMarkers([...]);
viewer.removeMarker("via-too-close");
```

#### Детекция Gerber-бандла

```typescript
import { detectGerberBundle } from "gerbers-renderer";

const result = await detectGerberBundle(buffer);
if (!result.isGerber) console.log("Not a Gerber bundle:", result.reasons);
// result: { isGerber, archiveType, confidence, reasons, files? }
```

### 2.5 Поддерживаемые форматы

| Формат | Поддержка | Примечания |
|--------|-----------|------------|
| `.zip` | ✅ Нативно (JSZip) | |
| `.rar` | ✅ Через libarchive.js (WASM worker) | Требуется `archiveWorkerUrl` |
| `.7z` | ❌ | Детекция работает |
| `.tar` | ❌ | Детекция работает |
| Директория | ✅ | Через `renderGerbersFiles` |

### 2.6 Возможности рендеринга

- Арки/кривые (G02/G03 с I/J, полные окружности, CW/CCW)
- Поворот падов (`%LR` и per-aperture rotation)
- Обрезка по контуру платы (non-rectangular boards)
- Soldermask слои (top/bottom, polarity-correct)
- Drill holes с визуализацией медного кольца
- Slot holes (Excellon M15/M16/G01, G85 oblong)
- Внутренние медные слои (>2 слоёв, KiCad и Altium naming)
- Silkscreen слои
- Canvas-based render pipeline с аппаратным ускорением
- Плавный pan/zoom с центровкой по мыши
- Переключение Top/Bottom
- Per-layer visibility dropdown
- Сетка (mm/in)
- Система маркеров для DFM-аннотаций
- Система оверлеев для кастомных визуализаций

### 2.7 Обработка ошибок

```typescript
class GerberError extends Error {
  code:
    | "NOT_AN_ARCHIVE"
    | "UNSUPPORTED_ARCHIVE"
    | "NOT_GERBER"
    | "MISSING_LAYERS"
    | "PARSE_ERROR";
  details?: any;
}
```

### 2.8 Web Workers

- **Не требует** Web Workers для ZIP-файлов
- **Требует** Web Worker (`libarchive.js`) только для `.rar`:
  ```text
  node_modules/libarchive.js/dist/worker-bundle.js
    → public/libarchive-worker-bundle.js
  ```
  ```typescript
  renderGerbers(buffer, { archiveWorkerUrl: "/libarchive-worker-bundle.js" });
  ```

### 2.9 Экспорт в PNG

Встроенной функции экспорта canvas в PNG нет, но можно использовать стандартный `canvas.toBlob()`:

```typescript
const canvas = document.querySelector("canvas"); // или получить из viewer
canvas.toBlob((blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "board.png";
  a.click();
}, "image/png");
```

### 2.10 Метрики платы

Метрики (габариты, количество слоёв и т.д.) можно получить из `result.boardGeom` и `result.layers`:

```typescript
const result = await renderGerbers(buffer);
// boardGeom — геометрия платы (размеры, форма)
// layers — объект со слоями (количество, имена, типы)
```

---

## 3. Альтернатива: `wasm-gerber-renderer`

> **npm:** [`wasm-gerber-renderer`](https://www.npmjs.com/package/wasm-gerber-renderer)
> **GitHub:** [dsafdsaf132/wasm-gerber-viewer](https://github.com/dsafdsaf132/wasm-gerber-viewer)
> **Лицензия:** MIT
> **Описание:** WebGL2 Gerber renderer powered by Rust/WASM. Поддерживает браузер и Node.js (PNG через headless WebGL2).

### 3.1 Установка

```bash
npm install wasm-gerber-renderer
```

### 3.2 Браузерное использование

```typescript
import { renderGerberToCanvas, createGerberRenderer } from "wasm-gerber-renderer";

// Простой вариант — один слой
const canvas = document.querySelector("canvas");
const gerber = await file.text();
await renderGerberToCanvas(canvas, gerber, {
  background: "#05070c",
  padding: 24,
});

// Продвинутый вариант — несколько слоёв
const renderer = await createGerberRenderer(canvas);
await renderer.withFrame({ width: 1200, height: 800, padding: 24 }, async () => {
  await renderer.renderLayers([
    { source: topCopper, color: [1, 0, 0] },
    { source: bottomCopper, color: [0, 0.7, 1], alpha: 0.8 },
  ]);
});
```

### 3.3 Node.js / CLI

```bash
npm install -g wasm-gerber-renderer node-gles-webgl2
gerber-renderer board.gbr --width 1200 --height 800 --background '#05070c'
```

### 3.4 Особенности

- **WebGL2** — аппаратное ускорение через WASM
- **WASM** — парсер и рендерер на Rust
- **Node.js** — рендеринг в PNG через headless WebGL2
- **CLI** — встроенная утилита командной строки
- **Не требует** Web Workers

---

## 4. Сравнение библиотек

| Критерий | `gerbers-renderer` | `wasm-gerber-renderer` |
|----------|-------------------|----------------------|
| **Рендеринг** | Canvas (2D) | WebGL2 (3D/WASM) |
| **Архитектура** | Чистый JS/TS | Rust → WASM |
| **Входные данные** | ZIP/RAR архивы | Отдельные файлы |
| **Авто-детекция слоёв** | ✅ (KiCad, Altium, Eagle) | ❌ (ручное указание) |
| **Встроенный viewer** | ✅ (`createIntegratedViewer`) | ❌ (только canvas) |
| **Управление слоями** | ✅ (dropdown, visibility) | ❌ (ручное) |
| **Маркеры/аннотации** | ✅ | ❌ |
| **Сетка** | ✅ | ❌ |
| **Pan/Zoom** | ✅ (встроенный) | ❌ (нужно реализовать) |
| **Node.js** | ❌ | ✅ (PNG, CLI) |
| **CLI** | ❌ | ✅ |
| **Web Workers** | Для `.rar` | Не требует |
| **Размер бандла** | Меньше | Больше (WASM) |
| **Сложность интеграции** | Низкая | Средняя |

---

## 5. Рекомендация

Для Gerber-вьювера рекомендуется **`gerbers-renderer`** как основная библиотека:

1. **Готовый viewer** — `createIntegratedViewer` даёт полноценный вьювер с pan/zoom, управлением слоями, сеткой
2. **Авто-детекция слоёв** — поддерживает KiCad, Altium, Eagle из коробки
3. **Простая интеграция** — минимум кода для запуска
4. **Zero backend** — всё в браузере
5. **Активная разработка** — чёткий roadmap

`wasm-gerber-renderer` может быть полезен как дополнительный инструмент для:
- Node.js/CLI рендеринга (CI/CD, превью)
- Высокопроизводительного WebGL2 рендеринга (если потребуется)
- Экспорта в PNG на серверной стороне

---

## 6. Что нужно реализовать поверх `gerbers-renderer`

Для полноценного Gerber-вьювера потребуется:

1. **Загрузка файлов** — выбор `.zip`/`.rar` архива через file input или drag-and-drop
2. **Метрики платы** — извлечение размеров из `boardGeom`, количества слоёв из `layers`
3. **Экспорт PNG** — через `canvas.toBlob()` или `canvas.toDataURL()`
4. **Web Workers** — не требуются (только для `.rar` нужен libarchive worker)
5. **Управление слоями** — встроенный dropdown + программное `viewer.visibility`
6. **Переключение Top/Bottom** — `viewer.setSideMode("top" | "bottom")`
7. **Кастомные цвета слоёв** — через опции рендеринга
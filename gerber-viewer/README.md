# Gerber Viewer

SPA для просмотра Gerber-файлов в браузере. Встраивается в WordPress через iframe. Вся обработка выполняется на клиенте, без отправки данных на сервер.

## Назначение

Gerber Viewer позволяет пользователю:
1. **Загрузить ZIP-архив** с Gerber-файлами через Drag & Drop
2. **Настроить маппинг** слоёв (сторона, тип, порядок)
3. **Просмотреть плату** в WebGL-рендерере с поддержкой слоёв, переключением Top/Bottom и Fit
4. **Получить сводку** проекта (габариты, количество слоёв, отверстия)
5. **Экспортировать** текущий вид в PNG (1200 DPI)
6. **Передать данные** в родительский калькулятор WordPress через postMessage

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                 WordPress (родитель)              │
│  ┌───────────────────────────────────────────┐   │
│  │  iframe                                    │   │
│  │  ┌─────────────────────────────────────┐   │   │
│  │  │  Gerber Viewer SPA                   │   │   │
│  │  │  ┌──────────┐  ┌──────────┐         │   │   │
│  │  │  │ Uploader │→│  Mapper  │         │   │   │
│  │  │  │ (JSZip)  │  │ (валидация)        │   │   │
│  │  │  └──────────┘  └────┬─────┘         │   │   │
│  │  │                     ↓                │   │   │
│  │  │  ┌────────────────────────────────┐  │   │   │
│  │  │  │  Viewer (gerbers-renderer)     │  │   │   │
│  │  │  │  ┌──────────┐ ┌───────────┐    │  │   │   │
│  │  │  │  │ Summary  │ │  Export   │    │  │   │   │
│  │  │  │  └──────────┘ └───────────┘    │  │   │   │
│  │  │  └────────────────────────────────┘  │   │   │
│  │  │              ↓                       │   │   │
│  │  │  ┌──────────┐                        │   │   │
│  │  │  │  Bridge  │── postMessage ──────→  │   │   │
│  │  │  └──────────┘                        │   │   │
│  │  └─────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │  gerber-viewer-bridge.js                   │   │
│  │  (заполняет поля калькулятора,             │   │
│  │   передаёт файл в CF7)                     │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

Коммуникация между iframe и родительским окном осуществляется через `window.postMessage()`.

## Технологии

| Технология | Назначение |
|---|---|
| [gerbers-renderer](https://www.npmjs.com/package/gerbers-renderer) | WebGL-рендеринг Gerber-файлов |
| [JSZip](https://stuk.github.io/jszip/) | Распаковка ZIP-архивов (в Web Worker) |
| [Vite](https://vitejs.dev/) | Сборщик и dev-сервер |
| [TypeScript](https://www.typescriptlang.org/) | Типизация |
| [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) | Инлайнинг всех ресурсов в один HTML |

## Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Сборка production
npm run build

# Предпросмотр собранного проекта
npm run preview
```

Результат сборки — единый HTML-файл в `dist/index.html` (благодаря `vite-plugin-singlefile`), готовый для встраивания в WordPress через iframe.

## Структура проекта

```
gerber-viewer/
├── index.html                        # Точка входа SPA
├── package.json                      # Зависимости и скрипты
├── tsconfig.json                     # Настройки TypeScript
├── vite.config.ts                    # Конфигурация Vite
├── README.md                         # Этот файл
├── src/
│   ├── main.ts                       # Инициализация приложения, DI
│   ├── types/
│   │   └── index.ts                  # TypeScript типы и интерфейсы
│   ├── styles/
│   │   └── main.css                  # Все стили (CSS-переменные, layout, компоненты)
│   ├── components/
│   │   ├── Uploader.ts               # Drag & Drop загрузка ZIP + Web Worker
│   │   ├── Mapper.ts                 # Таблица маппинга слоёв с валидацией
│   │   ├── Viewer.ts                 # WebGL-рендеринг через gerbers-renderer
│   │   ├── Summary.ts                # Сводка проекта (габариты, слои, отверстия)
│   │   ├── Export.ts                 # Экспорт текущего вида в PNG
│   │   └── Bridge.ts                 # postMessage коммуникация с WordPress
│   ├── utils/
│   │   ├── mapping.ts                # Авто-определение типа и стороны слоя
│   │   ├── validation.ts             # Валидация маппинга
│   │   └── metrics.ts                # Вычисление метрик платы
│   └── workers/
│       └── zip-worker.ts             # Web Worker для распаковки ZIP
├── wp-integration/
│   ├── gerber-viewer-bridge.js       # JS-сниппет для WordPress
│   └── README.md                     # Инструкция по интеграции
└── dist/
    └── index.html                    # Собранный SPA-файл
```

## Описание компонентов

### Uploader (`src/components/Uploader.ts`)
- Drag & Drop зона загрузки
- Валидация расширения файла (.zip)
- Распаковка ZIP в Web Worker (`zip-worker.ts`) через JSZip
- Отображение прогресса распаковки
- Авто-маппинг загруженных файлов через `autoMapFiles()`
- Передача файлов и буфера в Mapper

### Mapper (`src/components/Mapper.ts`)
- Таблица со всеми загруженными файлами
- Выпадающие списки для выбора стороны (Top/Bottom/Inner), типа (Copper/Soldermask/etc.) и порядка слоя
- Drag & Drop для изменения порядка строк
- Валидация с подсветкой конфликтов (два файла на один слой)
- Кнопка "Применить маппинг"

### Viewer (`src/components/Viewer.ts`)
- Инициализация WebGL-контекста через `gerbers-renderer`
- Распаковка ZIP и передача файлов в рендерер
- Панель слоёв с чекбоксами видимости
- Кнопки переключения Top/Bottom
- Кнопка Fit для масштабирования
- Извлечение метрик проекта (габариты, количество слоёв, отверстия)

### Summary (`src/components/Summary.ts`)
- Отображение габаритов платы (Длина × Ширина в мм)
- Количество слоёв меди
- Минимальный диаметр отверстия
- Количество отверстий

### Export (`src/components/Export.ts`)
- Кнопка "Сохранить как PNG"
- Создание временного canvas с разрешением ×4 (~1200 DPI)
- Скачивание через динамическую ссылку

### Bridge (`src/components/Bridge.ts`)
- Кнопка "Рассчитать стоимость"
- Сбор метрик из Viewer и оригинального zip-файла из Uploader
- Отправка данных в родительское окно через `window.parent.postMessage()`
- Формат: `{ type: 'GERBER_DATA', payload: { zipFile, length, width, layersCount, minDrill } }`

## Интеграция с WordPress

### 1. Сборка и размещение

```bash
npm run build
```

Скопируйте `dist/index.html` в директорию WordPress, например:
```
/wp-content/uploads/gerber-viewer/index.html
```

### 2. Iframe на странице

```html
<iframe
  src="/wp-content/uploads/gerber-viewer/index.html"
  id="gerberViewer"
  style="width:100%; border:0;"
></iframe>
```

### 3. Подключение JS-сниппета

Скопируйте `wp-integration/gerber-viewer-bridge.js` в тему WordPress и подключите:

```php
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_script(
    'gerber-viewer-bridge',
    get_template_directory_uri() . '/js/gerber-viewer-bridge.js',
    [],
    '1.0.0',
    true
  );
});
```

### 4. Параметры iframe

- `?theme=light` — светлая тема
- `?lang=en` — английский язык
- `?toolbar=0` — скрыть тулбар

## Настройка селекторов в JS-сниппете

В файле `wp-integration/gerber-viewer-bridge.js` настройте `CONFIG.selectors` под вашу тему:

```javascript
selectors: {
  lengthInput: '#board-length',        // Поле "Длина платы"
  widthInput: '#board-width',          // Поле "Ширина платы"
  layerButtons: '.layers-selector button', // Кнопки слоёв
  drillButtons: '.drill-selector button',  // Кнопки диаметра
  calculatorScroll: '#calculator',     // Элемент для скролла
  cf7FileInput: '.wpcf7-file',         // Поле file в CF7
}
```

Подробнее — в [`wp-integration/README.md`](wp-integration/README.md).

## Примечания

- **Вся обработка на клиенте.** Gerber-файлы не отправляются на сервер. Распаковка ZIP выполняется в Web Worker, рендеринг — через WebGL.
- **Web Workers.** Распаковка ZIP происходит в фоновом потоке (`zip-worker.ts`), что предотвращает блокировку UI при больших архивах.
- **Единый HTML.** Благодаря `vite-plugin-singlefile` весь проект собирается в один HTML-файл, что упрощает деплой.
- **postMessage.** Для интеграции с WordPress используется `window.parent.postMessage()`. Родительское окно получает метрики платы и оригинальный zip-файл.
- **Совместимость.** Поддерживаются все современные браузеры (Chrome, Firefox, Safari, Edge). Требуется поддержка WebGL и ES2020.
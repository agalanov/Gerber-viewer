# Gerber Viewer

SPA для просмотра Gerber-файлов в браузере. Встраивается в WordPress через iframe. Вся обработка выполняется на клиенте, без отправки данных на сервер.

## Технологии

- **Vite** — сборщик
- **TypeScript** — типизация
- **gerbers-renderer** — WebGL-рендеринг Gerber-файлов
- **JSZip** — распаковка ZIP-архивов

## Структура проекта

```
gerber-viewer/
├── public/
│   └── index.html              # Точка входа SPA
├── src/
│   ├── main.ts                 # Инициализация приложения
│   ├── components/
│   │   ├── Uploader.ts         # Drag & Drop + JSZip
│   │   ├── Mapper.ts           # Таблица маппинга
│   │   ├── Viewer.ts           # gerbers-renderer WebGL
│   │   ├── Summary.ts          # Сводка проекта
│   │   ├── Export.ts           # Экспорт PNG
│   │   └── Bridge.ts           # postMessage коммуникация
│   ├── workers/
│   │   └── zip-worker.ts       # Web Worker для распаковки
│   ├── utils/
│   │   ├── mapping.ts          # Логика авто-маппинга
│   │   ├── validation.ts       # Валидация маппинга
│   │   └── metrics.ts          # Вычисление метрик
│   ├── types/
│   │   └── index.ts            # TypeScript типы
│   └── styles/
│       └── main.css            # Стили
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Разработка

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Сборка
npm run build

# Предпросмотр собранного проекта
npm run preview
```

## Сборка

Результат сборки — единый HTML-файл в `dist/` (благодаря `vite-plugin-singlefile`), готовый для встраивания в WordPress через iframe.

## Параметры iframe

- `?theme=light` — светлая тема
- `?lang=en` — английский язык
- `?toolbar=0` — скрыть тулбар

## Коммуникация с родительским окном

Вьювер отправляет сообщения через `window.parent.postMessage()`:

- `{ type: 'ready', data: { version } }` — готов к работе
- `{ type: 'metrics', data: { ... } }` — метрики платы
- `{ type: 'error', data: { message } }` — ошибка
- `{ type: 'export', data: { dataUrl } }` — экспорт PNG
- `{ type: 'resize', data: { width, height } }` — изменение размера
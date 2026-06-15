# План разработки: Онлайн Gerber-viewer (SPA) для WordPress

## 1. Обзор архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│                    WordPress Страница                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  iframe: /wp-content/uploads/gerber-viewer/index.html │   │
│  │  ┌────────────────────────────────────────────────┐   │   │
│  │  │  Gerber Viewer SPA (Vite + GRX + JSZip)        │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐   │   │   │
│  │  │  │ Uploader │ │ Mapper   │ │ GRX Canvas    │   │   │   │
│  │  │  │ Drag&Drop│ │ Table    │ │ WebGL Render  │   │   │   │
│  │  │  │ .zip     │ │ Mapping  │ │ Top/Bottom    │   │   │   │
│  │  │  └──────────┘ └──────────┘ └───────────────┘   │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐   │   │   │
│  │  │  │ Project  │ │ Export   │ │ postMessage   │   │   │   │
│  │  │  │ Summary  │ │ PNG      │ │ Bridge        │   │   │   │
│  │  │  └──────────┘ └──────────┘ └───────────────┘   │   │   │
│  │  └────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Калькулятор (существующий)               │   │
│  │  Длина: [___]  Ширина: [___]  Слои: [1|2|4|6]      │   │
│  │  Мин.диам.: [0.3|0.2|0.15]  Цена: [____]           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Contact Form 7 (существующая)                 │   │
│  │  Имя: [___]  Email: [___]  Файл: [Выберите файл]    │   │
│  │  [Отправить]                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  JS-сниппет: window.addEventListener('message', handler)    │
│  ← получает данные от iframe → заполняет калькулятор + CF7 │
└─────────────────────────────────────────────────────────────┘
```

## 2. Коммуникация (postMessage API)

```
┌── iframe (Gerber Viewer) ──────┐     ┌── Parent Window (WP) ────────┐
│                                 │     │                              │
│  "Рассчитать стоимость"         │     │  window.addEventListener(    │
│       │                        │     │    'message', (e) => {       │
│       ▼                        │     │    if(e.data.type ===        │
│  postMessage({                  │     │       'GERBER_DATA') {       │
│    type: 'GERBER_DATA',         │     │      // 1. Заполнить поля   │
│    payload: {                   │────►│        калькулятора          │
│      zipFile: File,             │     │      // 2. Передать файл    │
│      length: 85.3,             │     │        в CF7                 │
│      width: 52.1,              │     │      // 3. scrollIntoView    │
│      layersCount: 4,           │     │    }                         │
│      minDrill: 0.3             │     │  })                          │
│    }                            │     │                              │
│  })                             │     │                              │
└─────────────────────────────────┘     └──────────────────────────────┘
```

## 3. Компоненты SPA (Vite + Vanilla TS / React)

### 3.1 Uploader (Загрузчик)
- Drag & Drop зона + кнопка "Выбрать файл"
- Приём `.zip` файла
- Распаковка через `JSZip` в памяти браузера
- Отображение списка распакованных файлов с иконками типов (Gerber, Excellon, BOM, CPL)
- **Web Worker** для распаковки больших архивов (до 100MB)

### 3.2 Mapper (Таблица маппинга)
- Автоматическое определение назначения слоёв по имени файла:
  - `.GTL` / `.gtl` → Top Layer (Copper, L1)
  - `.GBL` / `.gbl` → Bottom Layer (Copper, Ln)
  - `.GTO` / `.gto` → Top Overlay (Silkscreen)
  - `.GTS` / `.gts` → Top Solder Mask
  - `.GKO` / `.gko` → Outline
  - `.TXT` / `.drl` → Drill (Excellon)
  - и т.д.
- Таблица с колонками: Имя файла | Сторона (Top/Bottom/Inner/Drill) | Тип (Copper/Mask/Silkscreen/Outline/Drill) | Порядок (L1, L2...) | Статус
- Drag & Drop строк для изменения порядка внутренних слоёв
- Ручная правка через выпадающие списки
- Валидация: подсветка конфликтов (дубликаты), предупреждения о пропусках

### 3.3 GRX Canvas (WebGL-рендер)
- Инициализация GRX с отмапленными файлами
- Панель управления:
  - Чекбоксы видимости слоёв
  - Переключатель Top/Bottom (с зеркалированием)
  - Цветовая схема: зелёная маска, ENIG-золото, светло-коричневый текстолит
- Зум и панорамирование (встроено в GRX)

### 3.4 Project Summary (Сводка)
- Габариты платы (Д × Ш мм) — из Outline или bounding box
- Количество слоёв меди
- Минимальный диаметр отверстия
- Количество отверстий
- Лог предупреждений парсера

### 3.5 Export (Экспорт PNG)
- Кнопка "Сохранить как PNG"
- Рендер canvas в высоком разрешении (~1200 dpi)
- Скачивание файла

### 3.6 PostMessage Bridge
- Кнопка "Рассчитать стоимость"
- Отправка данных в родительское окно

## 4. JS-сниппет для родительской страницы

```javascript
// Встраивается в шаблон WordPress или через кастомный плагин
window.addEventListener('message', function(e) {
  if (e.data.type !== 'GERBER_DATA') return;
  
  const { zipFile, length, width, layersCount, minDrill } = e.data.payload;
  
  // 1. Заполнение калькулятора
  const lengthInput = document.querySelector('...');
  const widthInput = document.querySelector('...');
  // ... подстановка значений + dispatchEvent(new Event('input'))
  
  // 2. Выбор слоёв
  const layerButtons = document.querySelectorAll('...');
  // ... программный клик по нужной кнопке
  
  // 3. Выбор мин. диаметра
  const drillButtons = document.querySelectorAll('...');
  // ... округление вверх + программный клик
  
  // 4. Передача файла в CF7
  const fileInput = document.querySelector('...');
  const dt = new DataTransfer();
  dt.items.add(zipFile);
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  // 5. Скролл к калькулятору
  document.querySelector('...').scrollIntoView({ behavior: 'smooth' });
});
```

## 5. Структура проекта

```
gerber-viewer/
├── public/
│   └── index.html          # Точка входа SPA
├── src/
│   ├── main.ts             # Инициализация приложения
│   ├── components/
│   │   ├── Uploader.ts     # Drag & Drop + JSZip
│   │   ├── Mapper.ts       # Таблица маппинга
│   │   ├── Viewer.ts       # GRX Canvas + WebGL
│   │   ├── Summary.ts      # Сводка проекта
│   │   ├── Export.ts       # Экспорт PNG
│   │   └── Bridge.ts       # postMessage коммуникация
│   ├── workers/
│   │   └── zip-worker.ts   # Web Worker для распаковки
│   ├── utils/
│   │   ├── mapping.ts      # Логика авто-маппинга
│   │   ├── validation.ts   # Валидация маппинга
│   │   └── metrics.ts      # Вычисление метрик
│   ├── types/
│   │   └── index.ts        # TypeScript типы
│   └── styles/
│       └── main.css        # Стили
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md

wp-integration/
├── gerber-viewer-bridge.js  # JS-сниппет для WordPress
└── README.md                # Инструкция по интеграции
```

## 6. Этапы реализации

### Этап 1: Исследование и настройка
- [ ] Изучить API библиотеки GRX (npm-пакет)
- [ ] Создать Vite + TypeScript проект
- [ ] Подключить зависимости: GRX, JSZip
- [ ] Настроить Web Workers

### Этап 2: Uploader + Mapper
- [ ] Реализовать Drag & Drop зону
- [ ] Распаковка .zip через JSZip (с Web Worker)
- [ ] Автоматический маппинг файлов по расширениям
- [ ] Таблица маппинга с ручной правкой
- [ ] Валидация и подсветка ошибок

### Этап 3: GRX Viewer
- [ ] Инициализация GRX с отмаппированными файлами
- [ ] Панель управления слоями (чекбоксы)
- [ ] Переключатель Top/Bottom
- [ ] Цветовая схема (зелёная маска, ENIG, текстолит)

### Этап 4: Метрики и экспорт
- [ ] Вычисление габаритов платы
- [ ] Парсинг Excellon для метрик сверловки
- [ ] Сводка проекта
- [ ] Экспорт PNG в высоком разрешении

### Этап 5: Интеграция с WordPress
- [ ] postMessage Bridge (отправка данных)
- [ ] JS-сниппет для родительской страницы
- [ ] Интеграция с калькулятором (заполнение полей)
- [ ] Интеграция с Contact Form 7 (DataTransfer)
- [ ] Скролл к калькулятору

### Этап 6: Сборка и документация
- [ ] Финальная сборка SPA (Vite build)
- [ ] README.md с инструкциями
- [ ] Инструкция по размещению на WordPress
- [ ] Тестирование с реальными Gerber-архивами

## 7. Зависимости

```json
{
  "dependencies": {
    "@tsalvo/grx": "^latest",
    "jszip": "^3.10.1"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x",
    "vite-plugin-singlefile": "^latest"
  }
}
```

## 8. Примечания

- **Никакой отправки на сервер** — всё в памяти браузера
- **iframe изоляция** — SPA работает в iframe, общается через postMessage
- **Web Worker** — для архивов > 50MB, чтобы не блокировать UI
- **GRX API** — уточняется после изучения пакета
- **Селекторы калькулятора и CF7** — будут добавлены после получения HTML от заказчика
# Gerber Viewer — интеграция с WordPress

## Установка

### 1. Разместите файлы воркера

Скопируйте содержимое папки `dist/` (после сборки) в директорию вашего WordPress-сайта, например:

```
/wp-content/uploads/gerber-viewer/
├── index.html
├── assets/
│   ├── index-*.js
│   └── index-*.css
```

### 2. Вставьте iframe на страницу

Добавьте следующий код в нужное место шаблона страницы или через произвольный HTML-блок (Gutenberg):

```html
<iframe
  src="/wp-content/uploads/gerber-viewer/index.html"
  id="gerberViewer"
  style="width:100%; border:0;"
></iframe>
```

### 3. Подключите JS-сниппет

Скопируйте файл `gerber-viewer-bridge.js` в вашу тему (например, в `/wp-content/themes/your-theme/js/`) и подключите в `functions.php`:

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

Или вставьте содержимое скрипта напрямую через произвольный HTML-блок перед закрывающим `</body>`.

## Настройка селекторов

Скрипт использует конфигурацию `CONFIG.selectors` в начале файла `gerber-viewer-bridge.js`. Настройте селекторы под вашу тему:

| Селектор | Описание | Пример |
|---|---|---|
| `lengthInput` | Поле "Длина платы" | `#board-length` |
| `widthInput` | Поле "Ширина платы" | `#board-width` |
| `layersContainer` | Контейнер с кнопками слоёв | `.layers-selector` |
| `layerButtons` | Кнопки выбора слоёв (1, 2, 4, 6) | `.layers-selector button` |
| `drillContainer` | Контейнер с кнопками диаметра | `.drill-selector` |
| `drillButtons` | Кнопки выбора диаметра | `.drill-selector button` |
| `calculatorScroll` | Элемент для скролла после расчёта | `#calculator` |
| `cf7FileInput` | Поле загрузки файла в Contact Form 7 | `.wpcf7-file` |

### Соответствие слоёв

По умолчанию маппинг слоёв:

```javascript
layerMap: {
  1: '1',
  2: '2',
  4: '4',
  6: '6'
}
```

Если в вашем калькуляторе используются другие значения, измените `layerMap`.

### Доступные диаметры

```javascript
drillValues: [0.15, 0.2, 0.3, 0.35, 0.4, 0.5, 0.6, 0.8, 1.0]
```

Скрипт автоматически выбирает ближайший больший диаметр из списка. Если минимальный диаметр отверстия в Gerber-файле — 0.25 мм, будет выбран 0.3 мм.

## Исключение из кэширования

Чтобы iframe корректно работал, исключите директорию воркера из кэширования:

### WP Rocket

Добавьте в **Настройки → WP Rocket → Кэширование → Исключённые файлы/URL**:

```
/wp-content/uploads/gerber-viewer/
```

### W3 Total Cache

Добавьте в **Performance → Page Cache → Never cache the following pages**:

```
/wp-content/uploads/gerber-viewer/
```

### LiteSpeed Cache

Добавьте в **LiteSpeed Cache → Cache → Excludes → Do Not Cache URIs**:

```
/wp-content/uploads/gerber-viewer/
```

### Autoptimize

Добавьте в **Настройки → Autoptimize → JavaScript → Исключить скрипты**:

```
gerber-viewer
```

## Проверка работы

1. Откройте страницу с iframe
2. Загрузите Gerber-файл в воркере
3. Нажмите кнопку **"Рассчитать стоимость"**
4. Поля калькулятора должны заполниться автоматически
5. Файл должен передаться в Contact Form 7 (если настроен)

В консоли браузера должно появиться сообщение:

```
✅ Gerber Viewer Bridge: слушатель postMessage активирован
```

## Формат данных postMessage

При нажатии кнопки **"Рассчитать стоимость"** воркер отправляет родительскому окну:

```javascript
{
  type: 'GERBER_DATA',
  payload: {
    zipFile: File,        // оригинальный .zip файл
    length: number,       // мм
    width: number,        // мм
    layersCount: number,  // количество слоёв меди
    minDrill: number      // мм, минимальный диаметр отверстия
  }
}
```

## Требования

- WordPress 5.0+
- Современный браузер (Chrome, Firefox, Safari, Edge)
- Contact Form 7 (опционально, для передачи файла)
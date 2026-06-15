/**
 * Gerber Viewer Bridge — интеграция с калькулятором и Contact Form 7
 *
 * Установка:
 * 1. Разместите iframe на странице: <iframe src="/wp-content/uploads/gerber-viewer/index.html" id="gerberViewer" style="width:100%;border:0;"></iframe>
 * 2. Вставьте этот скрипт в шаблон страницы или через кастомный плагин
 * 3. Настройте селекторы под вашу тему
 */

(function() {
  'use strict';

  var CONFIG = {
    // ⚙️ НАСТРОЙТЕ СЕЛЕКТОРЫ ПОД ВАШУ ТЕМУ
    selectors: {
      // Калькулятор
      lengthInput: '#board-length',        // Селектор поля "Длина платы"
      widthInput: '#board-width',          // Селектор поля "Ширина платы"
      layersContainer: '.layers-selector', // Контейнер с кнопками выбора слоёв
      layerButtons: '.layers-selector button', // Кнопки слоёв (1, 2, 4, 6)
      drillContainer: '.drill-selector',   // Контейнер с кнопками выбора диаметра
      drillButtons: '.drill-selector button', // Кнопки диаметра (0.3, 0.2, 0.15)
      calculatorScroll: '#calculator',     // Элемент, к которому скроллить

      // Contact Form 7
      cf7FileInput: '.wpcf7-file',         // Поле file в CF7
    },

    // Соответствие количества слоёв значениям в калькуляторе
    layerMap: {
      1: '1',
      2: '2',
      4: '4',
      6: '6'
    },

    // Доступные значения минимального диаметра (должны быть отсортированы по возрастанию)
    drillValues: [0.15, 0.2, 0.3, 0.35, 0.4, 0.5, 0.6, 0.8, 1.0]
  };

  // Слушаем сообщения от iframe
  window.addEventListener('message', function(e) {
    // Проверяем источник (опционально — можно указать конкретный origin)
    // if (e.origin !== 'https://your-site.com') return;

    if (!e.data || e.data.type !== 'GERBER_DATA') return;

    var payload = e.data.payload;
    var zipFile = payload.zipFile;
    var length = payload.length;
    var width = payload.width;
    var layersCount = payload.layersCount;
    var minDrill = payload.minDrill;
    var sel = CONFIG.selectors;

    // 1. Заполняем поля калькулятора
    var lengthEl = document.querySelector(sel.lengthInput);
    var widthEl = document.querySelector(sel.widthInput);

    if (lengthEl) {
      lengthEl.value = length.toFixed(2);
      lengthEl.dispatchEvent(new Event('input', { bubbles: true }));
      lengthEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (widthEl) {
      widthEl.value = width.toFixed(2);
      widthEl.dispatchEvent(new Event('input', { bubbles: true }));
      widthEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 2. Выбираем количество слоёв
    var layerBtns = document.querySelectorAll(sel.layerButtons);
    var targetLayers = CONFIG.layerMap[layersCount] || String(layersCount);
    layerBtns.forEach(function(btn) {
      if (btn.textContent.trim() === targetLayers || btn.value === targetLayers) {
        btn.click();
      }
    });

    // 3. Выбираем минимальный диаметр (округляем вверх)
    var drillBtns = document.querySelectorAll(sel.drillButtons);
    var selectedDrill = null;
    for (var i = 0; i < CONFIG.drillValues.length; i++) {
      if (CONFIG.drillValues[i] >= minDrill) {
        selectedDrill = CONFIG.drillValues[i];
        break;
      }
    }
    if (selectedDrill === null) {
      selectedDrill = CONFIG.drillValues[CONFIG.drillValues.length - 1];
    }

    drillBtns.forEach(function(btn) {
      var btnVal = parseFloat(btn.textContent.trim() || btn.value);
      if (Math.abs(btnVal - selectedDrill) < 0.001) {
        btn.click();
      }
    });

    // 4. Передаём файл в Contact Form 7
    var fileInput = document.querySelector(sel.cf7FileInput);
    if (fileInput && zipFile) {
      var dt = new DataTransfer();
      dt.items.add(zipFile);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 5. Скролл к калькулятору
    var scrollTarget = document.querySelector(sel.calculatorScroll);
    if (scrollTarget) {
      setTimeout(function() {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  });

  console.log('✅ Gerber Viewer Bridge: слушатель postMessage активирован');
})();
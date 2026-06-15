/**
 * Export — Экспорт текущего вида в PNG с высоким разрешением
 *
 * Принимает canvas из Viewer, создаёт временный canvas
 * с увеличенным разрешением (ширина × 4, высота × 4 для ~1200 DPI),
 * копирует содержимое и скачивает через динамическую ссылку.
 *
 * Использование:
 *   const exportComp = new Export(container);
 *   exportComp.render();
 *   exportComp.setCanvas(canvas);
 *   // при клике на кнопку экспорт выполняется автоматически
 *   exportComp.destroy();
 */

export class Export {
  private el: HTMLElement | null = null;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Создаёт DOM-структуру панели экспорта
   */
  public render(): void {
    this.el = this.container;
    this.el.classList.add('export-panel');

    this.el.innerHTML = `
      <h3>Экспорт</h3>
      <button class="btn btn-primary export-btn" id="exportPng" type="button">
        Сохранить как PNG
      </button>
      <div class="export-info">
        <span>Разрешение: ~1200 DPI</span>
      </div>
    `;

    this.el.querySelector('#exportPng')?.addEventListener('click', () => {
      this.exportToPng();
    });
  }

  /**
   * Принимает canvas из Viewer для последующего экспорта
   */
  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Экспорт canvas в PNG с увеличенным разрешением (x4) и скачивание
   */
  private exportToPng(): void {
    const sourceCanvas = this.canvas;
    if (!sourceCanvas) {
      console.warn('[Export] Canvas не установлен. Вызовите setCanvas().');
      return;
    }

    const scale = 4;
    const w = sourceCanvas.width * scale;
    const h = sourceCanvas.height * scale;

    // Создаём временный canvas увеличенного размера
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      console.error('[Export] Не удалось получить 2D-контекст');
      return;
    }

    // Копируем содержимое с увеличением
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, 0, 0, w, h);

    // Скачивание через toBlob
    tempCanvas.toBlob((blob) => {
      if (!blob) {
        console.error('[Export] Не удалось создать PNG');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gerber-viewer.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  /**
   * Очистка DOM
   */
  public destroy(): void {
    if (this.el) {
      this.el.innerHTML = '';
      this.el.classList.remove('export-panel');
    }
    this.canvas = null;
    this.el = null;
  }
}
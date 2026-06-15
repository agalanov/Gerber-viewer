/**
 * Export — Экспорт текущего вида в PNG
 *
 * Использует canvas.toBlob() для создания PNG-изображения
 * и скачивания его через динамически создаваемую ссылку.
 */

export class Export {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.classList.add('export-panel');
  }

  /**
   * Рендер панели экспорта
   */
  public render(onExport: () => void): void {
    this.el.innerHTML = `
      <div class="panel-header">Экспорт</div>
      <button class="btn btn-primary export-btn" type="button">
        Экспорт PNG
      </button>
    `;

    this.el.querySelector('.export-btn')?.addEventListener('click', onExport);
  }

  /**
   * Экспорт canvas в PNG и скачивание
   */
  public static exportToPng(
    canvas: HTMLCanvasElement,
    filename: string = 'gerber-export.png'
  ): void {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('[Export] Failed to create PNG blob');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  /**
   * Очистка
   */
  public destroy(): void {
    this.el.innerHTML = '';
    this.el.classList.remove('export-panel');
  }
}
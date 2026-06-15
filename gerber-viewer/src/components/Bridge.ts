/**
 * Bridge — postMessage коммуникация с родительским окном (WordPress)
 *
 * Обеспечивает:
 * - Отправку данных в родительское окно через window.postMessage
 * - Кнопку "Рассчитать стоимость", которая собирает метрики из Viewer
 *   и оригинальный zipFile из Uploader, затем отправляет postMessage
 *
 * Использование:
 *   const bridge = new Bridge(container);
 *   bridge.render();
 *   bridge.setViewer(viewer);
 *   bridge.setZipFile(zipFile);
 *   bridge.destroy();
 */

import type { ProjectMetrics } from '../types';

/** Данные для отправки в родительское окно (WordPress) */
export interface GerberDataPayload {
  zipFile: File;
  length: number;
  width: number;
  layersCount: number;
  minDrill: number;
}

export class Bridge {
  private el: HTMLElement | null = null;
  private container: HTMLElement;
  private btn: HTMLElement | null = null;
  private getMetrics: (() => ProjectMetrics) | null = null;
  private zipFile: File | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Создаёт DOM-структуру панели Bridge
   */
  public render(): void {
    this.el = this.container;
    this.el.classList.add('bridge-panel');

    this.el.innerHTML = `
      <h3>Калькулятор стоимости</h3>
      <button class="btn btn-primary bridge-btn" id="calculateBtn" type="button" disabled>
        Рассчитать стоимость
      </button>
    `;

    this.btn = this.el.querySelector('#calculateBtn');
    this.btn?.addEventListener('click', () => {
      this.sendData();
    });
  }

  /**
   * Устанавливает функцию получения метрик из Viewer
   */
  public setViewer(getMetricsFn: () => ProjectMetrics): void {
    this.getMetrics = getMetricsFn;
  }

  /**
   * Устанавливает оригинальный zip-файл из Uploader
   */
  public setZipFile(file: File): void {
    this.zipFile = file;
  }

  /**
   * Активирует кнопку после успешной инициализации вьювера
   */
  public enable(): void {
    if (this.btn) {
      this.btn.removeAttribute('disabled');
    }
  }

  /**
   * Собирает данные и отправляет postMessage в родительское окно
   */
  public sendData(): void {
    if (!this.getMetrics || !this.zipFile) {
      console.warn('[Bridge] Метрики или zipFile не установлены');
      return;
    }

    const metrics = this.getMetrics();

    const payload = {
      type: 'GERBER_DATA',
      payload: {
        zipFile: this.zipFile,
        length: metrics.length,
        width: metrics.width,
        layersCount: metrics.layersCount,
        minDrill: metrics.minDrill,
      },
    };

    if (window.parent !== window) {
      window.parent.postMessage(payload, '*');
      console.log('[Bridge] Данные отправлены в родительское окно', payload);
    } else {
      console.warn('[Bridge] Приложение не в iframe, postMessage не отправлен');
    }
  }

  /**
   * Очистка DOM
   */
  public destroy(): void {
    if (this.el) {
      this.el.innerHTML = '';
      this.el.classList.remove('bridge-panel');
    }
    this.btn = null;
    this.getMetrics = null;
    this.zipFile = null;
    this.el = null;
  }
}
/**
 * Summary — Сводка проекта печатной платы
 *
 * Отображает:
 * - Габариты платы (Длина × Ширина)
 * - Количество слоёв меди
 * - Минимальный диаметр отверстия
 * - Количество отверстий
 *
 * Использование:
 *   const summary = new Summary(container);
 *   summary.render();
 *   summary.setMetrics(metrics);
 *   summary.destroy();
 */

import type { ProjectMetrics } from '../types';

export class Summary {
  private el: HTMLElement | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Создаёт DOM-структуру панели сводки
   */
  public render(): void {
    this.el = this.container;
    this.el.classList.add('summary-panel');

    this.el.innerHTML = `
      <h3>Сводка проекта</h3>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Габариты:</span>
          <span class="summary-value" id="summaryDimensions">—</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Слоёв меди:</span>
          <span class="summary-value" id="summaryLayers">—</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Мин. диаметр отверстия:</span>
          <span class="summary-value" id="summaryDrill">—</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Количество отверстий:</span>
          <span class="summary-value" id="summaryHoles">—</span>
        </div>
      </div>
    `;
  }

  /**
   * Заполняет значения метрик в DOM-элементах
   */
  public setMetrics(metrics: ProjectMetrics): void {
    if (!this.el) return;

    const dimEl = this.el.querySelector('#summaryDimensions');
    const layersEl = this.el.querySelector('#summaryLayers');
    const drillEl = this.el.querySelector('#summaryDrill');
    const holesEl = this.el.querySelector('#summaryHoles');

    if (dimEl) {
      dimEl.textContent = `${metrics.width.toFixed(2)} × ${metrics.length.toFixed(2)} мм`;
    }
    if (layersEl) {
      layersEl.textContent = String(metrics.layersCount);
    }
    if (drillEl) {
      drillEl.textContent = metrics.minDrill > 0
        ? `${metrics.minDrill.toFixed(3)} мм`
        : '—';
    }
    if (holesEl) {
      holesEl.textContent = String(metrics.holesCount);
    }
  }

  /**
   * Очистка DOM
   */
  public destroy(): void {
    if (this.el) {
      this.el.innerHTML = '';
      this.el.classList.remove('summary-panel');
    }
    this.el = null;
  }
}
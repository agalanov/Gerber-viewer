/**
 * Summary — Сводка проекта печатной платы
 *
 * Отображает:
 * - Размеры платы
 * - Количество слоёв
 * - Количество отверстий
 * - Минимальный диаметр сверла
 */

import type { ProjectMetrics } from '../types';

export class Summary {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.classList.add('summary-panel');
  }

  /**
   * Отображение метрик
   */
  public render(metrics: ProjectMetrics): void {
    this.el.innerHTML = `
      <div class="panel-header">Сводка проекта</div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Длина</span>
          <span class="summary-value">${metrics.length.toFixed(2)} мм</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Ширина</span>
          <span class="summary-value">${metrics.width.toFixed(2)} мм</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Слоёв</span>
          <span class="summary-value">${metrics.layersCount}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Мин. сверло</span>
          <span class="summary-value">${metrics.minDrill.toFixed(2)} мм</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Отверстий</span>
          <span class="summary-value">${metrics.holesCount}</span>
        </div>
      </div>
    `;
  }

  /**
   * Показать сообщение, если метрики недоступны
   */
  public showEmpty(): void {
    this.el.innerHTML = `
      <div class="panel-header">Сводка проекта</div>
      <p class="summary-empty">Загрузите Gerber-файлы для просмотра метрик</p>
    `;
  }

  /**
   * Очистка
   */
  public destroy(): void {
    this.el.innerHTML = '';
    this.el.classList.remove('summary-panel');
  }
}
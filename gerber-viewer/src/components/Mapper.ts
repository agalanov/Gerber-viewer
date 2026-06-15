/**
 * Mapper.ts — Таблица маппинга Gerber-файлов на слои
 *
 * Отображает загруженные файлы в таблице с возможностью:
 * - Ручной правки стороны, типа и порядка слоя
 * - Drag & Drop для изменения порядка строк
 * - Валидации с подсветкой конфликтов и предупреждений
 * - Применения маппинга через колбэк onApply
 */

import type { GerberFile, LayerMapping, BoardSide, LayerType } from '../types';
import { detectLayerType, detectBoardSide } from '../utils/mapping';
import { validateMapping } from '../utils/validation';

export type ApplyMappingCallback = (mapping: LayerMapping[]) => void;

/** Стороны для выпадающего списка */
const SIDE_OPTIONS: BoardSide[] = ['top', 'bottom', 'inner'];

/** Типы слоёв для выпадающего списка */
const TYPE_OPTIONS: LayerType[] = [
  'copper',
  'soldermask',
  'silkscreen',
  'outline',
  'drill',
  'paste',
  'other',
];

/** Порядок слоёв для выпадающего списка */
const ORDER_OPTIONS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

/** Цвета для статусов валидации */
const STATUS_COLORS: Record<string, string> = {
  ok: '#66bb6a',
  warning: '#ffa726',
  error: '#ef5350',
};

export class Mapper {
  private container: HTMLElement;
  private onApply: ApplyMappingCallback;
  private files: GerberFile[] = [];
  private elements: {
    mapperBody: HTMLElement;
    warnings: HTMLElement;
    applyBtn: HTMLElement;
  } | null = null;

  /** Храним привязанные обработчики */
  private boundHandlers: Array<[HTMLElement | Document, string, EventListener]> = [];

  /** Текущий drag & drop элемент */
  private dragSrcIndex: number | null = null;

  constructor(container: HTMLElement, onApply: ApplyMappingCallback) {
    this.container = container;
    this.onApply = onApply;
  }

  /**
   * Создаёт DOM-структуру маппера
   */
  public render(): void {
    this.container.innerHTML = `
      <div id="mapper">
        <div class="mapper-toolbar">
          <h3>Маппинг слоёв</h3>
          <button class="mapper-apply" id="applyMapping">Применить маппинг</button>
        </div>
        <div class="mapper-warnings" id="warnings"></div>
        <div class="mapper-table-wrapper">
          <table class="mapper-table">
            <thead>
              <tr>
                <th>Имя файла</th>
                <th>Сторона</th>
                <th>Тип</th>
                <th>Порядок</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody id="mapperBody"></tbody>
          </table>
        </div>
      </div>
    `;

    this.elements = {
      mapperBody: this.container.querySelector('#mapperBody') as HTMLElement,
      warnings: this.container.querySelector('#warnings') as HTMLElement,
      applyBtn: this.container.querySelector('#applyMapping') as HTMLElement,
    };

    this.bindEvents();
  }

  /**
   * Установка файлов и обновление таблицы
   */
  public setFiles(files: GerberFile[]): void {
    this.files = files.map((f) => ({
      ...f,
      type: detectLayerType(f.name),
      side: detectBoardSide(f.name),
    }));
    this.renderTable();
  }

  /**
   * Получение текущего маппинга
   */
  public getMapping(): LayerMapping[] {
    return this.files.map((f, i) => ({
      id: `layer-${i}`,
      fileName: f.name,
      layerId: `layer-${i}`,
      visible: true,
      color: this.getDefaultColor(f.type),
      opacity: 1.0,
    }));
  }

  /**
   * Рендер таблицы
   */
  private renderTable(): void {
    if (!this.elements) return;

    const rowsHtml = this.files
      .map((file, index) => this.buildRowHtml(file, index))
      .join('');

    this.elements.mapperBody.innerHTML = rowsHtml;
    this.updateValidation();
  }

  /**
   * Построение HTML строки таблицы
   */
  private buildRowHtml(file: GerberFile, index: number): string {
    const sideOptions = SIDE_OPTIONS
      .map((s) => `<option value="${s}"${s === file.side ? ' selected' : ''}>${this.capitalize(s)}</option>`)
      .join('');

    const typeOptions = TYPE_OPTIONS
      .map((t) => `<option value="${t}"${t === file.type ? ' selected' : ''}>${this.capitalize(t)}</option>`)
      .join('');

    const orderOptions = ORDER_OPTIONS
      .map((o, oi) => `<option value="${oi}"${oi === file.order ? ' selected' : ''}>${o}</option>`)
      .join('');

    return `
      <tr class="mapper-row" draggable="true" data-index="${index}">
        <td class="mapper-file-name">
          <span class="mapper-drag-handle">⠿</span>
          ${this.escapeHtml(file.name)}
        </td>
        <td>
          <select class="mapper-select mapper-side-select" data-action="side" data-index="${index}">
            ${sideOptions}
          </select>
        </td>
        <td>
          <select class="mapper-select mapper-type-select" data-action="type" data-index="${index}">
            ${typeOptions}
          </select>
        </td>
        <td>
          <select class="mapper-select mapper-order-select" data-action="order" data-index="${index}">
            ${orderOptions}
          </select>
        </td>
        <td class="mapper-status-cell">
          <span class="mapper-status" data-index="${index}">—</span>
        </td>
      </tr>
    `;
  }

  /**
   * Обновление валидации и подсветки строк
   */
  private updateValidation(): void {
    if (!this.elements) return;

    const mapping = this.getMapping();
    const result = validateMapping(this.files, mapping);

    // Обновляем блок предупреждений
    const warningMessages: string[] = [];
    for (const w of result.warnings) {
      warningMessages.push(w.message);
    }
    this.elements.warnings.innerHTML = warningMessages
      .map((msg) => `<div class="mapper-warning-item">⚠️ ${this.escapeHtml(msg)}</div>`)
      .join('');

    // Подсветка строк
    const rows = this.elements.mapperBody.querySelectorAll('.mapper-row');
    const statusCells = this.elements.mapperBody.querySelectorAll('.mapper-status');

    // Собираем информацию о конфликтах: одинаковый (side + type + order)
    const conflictMap = new Map<string, number[]>();
    this.files.forEach((f, i) => {
      const key = `${f.side}|${f.type}|${f.order}`;
      if (!conflictMap.has(key)) conflictMap.set(key, []);
      conflictMap.get(key)!.push(i);
    });

    rows.forEach((row, index) => {
      const htmlRow = row as HTMLElement;
      const statusEl = statusCells[index] as HTMLElement;

      // Снимаем все классы
      htmlRow.classList.remove('mapper-row--ok', 'mapper-row--warning', 'mapper-row--error');

      // Проверка на конфликт (два файла на один слой)
      const key = `${this.files[index].side}|${this.files[index].type}|${this.files[index].order}`;
      const conflictIndices = conflictMap.get(key) || [];
      const hasConflict = conflictIndices.length > 1;

      if (hasConflict) {
        htmlRow.classList.add('mapper-row--error');
        statusEl.textContent = '❌ Конфликт';
        statusEl.style.color = STATUS_COLORS.error;
      } else if (result.warnings.some((w) => w.fileName === this.files[index].name)) {
        htmlRow.classList.add('mapper-row--warning');
        statusEl.textContent = '⚠️ Внимание';
        statusEl.style.color = STATUS_COLORS.warning;
      } else {
        htmlRow.classList.add('mapper-row--ok');
        statusEl.textContent = '✅ OK';
        statusEl.style.color = STATUS_COLORS.ok;
      }
    });
  }

  /**
   * Привязка событий
   */
  private bindEvents(): void {
    if (!this.elements) return;

    // Кнопка "Применить маппинг"
    this.addHandler(this.elements.applyBtn, 'click', (() => {
      const mapping = this.getMapping();
      this.onApply(mapping);
    }) as EventListener);

    // Делегирование событий на tbody (select change + drag & drop)
    const tbody = this.elements.mapperBody;

    // Change на select'ах
    this.addHandler(tbody, 'change', ((e: Event) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      const indexStr = target.getAttribute('data-index');
      if (indexStr === null) return;
      const index = parseInt(indexStr, 10);
      if (isNaN(index) || index < 0 || index >= this.files.length) return;

      const value = (target as HTMLSelectElement).value;

      switch (action) {
        case 'side':
          this.files[index].side = value as BoardSide;
          break;
        case 'type':
          this.files[index].type = value as LayerType;
          break;
        case 'order':
          this.files[index].order = parseInt(value, 10);
          break;
      }

      this.updateValidation();
    }) as EventListener);

    // Drag & Drop — dragstart
    this.addHandler(tbody, 'dragstart', ((e: DragEvent) => {
      const row = (e.target as HTMLElement).closest('.mapper-row') as HTMLElement;
      if (!row) return;
      const indexStr = row.getAttribute('data-index');
      if (indexStr === null) return;
      this.dragSrcIndex = parseInt(indexStr, 10);
      row.classList.add('mapper-row--dragging');
      e.dataTransfer?.setData('text/plain', indexStr);
      e.dataTransfer!.effectAllowed = 'move';
    }) as EventListener);

    // Drag & Drop — dragend
    this.addHandler(tbody, 'dragend', ((e: DragEvent) => {
      const row = (e.target as HTMLElement).closest('.mapper-row') as HTMLElement;
      if (row) {
        row.classList.remove('mapper-row--dragging');
      }
      // Снимаем подсветку со всех строк
      tbody.querySelectorAll('.mapper-row').forEach((r) => {
        (r as HTMLElement).classList.remove('mapper-row--drag-over');
      });
      this.dragSrcIndex = null;
    }) as EventListener);

    // Drag & Drop — dragover
    this.addHandler(tbody, 'dragover', ((e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
      const row = (e.target as HTMLElement).closest('.mapper-row') as HTMLElement;
      if (row) {
        row.classList.add('mapper-row--drag-over');
      }
    }) as EventListener);

    // Drag & Drop — dragleave
    this.addHandler(tbody, 'dragleave', ((e: DragEvent) => {
      const row = (e.target as HTMLElement).closest('.mapper-row') as HTMLElement;
      if (row) {
        row.classList.remove('mapper-row--drag-over');
      }
    }) as EventListener);

    // Drag & Drop — drop
    this.addHandler(tbody, 'drop', ((e: DragEvent) => {
      e.preventDefault();
      const targetRow = (e.target as HTMLElement).closest('.mapper-row') as HTMLElement;
      if (!targetRow) return;

      const targetIndexStr = targetRow.getAttribute('data-index');
      if (targetIndexStr === null || this.dragSrcIndex === null) return;
      const targetIndex = parseInt(targetIndexStr, 10);

      if (this.dragSrcIndex === targetIndex) return;

      // Перемещаем файл в массиве
      const [moved] = this.files.splice(this.dragSrcIndex, 1);
      this.files.splice(targetIndex, 0, moved);

      // Обновляем порядок
      this.files.forEach((f, i) => {
        f.order = i;
      });

      this.renderTable();
    }) as EventListener);
  }

  /**
   * Вспомогательный метод для добавления обработчика
   */
  private addHandler(target: HTMLElement | Document, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.boundHandlers.push([target, type, handler]);
  }

  /**
   * Цвет слоя по умолчанию
   */
  private getDefaultColor(type: LayerType): string {
    const colors: Record<LayerType, string> = {
      copper: '#c97d2d',
      soldermask: '#2e7d32',
      silkscreen: '#f5f5f5',
      paste: '#78909c',
      drill: '#1a237e',
      outline: '#ffd54f',
      other: '#4fc3f7',
    };
    return colors[type] ?? '#4fc3f7';
  }

  /**
   * Капитализация первой буквы
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Экранирование HTML
   */
  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Очистка
   */
  public destroy(): void {
    for (const [target, type, handler] of this.boundHandlers) {
      target.removeEventListener(type, handler);
    }
    this.boundHandlers = [];
    this.container.innerHTML = '';
    this.elements = null;
    this.files = [];
  }
}
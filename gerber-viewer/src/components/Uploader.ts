/**
 * Uploader.ts — Drag & Drop загрузчик ZIP-архивов с Gerber файлами
 *
 * Создаёт зону загрузки с поддержкой Drag & Drop и выбора файла.
 * Распаковывает ZIP через Web Worker, отображает прогресс.
 * После распаковки вызывает колбэк onFilesLoaded(files: GerberFile[]).
 */

import type { GerberFile } from '../types';
import { autoMapFiles } from '../utils/mapping';

export type FilesLoadedCallback = (files: GerberFile[], zipBuffer: ArrayBuffer, zipFile?: File) => void;

export class Uploader {
  private container: HTMLElement;
  private onFilesLoaded: FilesLoadedCallback;
  private worker: Worker | null = null;
  private elements: {
    dropzone: HTMLElement;
    fileInput: HTMLInputElement;
    fileBtn: HTMLElement;
    progress: HTMLElement;
    progressBar: HTMLElement;
    progressText: HTMLElement;
  } | null = null;

  /** Храним привязанные обработчики для корректного удаления */
  private boundHandlers: Array<[HTMLElement | Document, string, EventListener]> = [];

  constructor(container: HTMLElement, onFilesLoaded: FilesLoadedCallback) {
    this.container = container;
    this.onFilesLoaded = onFilesLoaded;
  }

  /**
   * Создаёт DOM-структуру загрузчика и навешивает события
   */
  public render(): void {
    this.container.innerHTML = `
      <div id="uploader">
        <div class="uploader-dropzone" id="dropzone">
          <div class="uploader-icon">📁</div>
          <p>Перетащите .zip архив с Gerber файлами сюда</p>
          <p class="uploader-or">или</p>
          <button class="uploader-button" id="fileBtn">Выберите файл</button>
          <input type="file" accept=".zip" id="fileInput" hidden>
        </div>
        <div class="uploader-progress" id="progress" style="display:none">
          <div class="uploader-progress-bar" id="progressBar"></div>
          <span id="progressText">Распаковка...</span>
        </div>
      </div>
    `;

    const dropzone = this.container.querySelector('#dropzone') as HTMLElement;
    const fileInput = this.container.querySelector('#fileInput') as HTMLInputElement;
    const fileBtn = this.container.querySelector('#fileBtn') as HTMLElement;
    const progress = this.container.querySelector('#progress') as HTMLElement;
    const progressBar = this.container.querySelector('#progressBar') as HTMLElement;
    const progressText = this.container.querySelector('#progressText') as HTMLElement;

    this.elements = { dropzone, fileInput, fileBtn, progress, progressBar, progressText };

    this.bindEvents();
  }

  /**
   * Привязка событий Drag & Drop и кнопки выбора файла
   */
  private bindEvents(): void {
    const { dropzone, fileInput, fileBtn } = this.elements!;

    // Drag & Drop — dragover
    this.addHandler(dropzone, 'dragover', ((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('uploader-dropzone--active');
    }) as EventListener);

    // Drag & Drop — dragleave
    this.addHandler(dropzone, 'dragleave', ((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('uploader-dropzone--active');
    }) as EventListener);

    // Drag & Drop — drop
    this.addHandler(dropzone, 'drop', ((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('uploader-dropzone--active');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.processFile(files[0]);
      }
    }) as EventListener);

    // Кнопка выбора файла
    this.addHandler(fileBtn, 'click', ((e: MouseEvent) => {
      e.stopPropagation();
      fileInput.click();
    }) as EventListener);

    // Скрытый input
    this.addHandler(fileInput, 'change', (() => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.processFile(fileInput.files[0]);
      }
    }) as EventListener);

    // Предотвращаем всплытие клика с dropzone на input
    this.addHandler(dropzone, 'click', ((e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.id !== 'fileBtn') {
        fileInput.click();
      }
    }) as EventListener);
  }

  /**
   * Проверка и обработка загруженного файла
   */
  private processFile(file: File): void {
    // Проверка расширения .zip
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.zip' && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      this.showError('Пожалуйста, выберите .zip архив');
      return;
    }

    // Сохраняем оригинальный File для Bridge
    this._originalFile = file;

    // Показываем прогресс
    this.showProgress('Распаковка...', 0);

    // Отправляем в Web Worker
    this.extractZipViaWorker(file);
  }

  /**
   * Чтение файла как ArrayBuffer (для передачи во Viewer)
   */
  private readFileAsBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Распаковка ZIP через Web Worker
   */
  private extractZipViaWorker(file: File): void {
    // Создаём Worker
    this.worker = new Worker(
      new URL('../workers/zip-worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'extracted') {
        const rawFiles: Array<{ name: string; data: string }> = payload.files;

        // Преобразуем в GerberFile[]
        const gerberFiles: GerberFile[] = rawFiles.map((f, index) => ({
          name: f.name,
          data: f.data,
          type: 'other',
          side: 'top',
          order: index,
        }));

        // Авто-маппинг
        const mapped = autoMapFiles(gerberFiles);

        // Прогресс 100%
        this.showProgress('Готово!', 100);

        // Задержка для визуального отображения 100%
        setTimeout(() => {
          this.hideProgress();
          this.worker?.terminate();
          this.worker = null;
          // Передаём файлы, буфер и оригинальный File
          this.onFilesLoaded(mapped, this._zipBuffer!, this._originalFile);
          this._zipBuffer = null;
          this._originalFile = undefined;
        }, 400);
      } else if (type === 'progress') {
        // Прогресс от Worker (если поддерживается)
        const pct = typeof payload.percent === 'number' ? payload.percent : 0;
        this.showProgress(payload.message || 'Распаковка...', pct);
      } else if (type === 'error') {
        this.showError(payload.message || 'Ошибка распаковки архива');
        this.worker?.terminate();
        this.worker = null;
      }
    };

    this.worker.onerror = (err) => {
      this.showError('Ошибка Web Worker: ' + err.message);
      this.worker?.terminate();
      this.worker = null;
    };

    // Читаем файл как ArrayBuffer
    this.readFileAsBuffer(file).then((buffer) => {
      // Сохраняем копию буфера для передачи во Viewer
      this._zipBuffer = buffer.slice(0);

      // Отправляем оригинальный буфер в Worker (будет передан по transferable)
      this.worker?.postMessage(
        { type: 'extract', payload: { file: buffer } },
        [buffer]
      );
    }).catch((err) => {
      this.showError('Ошибка чтения файла: ' + err.message);
    });
  }

  /** Хранилище копии буфера ZIP для передачи во Viewer */
  private _zipBuffer: ArrayBuffer | null = null;

  /** Хранилище оригинального File для Bridge */
  private _originalFile: File | undefined = undefined;

  /**
   * Отображение прогресс-бара
   */
  private showProgress(text: string, percent: number): void {
    if (!this.elements) return;
    const { dropzone, progress, progressBar, progressText } = this.elements;

    dropzone.style.display = 'none';
    progress.style.display = 'flex';
    progressBar.style.width = Math.min(100, Math.max(0, percent)) + '%';
    progressText.textContent = text;
  }

  /**
   * Скрытие прогресс-бара
   */
  private hideProgress(): void {
    if (!this.elements) return;
    const { dropzone, progress } = this.elements;
    progress.style.display = 'none';
    dropzone.style.display = '';
  }

  /**
   * Отображение ошибки
   */
  private showError(message: string): void {
    if (!this.elements) return;
    const { progress, progressBar, progressText } = this.elements;

    progress.style.display = 'flex';
    progressBar.style.width = '100%';
    progressBar.style.backgroundColor = 'var(--gv-error, #ef5350)';
    progressText.textContent = '❌ ' + message;

    // Скрываем через 3 секунды и возвращаем dropzone
    setTimeout(() => {
      this.hideProgress();
      if (this.elements) {
        this.elements.progressBar.style.backgroundColor = '';
      }
    }, 3000);
  }

  /**
   * Вспомогательный метод для добавления обработчика с возможностью удаления
   */
  private addHandler(target: HTMLElement | Document, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.boundHandlers.push([target, type, handler]);
  }

  /**
   * Очистка: удаление всех обработчиков и DOM
   */
  public destroy(): void {
    // Удаляем все обработчики
    for (const [target, type, handler] of this.boundHandlers) {
      target.removeEventListener(type, handler);
    }
    this.boundHandlers = [];

    // Терминируем Worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Очищаем DOM
    this.container.innerHTML = '';
    this.elements = null;
  }
}
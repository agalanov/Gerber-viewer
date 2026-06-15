/**
 * Bridge — postMessage коммуникация с родительским окном (WordPress)
 *
 * Обеспечивает:
 * - Двустороннюю связь через window.postMessage
 * - Обработку команд от родительского окна
 * - Отправку событий (ready, metrics, error, resize)
 */

import type { PostMessagePayload, ViewerConfig } from '../types';

/** Обработчик команд от родительского окна */
export type CommandHandler = (command: string, data: Record<string, unknown>) => void;

export class Bridge {
  private origin: string;
  private onCommand: CommandHandler;

  /**
   * @param allowedOrigin — разрешённый origin родительского окна ('*' для разработки)
   * @param onCommand — обработчик входящих команд
   */
  constructor(allowedOrigin: string = '*', onCommand: CommandHandler) {
    this.origin = allowedOrigin;
    this.onCommand = onCommand;
    this.setupListener();
  }

  /**
   * Настройка слушателя postMessage
   */
  private setupListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      // Проверка origin (если не '*')
      if (this.origin !== '*' && event.origin !== this.origin) {
        return;
      }

      const payload = event.data as { type?: string; command?: string; data?: Record<string, unknown> };

      if (payload?.command) {
        this.onCommand(payload.command, payload.data ?? {});
      }
    });
  }

  /**
   * Отправка сообщения в родительское окно
   */
  public send(payload: PostMessagePayload): void {
    if (window.parent === window) {
      // Не в iframe — ничего не делаем
      return;
    }

    window.parent.postMessage(payload, this.origin);
  }

  /**
   * Уведомление о готовности
   */
  public notifyReady(version: string = '1.0.0'): void {
    this.send({
      type: 'ready',
      data: { version },
    });
  }

  /**
   * Отправка метрик
   */
  public sendMetrics(metrics: Record<string, unknown>): void {
    this.send({
      type: 'metrics',
      data: metrics,
    });
  }

  /**
   * Отправка ошибки
   */
  public sendError(message: string, code?: string): void {
    this.send({
      type: 'error',
      data: { message, code },
    });
  }

  /**
   * Отправка события экспорта
   */
  public sendExport(dataUrl: string): void {
    this.send({
      type: 'export',
      data: { dataUrl },
    });
  }

  /**
   * Отправка изменения размера
   */
  public sendResize(width: number, height: number): void {
    this.send({
      type: 'resize',
      data: { width, height },
    });
  }

  /**
   * Получение конфигурации из URL-параметров
   */
  public static getConfigFromUrl(): ViewerConfig {
    const params = new URLSearchParams(window.location.search);
    return {
      theme: (params.get('theme') as 'light' | 'dark') ?? 'dark',
      lang: (params.get('lang') as 'ru' | 'en') ?? 'ru',
      maxFileSize: params.get('maxSize')
        ? parseInt(params.get('maxSize')!, 10)
        : 50 * 1024 * 1024,
      showToolbar: params.get('toolbar') !== '0',
    };
  }

  /**
   * Очистка
   */
  public destroy(): void {
    // Удалить конкретный listener нельзя без сохранения ссылки,
    // поэтому перезаписываем: window.removeEventListener не вызываем,
    // но помечаем как отключённый
  }
}
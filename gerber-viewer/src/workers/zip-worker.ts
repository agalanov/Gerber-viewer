/**
 * zip-worker.ts — Web Worker для распаковки ZIP-архивов
 *
 * Выполняет распаковку в фоновом потоке, чтобы не блокировать UI.
 * Использует JSZip для декомпрессии.
 *
 * Сообщения (message):
 *   { type: 'extract', payload: { file: ArrayBuffer } }
 *
 * Ответы (postMessage):
 *   { type: 'extracted', payload: { files: Array<{ name: string, data: string }> } }
 *   { type: 'error', payload: { message: string } }
 */

/// <reference lib="webworker" />

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

ctx.addEventListener('message', async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type !== 'extract') {
    ctx.postMessage({ type: 'error', payload: { message: `Unknown command: ${type}` } });
    return;
  }

  try {
    // Динамический импорт JSZip в Worker
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(payload.file);

    const files: Array<{ name: string; data: string }> = [];
    const allowedExts = ['.gbr', '.gerber', '.drl', '.exc', '.txt'];

    const entries = Object.entries(zip.files);
    for (const [name, entry] of entries) {
      if (entry.dir) continue;

      const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
      if (!allowedExts.includes(ext)) continue;

      const content = await entry.async('string');
      files.push({ name, data: content });
    }

    ctx.postMessage({ type: 'extracted', payload: { files } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    ctx.postMessage({ type: 'error', payload: { message } });
  }
});
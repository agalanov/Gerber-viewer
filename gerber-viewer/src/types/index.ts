/**
 * Gerber Viewer — TypeScript типы и интерфейсы
 */

/** Сторона платы */
export type BoardSide = 'top' | 'bottom' | 'inner';

/** Тип Gerber-слоя */
export type LayerType =
  | 'copper'
  | 'soldermask'
  | 'silkscreen'
  | 'paste'
  | 'drill'
  | 'outline'
  | 'other';

/** Интерфейс загруженного Gerber-файла */
export interface GerberFile {
  /** Имя файла (из архива или загрузки) */
  name: string;
  /** Содержимое файла (текст Gerber/Excellon) */
  data: string;
  /** Авто-определённый тип слоя */
  type: LayerType;
  /** Сторона платы */
  side: BoardSide;
  /** Порядок отрисовки (0 — нижний слой) */
  order: number;
}

/** Маппинг файла на слой рендерера */
export interface LayerMapping {
  /** Уникальный ID маппинга */
  id: string;
  /** Имя файла */
  fileName: string;
  /** ID слоя в gerbers-renderer */
  layerId: string;
  /** Видимость слоя */
  visible: boolean;
  /** Цвет слоя (hex) */
  color: string;
  /** Прозрачность (0–1) */
  opacity: number;
}

/** Метрики печатной платы */
export interface ProjectMetrics {
  /** Длина платы в мм */
  length: number;
  /** Ширина платы в мм */
  width: number;
  /** Количество слоёв */
  layersCount: number;
  /** Минимальный диаметр сверла в мм */
  minDrill: number;
  /** Количество отверстий */
  holesCount: number;
}

/** Состояние вьювера */
export interface ViewerState {
  /** Масштаб */
  zoom: number;
  /** Смещение по X */
  panX: number;
  /** Смещение по Y */
  panY: number;
  /** Активный слой */
  activeLayerId: string | null;
  /** Загружены ли файлы */
  hasFiles: boolean;
  /** Идёт ли загрузка */
  isLoading: boolean;
}

/** Данные для отправки в родительское окно (WordPress) */
export interface PostMessagePayload {
  /** Тип сообщения */
  type: 'ready' | 'metrics' | 'error' | 'export' | 'resize';
  /** Данные сообщения */
  data: Record<string, unknown>;
}

/** Событие загрузки файлов */
export interface FileLoadEvent {
  files: GerberFile[];
  source: 'upload' | 'url' | 'demo';
}

/** Конфигурация вьювера из родительского окна */
export interface ViewerConfig {
  /** Тема оформления */
  theme?: 'light' | 'dark';
  /** Язык интерфейса */
  lang?: 'ru' | 'en';
  /** Максимальный размер файла в байтах */
  maxFileSize?: number;
  /** Показывать ли тулбар */
  showToolbar?: boolean;
}
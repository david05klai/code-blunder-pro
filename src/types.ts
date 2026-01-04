export interface ProcessedFile {
  path: string;
  content: string;
  size: number;
  selected: boolean;
  language: string;
  lines: number;
  tokens: number; // Nuevo campo
}

export type OutputFormat = 'txt' | 'md' | 'json';
export type AITemplate = 'none' | 'claude' | 'chatgpt' | 'gemini';
export type AppMode = 'bundle' | 'reverse' | 'github';

export interface ProcessingResult {
  totalFiles: number;
  totalSize: number;
  totalTokens: number; // Nuevo campo
  bundleText: string;
  files: ProcessedFile[];
  tree: string;
  stats: {
    languages: Record<string, number>;
    totalLines: number;
  };
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADED = 'LOADED', 
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  LIMIT_REACHED = 'LIMIT_REACHED'
}

export type Language = 'en' | 'es';
// WordFlash 类型定义

export interface Definition {
  pos: string;
  meaning: string;
}

export interface Word {
  id: number;
  word: string;
  phonetic: string;
  definitions: Definition[];
  phrases: string[];
  examples: string[];
  frequencyRank: number;
  createdAt: number;
  progress?: Progress | null;
}

export interface Library {
  id: number;
  name: string;
  description: string;
  wordCount: number;
  category: string;
  isBuiltin: boolean;
  createdAt: number;
}

export interface LibraryWord {
  libraryId: number;
  wordId: number;
  addedAt: number;
}

export interface Progress {
  id: number;
  wordId: number;
  libraryId: number;
  masteryScore: number;
  lastFeedback: string;
  reviewCount: number;
  isMastered: boolean;
  lastReviewedAt: number;
  createdAt: number;
}

export interface GlobalStats {
  totalWords: number;
  mastered: number;
  learning: number;
  unlearned: number;
  progress: number;
}

export interface LibraryStats {
  total: number;
  mastered: number;
  learning: number;
  unlearned: number;
  progress: number;
}

export interface Settings {
  dailyGoal: number;
  reminderEnabled: boolean;
  reminderTime: string;
}

export interface Stats {
  totalStudied: number;
  totalMastered: number;
  streakDays: number;
  lastStudyDate: string | null;
}

export interface DBSchema {
  version: string;
  libraries: Library[];
  words: Word[];
  libraryWords: LibraryWord[];
  progress: Progress[];
  masteredWords: number[];
  settings: Settings;
  stats: Stats;
}

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

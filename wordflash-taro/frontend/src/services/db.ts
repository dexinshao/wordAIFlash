import Taro from '@tarojs/taro';
import type { DBSchema, Library, Word, Progress, GlobalStats, LibraryStats, Settings, Stats } from '../types/wordflash';

const DB_KEY = 'wordflash_db';
const DATA_VERSION = '1.0.0';

// 内置词库 ID 到文件名的映射
const BUILTIN_LIB_FILES: Record<number, string> = {
  1: 'lib-1.json', // 四级词汇
  2: 'lib-2.json', // 六级词汇
  3: 'lib-3.json', // 托福词汇
  4: 'lib-4.json', // 雅思词汇
  5: 'lib-5.json', // 英语八级
  6: 'lib-6.json', // BEC商务
  7: 'lib-7.json', // 高中词汇
  8: 'lib-8.json', // 高频10000
};

// 内置词库总数
const BUILTIN_LIB_COUNT = Object.keys(BUILTIN_LIB_FILES).length;

// 加载进度回调类型
type ProgressCallback = (progress: number, message: string) => void;

function getDefaultLibraries(): Library[] {
  return [
    { id: 1, name: '四级词汇', description: '大学英语四级考试核心词汇', wordCount: 0, category: 'cet4', isBuiltin: true, createdAt: Date.now() },
    { id: 2, name: '六级词汇', description: '大学英语六级考试核心词汇', wordCount: 0, category: 'cet6', isBuiltin: true, createdAt: Date.now() },
    { id: 3, name: '托福词汇', description: '托福考试高频词汇', wordCount: 0, category: 'toefl', isBuiltin: true, createdAt: Date.now() },
    { id: 4, name: '雅思词汇', description: '雅思考试核心词汇', wordCount: 0, category: 'ielts', isBuiltin: true, createdAt: Date.now() },
    { id: 5, name: '英语八级', description: '英语专业八级词汇', wordCount: 0, category: 'tem8', isBuiltin: true, createdAt: Date.now() },
    { id: 6, name: 'BEC商务', description: '商务英语考试词汇', wordCount: 0, category: 'bec', isBuiltin: true, createdAt: Date.now() },
    { id: 7, name: '高中词汇', description: '高考英语核心词汇', wordCount: 0, category: 'high_school', isBuiltin: true, createdAt: Date.now() },
    { id: 8, name: '高频10000', description: 'COCA高频词汇', wordCount: 0, category: 'top10000', isBuiltin: true, createdAt: Date.now() },
    { id: 9, name: '✅ 已掌握', description: '已掌握的单词汇总', wordCount: 0, category: 'mastered', isBuiltin: true, createdAt: Date.now() }
  ];
}

/**
 * 从 meta.json 加载库信息和设置
 */
function loadMetaFromJSON(jsonData: any): Partial<DBSchema> {
  try {
    if (jsonData && jsonData.libraries) {
      return {
        libraries: jsonData.libraries as Library[],
        settings: jsonData.settings as Settings || undefined,
        stats: jsonData.stats as Stats || undefined
      };
    }
  } catch (e) {
    console.error('Failed to parse meta.json', e);
  }
  return {};
}

/**
 * 从 lib JSON 文件加载单词数据
 */
function loadWordsFromJSON(jsonData: any, libraryId: number): { words: Word[]; libraryWords: DBSchema['libraryWords'] } {
  try {
    if (Array.isArray(jsonData)) {
      const words: Word[] = [];
      const libraryWords: DBSchema['libraryWords'] = [];
      const now = Date.now();

      jsonData.forEach((item: any, index: number) => {
        const word: Word = {
          id: now + libraryId * 100000 + index,
          word: item.word?.toLowerCase() || '',
          phonetic: item.phonetic || '',
          definitions: item.definitions || [],
          phrases: item.phrases || [],
          examples: item.examples || [],
          frequencyRank: item.frequencyRank || 99999,
          createdAt: now
        };
        words.push(word);
        libraryWords.push({
          libraryId,
          wordId: word.id,
          addedAt: now
        });
      });

      return { words, libraryWords };
    }
  } catch (e) {
    console.error(`Failed to parse lib-${libraryId}.json`, e);
  }
  return { words: [], libraryWords: [] };
}

function createEmptyDB(): DBSchema {
  return {
    version: DATA_VERSION,
    libraries: getDefaultLibraries(),
    words: [],
    libraryWords: [],
    progress: [],
    masteredWords: [],
    settings: {
      dailyGoal: 20,
      reminderEnabled: false,
      reminderTime: '20:00'
    },
    stats: {
      totalStudied: 0,
      totalMastered: 0,
      streakDays: 0,
      lastStudyDate: null
    }
  };
}

class LocalDatabase {
  private db: DBSchema | null = null;
  private initialized: boolean = false;
  private initializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 异步初始化数据库（首次使用时导入内置词库）
   * @param onProgress 进度回调 (progress: 0-100, message: string) => void
   */
  async initialize(onProgress?: ProgressCallback): Promise<void> {
    if (this.initialized) return;
    if (this.initializing && this.initPromise) return this.initPromise;

    this.initializing = true;
    this.initPromise = this._doInitialize(onProgress);
    await this.initPromise;
    this.initializing = false;
    this.initialized = true;
  }

  private async _doInitialize(onProgress?: ProgressCallback): Promise<void> {
    const stored = Taro.getStorageSync(DB_KEY);
    if (!stored) {
      // 首次使用，创建空数据库并导入内置词库
      onProgress?.(5, '准备导入词库数据...');
      this.db = createEmptyDB();
      await this.importBuiltinData(onProgress);
      this.save();
      onProgress?.(100, '导入完成！');
    } else {
      this.db = stored as DBSchema;
      this.migrateDataIfNeeded();
    }
  }

  getDB(): DBSchema {
    if (!this.db) {
      const stored = Taro.getStorageSync(DB_KEY);
      if (!stored) {
        // 同步初始化：返回空数据库（不应该发生，因为应该先调用 initialize）
        console.warn('DB not initialized, returning empty DB. Please call initialize() first.');
        this.db = createEmptyDB();
      } else {
        this.db = stored as DBSchema;
        this.migrateDataIfNeeded();
      }
    }
    return this.db;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 导入内置词库数据（仅首次使用时调用）
   * 注意：在微信小程序中，data 目录被复制到 weapp/data，需要用相对路径访问
   */
  private async importBuiltinData(onProgress?: ProgressCallback): Promise<void> {
    try {
      const fs = Taro.getFileSystemManager();
      // weapp 目录下的 data 子目录
      const dataDir = `${Taro.env.USER_DATA_PATH}/../data/`;

      // 先加载 meta.json 获取库信息
      try {
        onProgress?.(10, '加载词库信息...');
        const metaContent = fs.readFileSync(`${dataDir}meta.json`, 'utf-8') as string;
        const metaData = JSON.parse(metaContent);
        const metaInfo = loadMetaFromJSON(metaData);

        if (metaInfo.libraries) {
          this.db!.libraries = metaInfo.libraries;
        }
        if (metaInfo.settings) {
          this.db!.settings = metaInfo.settings;
        }
        if (metaInfo.stats) {
          this.db!.stats = metaInfo.stats;
        }
      } catch (e) {
        console.error('Failed to load meta.json', e);
      }

      // 加载每个内置词库的单词
      const libEntries = Object.entries(BUILTIN_LIB_FILES);
      for (let i = 0; i < libEntries.length; i++) {
        const [libId, fileName] = libEntries[i];
        try {
          const libIdNum = parseInt(libId);
          const progress = 10 + Math.floor((i / libEntries.length) * 80);
          onProgress?.(progress, `正在导入 ${this.db!.libraries.find(l => l.id === libIdNum)?.name || fileName}...`);

          const content = fs.readFileSync(`${dataDir}${fileName}`, 'utf-8') as string;
          const jsonData = JSON.parse(content);
          const { words, libraryWords } = loadWordsFromJSON(jsonData, libIdNum);

          this.db!.words.push(...words);
          this.db!.libraryWords.push(...libraryWords);

          // 更新词库单词数
          const library = this.db!.libraries.find(l => l.id === libIdNum);
          if (library) {
            library.wordCount = libraryWords.length;
          }
        } catch (e) {
          console.error(`Failed to load ${fileName}`, e);
        }
      }
    } catch (e) {
      console.error('Failed to import builtin data', e);
    }
  }

  save(): void {
    if (this.db) {
      Taro.setStorageSync(DB_KEY, this.db);
    }
  }

  private migrateDataIfNeeded(): void {
    if (this.db && this.db.version !== DATA_VERSION) {
      this.db.version = DATA_VERSION;
      this.save();
    }
  }

  // ==================== 词库操作 ====================

  getLibraries(): Library[] {
    return this.getDB().libraries || [];
  }

  getLibraryById(id: number): Library | null {
    return this.getDB().libraries.find(lib => lib.id === id) || null;
  }

  createLibrary(name: string, description = '', category = 'custom'): Library {
    const db = this.getDB();
    const newLibrary: Library = {
      id: Date.now(),
      name,
      description,
      wordCount: 0,
      category,
      isBuiltin: false,
      createdAt: Date.now()
    };
    db.libraries.push(newLibrary);
    this.save();
    return newLibrary;
  }

  deleteLibrary(id: number, mergeToLibraryId: number | null = null): boolean {
    const db = this.getDB();
    const libraryIndex = db.libraries.findIndex(lib => lib.id === id);
    if (libraryIndex === -1) return false;
    const library = db.libraries[libraryIndex];
    if (library.isBuiltin) return false;

    if (mergeToLibraryId) {
      const wordsToMove = db.libraryWords.filter(lw => lw.libraryId === id);
      wordsToMove.forEach(lw => {
        const existing = db.libraryWords.find(
          l => l.libraryId === mergeToLibraryId && l.wordId === lw.wordId
        );
        if (!existing) {
          db.libraryWords.push({
            libraryId: mergeToLibraryId,
            wordId: lw.wordId,
            addedAt: lw.addedAt
          });
        }
      });
      this.updateLibraryWordCount(mergeToLibraryId);
    }

    db.libraryWords = db.libraryWords.filter(lw => lw.libraryId !== id);
    db.progress = db.progress.filter(p => p.libraryId !== id);
    db.libraries.splice(libraryIndex, 1);
    this.save();
    return true;
  }

  updateLibraryWordCount(libraryId: number): void {
    const db = this.getDB();
    const library = db.libraries.find(lib => lib.id === libraryId);
    if (library) {
      library.wordCount = db.libraryWords.filter(lw => lw.libraryId === libraryId).length;
      this.save();
    }
  }

  // ==================== 单词操作 ====================

  getWords(libraryId: number, options: { search?: string; filter?: string } = {}): Word[] {
    const db = this.getDB();
    const { search = '', filter = 'all' } = options;

    const wordIds = db.libraryWords
      .filter(lw => lw.libraryId === libraryId)
      .map(lw => lw.wordId);

    let words = db.words.filter(w => wordIds.includes(w.id));

    if (search) {
      words = words.filter(w => w.word.toLowerCase().includes(search.toLowerCase()));
    }

    if (filter !== 'all') {
      words = words.filter(w => {
        const progress = db.progress.find(p => p.wordId === w.id && p.libraryId === libraryId);
        if (filter === 'mastered') return progress?.isMastered;
        if (filter === 'unlearned') return !progress;
        if (filter === 'learning') return progress && !progress.isMastered;
        return true;
      });
    }

    return words.map(w => ({
      ...w,
      progress: db.progress.find(p => p.wordId === w.id && p.libraryId === libraryId) || null
    }));
  }

  getWordById(id: number): Word | null {
    return this.getDB().words.find(w => w.id === id) || null;
  }

  addWord(wordData: Partial<Word> & { word: string }, libraryId: number): Word {
    const db = this.getDB();
    let word = db.words.find(w => w.word.toLowerCase() === wordData.word.toLowerCase());

    if (!word) {
      word = {
        id: Date.now() + Math.random(),
        word: wordData.word.toLowerCase(),
        phonetic: wordData.phonetic || '',
        definitions: wordData.definitions || [],
        phrases: wordData.phrases || [],
        examples: wordData.examples || [],
        frequencyRank: wordData.frequencyRank || 99999,
        createdAt: Date.now()
      };
      db.words.push(word);
    }

    const existingLink = db.libraryWords.find(
      lw => lw.libraryId === libraryId && lw.wordId === word!.id
    );

    if (!existingLink) {
      db.libraryWords.push({
        libraryId,
        wordId: word.id,
        addedAt: Date.now()
      });
      this.updateLibraryWordCount(libraryId);
    }

    this.save();
    return word;
  }

  getNextFlashcard(libraryId: number, excludeWordId: number | null = null): Word | null {
    const db = this.getDB();
    const wordIds = db.libraryWords
      .filter(lw => lw.libraryId === libraryId)
      .map(lw => lw.wordId);

    if (wordIds.length === 0) return null;

    const candidates = wordIds
      .filter(id => id !== excludeWordId)
      .map(id => {
        const word = db.words.find(w => w.id === id);
        const progress = db.progress.find(p => p.wordId === id && p.libraryId === libraryId);
        return { word: word!, progress };
      })
      .filter(item => item.word && !item.progress?.isMastered);

    if (candidates.length === 0) return null;

    // 未学过的按词频排序优先
    const unlearned = candidates.filter(c => !c.progress);
    if (unlearned.length > 0) {
      unlearned.sort((a, b) => (a.word.frequencyRank || 99999) - (b.word.frequencyRank || 99999));
      return unlearned[0].word || null;
    }

    // 复习模式：加权随机
    const reviewing = candidates.filter(c => c.progress);
    const weights = reviewing.map(c => {
      let weight = 1.0;
      const mastery = c.progress?.masteryScore || 0;
      weight *= (1.5 - mastery);
      return weight;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < reviewing.length; i++) {
      random -= weights[i];
      if (random <= 0) return reviewing[i].word;
    }

    return reviewing[0]?.word || null;
  }

  // ==================== 学习进度 ====================

  submitFeedback(wordId: number, libraryId: number, feedback: string): Progress {
    const db = this.getDB();
    const scores: Record<string, number> = { unknown: 0, familiar: 0.3, well_known: 0.7, mastered: 1 };

    let progress = db.progress.find(p => p.wordId === wordId && p.libraryId === libraryId);

    if (progress) {
      progress.masteryScore = scores[feedback] ?? 0;
      progress.lastFeedback = feedback;
      progress.reviewCount = (progress.reviewCount || 0) + 1;
      progress.isMastered = feedback === 'mastered';
      progress.lastReviewedAt = Date.now();
    } else {
      progress = {
        id: Date.now() + Math.random(),
        wordId,
        libraryId,
        masteryScore: scores[feedback] ?? 0,
        lastFeedback: feedback,
        reviewCount: 1,
        isMastered: feedback === 'mastered',
        lastReviewedAt: Date.now(),
        createdAt: Date.now()
      };
      db.progress.push(progress);
    }

    if (feedback === 'mastered') {
      this.addToMastered(wordId);
    }

    this.save();
    return progress;
  }

  markAsMastered(wordId: number, libraryId: number): Progress {
    return this.submitFeedback(wordId, libraryId, 'mastered');
  }

  addToMastered(wordId: number): void {
    const db = this.getDB();
    const masteredLib = db.libraries.find(lib => lib.category === 'mastered');
    if (masteredLib) {
      const existing = db.libraryWords.find(
        lw => lw.libraryId === masteredLib.id && lw.wordId === wordId
      );
      if (!existing) {
        db.libraryWords.push({
          libraryId: masteredLib.id,
          wordId,
          addedAt: Date.now()
        });
        this.updateLibraryWordCount(masteredLib.id);
        this.save();
      }
    }
  }

  markWordsAsMastered(wordList: string[]): number {
    const db = this.getDB();
    let marked = 0;
    wordList.forEach(wordText => {
      const word = db.words.find(w => w.word.toLowerCase() === wordText.toLowerCase());
      if (word) {
        const libraryIds = db.libraryWords
          .filter(lw => lw.wordId === word.id)
          .map(lw => lw.libraryId);
        libraryIds.forEach(libraryId => {
          this.markAsMastered(word.id, libraryId);
          marked++;
        });
        if (libraryIds.length === 0) {
          this.addToMastered(word.id);
        }
      }
    });
    this.save();
    return marked;
  }

  // ==================== 统计 ====================

  getGlobalStats(): GlobalStats {
    const db = this.getDB();
    const totalWords = db.words.length;
    const mastered = db.progress.filter(p => p.isMastered).length;
    const learning = db.progress.filter(p => !p.isMastered).length;
    const unlearned = totalWords - mastered - learning;

    return {
      totalWords,
      mastered,
      learning,
      unlearned: Math.max(0, unlearned),
      progress: totalWords > 0 ? Math.round((mastered / totalWords) * 100) : 0
    };
  }

  getLibraryStats(libraryId: number): LibraryStats {
    const db = this.getDB();
    const wordIds = db.libraryWords
      .filter(lw => lw.libraryId === libraryId)
      .map(lw => lw.wordId);

    const total = wordIds.length;
    const progressList = db.progress.filter(p =>
      p.libraryId === libraryId && wordIds.includes(p.wordId)
    );

    const mastered = progressList.filter(p => p.isMastered).length;
    const learning = progressList.filter(p => !p.isMastered).length;

    return {
      total,
      mastered,
      learning,
      unlearned: total - mastered - learning,
      progress: total > 0 ? Math.round((mastered / total) * 100) : 0
    };
  }

  // ==================== 设置 & 统计数据 ====================

  getSettings(): Settings {
    return this.getDB().settings;
  }

  updateSettings(newSettings: Partial<Settings>): Settings {
    const db = this.getDB();
    db.settings = { ...db.settings, ...newSettings };
    this.save();
    return db.settings;
  }

  getStats(): Stats {
    return this.getDB().stats;
  }

  updateStats(newStats: Partial<Stats>): Stats {
    const db = this.getDB();
    db.stats = { ...db.stats, ...newStats };
    this.save();
    return db.stats;
  }

  recordStudyActivity(masteredCount = 0): void {
    const db = this.getDB();
    const today = new Date().toDateString();

    db.stats.totalStudied = (db.stats.totalStudied || 0) + 1;
    db.stats.totalMastered = (db.stats.totalMastered || 0) + masteredCount;

    const lastDate = db.stats.lastStudyDate;
    if (lastDate) {
      const last = new Date(lastDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        db.stats.streakDays = (db.stats.streakDays || 0) + 1;
      } else if (diffDays > 1) {
        db.stats.streakDays = 1;
      }
    } else {
      db.stats.streakDays = 1;
    }

    db.stats.lastStudyDate = today;
    this.save();
  }

  // ==================== 导入导出 ====================

  /**
   * 批量添加单词到指定词库
   * @param wordsData 单词数据数组
   * @param libraryId 目标词库 ID
   * @returns 成功导入的数量
   */
  addWordsBatch(wordsData: Array<Partial<Word> & { word: string }>, libraryId: number): number {
    const db = this.getDB();
    const library = db.libraries.find(lib => lib.id === libraryId);
    if (!library) return 0;

    let addedCount = 0;
    for (const wordData of wordsData) {
      let word = db.words.find(w => w.word.toLowerCase() === wordData.word.toLowerCase());

      if (!word) {
        word = {
          id: Date.now() + Math.random(),
          word: wordData.word.toLowerCase(),
          phonetic: wordData.phonetic || '',
          definitions: wordData.definitions || [],
          phrases: wordData.phrases || [],
          examples: wordData.examples || [],
          frequencyRank: wordData.frequencyRank || 99999,
          createdAt: Date.now()
        };
        db.words.push(word);
      }

      const existingLink = db.libraryWords.find(
        lw => lw.libraryId === libraryId && lw.wordId === word!.id
      );

      if (!existingLink) {
        db.libraryWords.push({
          libraryId,
          wordId: word.id,
          addedAt: Date.now()
        });
        addedCount++;
      }
    }

    this.updateLibraryWordCount(libraryId);
    this.save();
    return addedCount;
  }

  exportData(): DBSchema {
    return this.getDB();
  }

  importData(data: DBSchema): boolean {
    if (data && data.libraries && data.words) {
      Taro.setStorageSync(DB_KEY, data);
      this.db = data;
      return true;
    }
    return false;
  }

  clearAllData(): void {
    Taro.removeStorageSync(DB_KEY);
    this.db = null;
    this.getDB(); // re-initialize
  }
}

export const db = new LocalDatabase();

const app = getApp();

// 本地数据库服务
class LocalDatabase {
  constructor() {
    this.db = null;
  }

  // 获取数据库实例
  getDB() {
    if (!this.db) {
      this.db = app.getDB();
    }
    return this.db;
  }

  // 保存数据库
  save() {
    if (this.db) {
      app.saveDB(this.db);
    }
  }

  // ==================== 词库操作 ====================
  
  // 获取所有词库
  getLibraries() {
    return this.getDB().libraries || [];
  }

  // 获取词库详情
  getLibraryById(id) {
    const libraries = this.getLibraries();
    return libraries.find(lib => lib.id === id) || null;
  }

  // 创建词库
  createLibrary(name, description = '', category = 'custom') {
    const db = this.getDB();
    const newLibrary = {
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

  // 删除词库
  deleteLibrary(id, mergeToLibraryId = null) {
    const db = this.getDB();
    const libraryIndex = db.libraries.findIndex(lib => lib.id === id);
    if (libraryIndex === -1) return false;

    const library = db.libraries[libraryIndex];
    if (library.isBuiltin) return false; // 内置词库不能删除

    // 如果需要合并
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
      // 更新目标词库单词数
      const targetLib = db.libraries.find(lib => lib.id === mergeToLibraryId);
      if (targetLib) {
        targetLib.wordCount = db.libraryWords.filter(lw => lw.libraryId === mergeToLibraryId).length;
      }
    }

    // 删除词库关联
    db.libraryWords = db.libraryWords.filter(lw => lw.libraryId !== id);
    db.progress = db.progress.filter(p => p.libraryId !== id);
    
    // 删除词库
    db.libraries.splice(libraryIndex, 1);
    this.save();
    return true;
  }

  // 更新词库单词数
  updateLibraryWordCount(libraryId) {
    const db = this.getDB();
    const library = db.libraries.find(lib => lib.id === libraryId);
    if (library) {
      library.wordCount = db.libraryWords.filter(lw => lw.libraryId === libraryId).length;
      this.save();
    }
  }

  // ==================== 单词操作 ====================

  // 获取单词列表
  getWords(libraryId, options = {}) {
    const db = this.getDB();
    const { search = '', filter = 'all' } = options;
    
    // 获取词库关联的单词ID
    const wordIds = db.libraryWords
      .filter(lw => lw.libraryId === libraryId)
      .map(lw => lw.wordId);

    // 获取单词详情
    let words = db.words.filter(w => wordIds.includes(w.id));

    // 搜索过滤
    if (search) {
      words = words.filter(w => 
        w.word.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 状态过滤
    if (filter !== 'all') {
      words = words.filter(w => {
        const progress = db.progress.find(p => p.wordId === w.id && p.libraryId === libraryId);
        if (filter === 'mastered') return progress?.isMastered;
        if (filter === 'unlearned') return !progress;
        if (filter === 'learning') return progress && !progress.isMastered;
        return true;
      });
    }

    // 添加进度信息
    return words.map(w => ({
      ...w,
      progress: db.progress.find(p => p.wordId === w.id && p.libraryId === libraryId) || null
    }));
  }

  // 获取单词详情
  getWordById(id) {
    const db = this.getDB();
    return db.words.find(w => w.id === id) || null;
  }

  // 添加单词
  addWord(wordData, libraryId) {
    const db = this.getDB();
    
    // 检查单词是否已存在
    let word = db.words.find(w => w.word.toLowerCase() === wordData.word.toLowerCase());
    
    if (!word) {
      // 创建新单词
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

    // 关联到词库
    const existingLink = db.libraryWords.find(
      lw => lw.libraryId === libraryId && lw.wordId === word.id
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

  // 批量添加单词
  addWords(wordList, libraryId) {
    const results = [];
    wordList.forEach(wordData => {
      try {
        const word = this.addWord(wordData, libraryId);
        results.push({ success: true, word });
      } catch (e) {
        results.push({ success: false, error: e.message });
      }
    });
    this.save();
    return results;
  }

  // 获取下一个学习单词
  getNextFlashcard(libraryId, excludeWordId = null) {
    const db = this.getDB();
    
    // 获取词库的所有单词
    const wordIds = db.libraryWords
      .filter(lw => lw.libraryId === libraryId)
      .map(lw => lw.wordId);

    if (wordIds.length === 0) return null;

    // 获取进度信息
    const candidates = wordIds
      .filter(id => id !== excludeWordId)
      .map(id => {
        const word = db.words.find(w => w.id === id);
        const progress = db.progress.find(p => p.wordId === id && p.libraryId === libraryId);
        return { word, progress };
      })
      .filter(item => item.word && !item.progress?.isMastered);

    if (candidates.length === 0) return null;

    // 优先返回未学过的单词（按词频排序）
    const unlearned = candidates.filter(c => !c.progress);
    if (unlearned.length > 0) {
      unlearned.sort((a, b) => (a.word.frequencyRank || 99999) - (b.word.frequencyRank || 99999));
      return unlearned[0].word;
    }

    // 复习模式：加权随机
    const reviewing = candidates.filter(c => c.progress);
    const weights = reviewing.map(c => {
      let weight = 1.0;
      const mastery = c.progress.masteryScore || 0;
      weight *= (1.5 - mastery);
      return weight;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < reviewing.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return reviewing[i].word;
      }
    }

    return reviewing[0]?.word || null;
  }

  // ==================== 学习进度操作 ====================

  // 提交学习反馈
  submitFeedback(wordId, libraryId, feedback) {
    const db = this.getDB();
    const scores = { unknown: 0, familiar: 0.3, well_known: 0.7, mastered: 1 };
    
    let progress = db.progress.find(p => p.wordId === wordId && p.libraryId === libraryId);
    
    if (progress) {
      progress.masteryScore = scores[feedback] || 0;
      progress.lastFeedback = feedback;
      progress.reviewCount = (progress.reviewCount || 0) + 1;
      progress.isMastered = feedback === 'mastered';
      progress.lastReviewedAt = Date.now();
    } else {
      progress = {
        id: Date.now() + Math.random(),
        wordId,
        libraryId,
        masteryScore: scores[feedback] || 0,
        lastFeedback: feedback,
        reviewCount: 1,
        isMastered: feedback === 'mastered',
        lastReviewedAt: Date.now(),
        createdAt: Date.now()
      };
      db.progress.push(progress);
    }

    // 如果已掌握，添加到已掌握列表
    if (feedback === 'mastered') {
      this.addToMastered(wordId);
    }

    this.save();
    return progress;
  }

  // 标记为已掌握
  markAsMastered(wordId, libraryId) {
    return this.submitFeedback(wordId, libraryId, 'mastered');
  }

  // 添加到已掌握词库
  addToMastered(wordId) {
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

  // 获取全局统计
  getGlobalStats() {
    const db = this.getDB();
    const totalWords = db.words.length;
    const mastered = db.progress.filter(p => p.isMastered).length;
    const learning = db.progress.filter(p => !p.isMastered).length;
    const unlearned = totalWords - mastered - learning;
    
    return {
      totalWords,
      mastered,
      learning,
      unlearned,
      progress: totalWords > 0 ? Math.round((mastered / totalWords) * 100) : 0
    };
  }

  // 获取词库统计
  getLibraryStats(libraryId) {
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

  // ==================== 已掌握单词操作 ====================

  // 批量标记为已掌握
  markWordsAsMastered(wordList) {
    const db = this.getDB();
    let marked = 0;
    
    wordList.forEach(wordText => {
      const word = db.words.find(w => w.word.toLowerCase() === wordText.toLowerCase());
      if (word) {
        // 获取该单词关联的所有词库
        const libraryIds = db.libraryWords
          .filter(lw => lw.wordId === word.id)
          .map(lw => lw.libraryId);
        
        libraryIds.forEach(libraryId => {
          this.markAsMastered(word.id, libraryId);
          marked++;
        });

        // 如果不在任何词库中，添加到已掌握词库
        if (libraryIds.length === 0) {
          this.addToMastered(word.id);
        }
      }
    });

    this.save();
    return marked;
  }

  // ==================== 设置操作 ====================

  // 获取设置
  getSettings() {
    return this.getDB().settings || {};
  }

  // 更新设置
  updateSettings(newSettings) {
    const db = this.getDB();
    db.settings = { ...db.settings, ...newSettings };
    this.save();
    return db.settings;
  }

  // ==================== 统计数据操作 ====================

  // 获取统计数据
  getStats() {
    return this.getDB().stats || {};
  }

  // 更新统计数据
  updateStats(newStats) {
    const db = this.getDB();
    db.stats = { ...db.stats, ...newStats };
    this.save();
    return db.stats;
  }

  // 记录学习活动
  recordStudyActivity(masteredCount = 0) {
    const db = this.getDB();
    const today = new Date().toDateString();
    
    db.stats.totalStudied = (db.stats.totalStudied || 0) + 1;
    db.stats.totalMastered = (db.stats.totalMastered || 0) + masteredCount;
    
    // 更新连续学习天数
    const lastDate = db.stats.lastStudyDate;
    if (lastDate) {
      const last = new Date(lastDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - last) / (1000 * 60 * 60 * 24));
      
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

  // ==================== 数据导入/导出 ====================

  // 导出所有数据
  exportData() {
    return this.getDB();
  }

  // 导入数据
  importData(data) {
    if (data && data.libraries && data.words) {
      wx.setStorageSync('wordflash_db', data);
      this.db = data;
      return true;
    }
    return false;
  }

  // 清空所有数据
  clearAllData() {
    wx.removeStorageSync('wordflash_db');
    this.db = null;
    app.initDatabase();
  }
}

// 导出单例
module.exports = new LocalDatabase();

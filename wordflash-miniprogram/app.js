App({
  globalData: {
    // AI 配置 - 用户需要自行配置
    aiConfig: {
      baseUrl: '',
      apiKey: '',
      model: 'qwen-turbo'
    },
    // 系统信息
    systemInfo: null,
    // 数据版本号，用于数据迁移
    dataVersion: '1.0.0'
  },

  onLaunch() {
    // 获取系统信息
    this.globalData.systemInfo = wx.getSystemInfoSync();
    
    // 初始化本地数据库
    this.initDatabase();
    
    // 加载 AI 配置
    this.loadAIConfig();
    
    console.log('WordFlash 本地版小程序启动');
  },

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  // 初始化本地数据库
  initDatabase() {
    const db = wx.getStorageSync('wordflash_db');
    if (!db) {
      // 首次启动，初始化数据结构
      const initialData = {
        version: this.globalData.dataVersion,
        libraries: this.getDefaultLibraries(),
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
      wx.setStorageSync('wordflash_db', initialData);
      console.log('数据库初始化完成');
    } else {
      // 检查数据版本，进行必要的迁移
      this.migrateDataIfNeeded(db);
    }
  },

  // 获取默认词库
  getDefaultLibraries() {
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
  },

  // 数据迁移
  migrateDataIfNeeded(db) {
    if (db.version !== this.globalData.dataVersion) {
      // 执行数据迁移逻辑
      console.log(`数据迁移: ${db.version} -> ${this.globalData.dataVersion}`);
      db.version = this.globalData.dataVersion;
      wx.setStorageSync('wordflash_db', db);
    }
  },

  // 加载 AI 配置
  loadAIConfig() {
    const config = wx.getStorageSync('ai_config');
    if (config) {
      this.globalData.aiConfig = { ...this.globalData.aiConfig, ...config };
    }
  },

  // 保存 AI 配置
  saveAIConfig(config) {
    this.globalData.aiConfig = { ...this.globalData.aiConfig, ...config };
    wx.setStorageSync('ai_config', this.globalData.aiConfig);
  },

  // 获取数据库
  getDB() {
    return wx.getStorageSync('wordflash_db') || this.initDatabase();
  },

  // 保存数据库
  saveDB(db) {
    wx.setStorageSync('wordflash_db', db);
  },

  // 全局错误处理
  onError(msg) {
    console.error('小程序错误:', msg);
  },

  // 全局未捕获 Promise 错误
  onUnhandledRejection(res) {
    console.error('未处理的 Promise 错误:', res);
  }
});

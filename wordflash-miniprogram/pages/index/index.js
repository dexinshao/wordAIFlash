const db = require('../../services/db');
const ai = require('../../services/ai');

Page({
  data: {
    libraries: [],
    globalStats: null,
    isLoading: true,
    deleteTarget: null,
    deleteTargetId: null,
    showDeleteModal: false,
    mergeTargetId: null,
    showAiModal: false,
    aiInput: '',
    aiGenerating: false,
    aiStep: 'input', // input, generating, preview, chooseLib
    generatedWords: [],
    generatedTopic: '',
    relatedLibraries: [],
    excludeLibId: null,
    selectedTargetLibId: null,
    showExcludeOptions: false,
    masteredWords: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  // 加载数据
  loadData() {
    const libraries = db.getLibraries();
    const globalStats = db.getGlobalStats();
    
    this.setData({
      libraries,
      globalStats,
      isLoading: false
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  // 显示 AI 生成弹窗
  showAiDialog() {
    this.setData({
      showAiModal: true,
      aiStep: 'input',
      aiInput: '',
      generatedWords: [],
      generatedTopic: '',
      excludeLibId: null,
      selectedTargetLibId: null,
      showExcludeOptions: false,
      masteredWords: []
    });
  },

  // 关闭 AI 弹窗
  closeAiDialog() {
    if (this.data.aiGenerating) return;
    this.setData({ showAiModal: false });
  },

  // AI 输入变化
  onAiInputChange(e) {
    this.setData({ aiInput: e.detail.value });
  },

  // 选择快速建议
  selectSuggestion(e) {
    const suggestion = e.currentTarget.dataset.suggestion;
    this.setData({ aiInput: suggestion });
  },

  // 切换排除选项
  toggleExcludeOptions() {
    this.setData({ 
      showExcludeOptions: !this.data.showExcludeOptions 
    });
    
    // 展开时进行 AI 匹配
    if (!this.data.showExcludeOptions && this.data.aiInput) {
      this.findRelatedLibraries();
    }
  },

  // 查找相关词库
  async findRelatedLibraries() {
    if (!ai.isConfigured()) {
      wx.showToast({ title: '请先配置 AI', icon: 'none' });
      return;
    }

    const nonMasteredLibs = this.data.libraries.filter(lib => lib.category !== 'mastered');
    try {
      const relatedIds = await ai.findRelatedLibraries(this.data.aiInput, nonMasteredLibs);
      const relatedLibraries = nonMasteredLibs.filter(lib => relatedIds.includes(lib.id));
      
      this.setData({ 
        relatedLibraries,
        excludeLibId: relatedLibraries.length > 0 ? relatedLibraries[0].id : null
      });
    } catch (error) {
      console.error('查找相关词库失败:', error);
    }
  },

  // 选择排除词库
  onExcludeLibChange(e) {
    const value = e.detail.value;
    const id = value === '' ? null : parseInt(value);
    const lib = id ? this.data.relatedLibraries.find(l => l.id === id) : null;
    this.setData({ 
      excludeLibId: id,
      excludeLibName: lib ? lib.name : ''
    });
  },

  // 生成单词
  async generateWords() {
    if (!this.data.aiInput.trim()) {
      wx.showToast({ title: '请输入学习主题', icon: 'none' });
      return;
    }

    if (!ai.isConfigured()) {
      wx.navigateTo({ url: '/pages/profile/profile' });
      wx.showToast({ title: '请先配置 AI', icon: 'none' });
      return;
    }

    this.setData({ aiGenerating: true, aiStep: 'generating' });

    try {
      // 获取排除单词列表
      let excludeWords = [];
      if (this.data.excludeLibId) {
        const words = db.getWords(this.data.excludeLibId);
        excludeWords = words.map(w => w.word);
      }
      
      // 获取已掌握单词
      const masteredLib = this.data.libraries.find(lib => lib.category === 'mastered');
      if (masteredLib) {
        const masteredWords = db.getWords(masteredLib.id);
        excludeWords = [...excludeWords, ...masteredWords.map(w => w.word)];
      }

      const result = await ai.generateTopicWords(this.data.aiInput, [...new Set(excludeWords)]);
      
      // 为每个单词获取释义
      const wordsWithDefs = [];
      for (const word of result.words) {
        const definition = await ai.fetchWordDefinition(word);
        wordsWithDefs.push({
          word,
          definition: definition || { definitions: [{ pos: '', meaning: '释义获取中...' }] },
          tags: []
        });
      }

      this.setData({
        aiStep: 'preview',
        aiGenerating: false,
        generatedWords: wordsWithDefs,
        generatedTopic: result.topic,
        selectedTargetLibId: null
      });

      // 查找相关词库用于合并选项
      this.findRelatedLibraries();
    } catch (error) {
      wx.showToast({ title: error.message || '生成失败', icon: 'none' });
      this.setData({ aiGenerating: false, aiStep: 'input' });
    }
  },

  // 删除生成的单词
  removeGeneratedWord(e) {
    const index = e.currentTarget.dataset.index;
    const word = this.data.generatedWords[index];
    
    const words = [...this.data.generatedWords];
    words.splice(index, 1);
    
    const masteredWords = [...this.data.masteredWords, word.word];
    
    this.setData({ 
      generatedWords: words,
      masteredWords
    });

    // 标记为已掌握
    db.markWordsAsMastered([word.word]);
  },

  // 进入选择词库步骤
  goToChooseLib() {
    if (this.data.generatedWords.length === 0) {
      wx.showToast({ title: '没有单词可添加', icon: 'none' });
      return;
    }
    this.setData({ aiStep: 'chooseLib' });
  },

  // 选择目标词库
  selectTargetLib(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedTargetLibId: id });
  },

  // 创建词库并添加单词
  async createLibrary() {
    if (this.data.generatedWords.length === 0) return;

    this.setData({ aiGenerating: true });

    try {
      let libraryId;
      
      if (this.data.selectedTargetLibId) {
        // 合并到已有词库
        libraryId = this.data.selectedTargetLibId;
      } else {
        // 创建新词库
        const newLib = db.createLibrary(
          `🤖 ${this.data.generatedTopic}`,
          `AI 生成：${this.data.generatedTopic} 相关词汇`,
          'ai_topic'
        );
        libraryId = newLib.id;
      }

      // 添加单词
      for (const item of this.data.generatedWords) {
        db.addWord({
          word: item.word,
          phonetic: item.definition.phonetic,
          definitions: item.definition.definitions,
          phrases: item.definition.phrases,
          examples: item.definition.examples
        }, libraryId);
      }

      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showAiModal: false });
      this.loadData();
      
      // 跳转到学习页面
      wx.navigateTo({ url: `/pages/study/study?libraryId=${libraryId}` });
    } catch (error) {
      wx.showToast({ title: error.message || '创建失败', icon: 'none' });
      this.setData({ aiGenerating: false });
    }
  },

  // 开始学习
  startStudy(e) {
    const libraryId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/study/study?libraryId=${libraryId}` });
  },

  // 查看单词列表
  viewWordList(e) {
    const libraryId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/wordlist/wordlist?libraryId=${libraryId}` });
  },

  // 显示删除弹窗
  showDeleteModal(e) {
    const library = e.currentTarget.dataset.library;
    this.setData({
      deleteTarget: library,
      deleteTargetId: library ? library.id : null,
      showDeleteModal: true,
      mergeTargetId: null
    });
  },

  // 关闭删除弹窗
  closeDeleteModal() {
    this.setData({ 
      showDeleteModal: false,
      deleteTarget: null,
      mergeTargetId: null
    });
  },

  // 选择合并目标
  selectMergeTarget(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ mergeTargetId: id });
  },

  // 确认删除
  confirmDelete() {
    const { deleteTarget, mergeTargetId } = this.data;
    if (!deleteTarget) return;

    const success = db.deleteLibrary(deleteTarget.id, mergeTargetId);
    
    if (success) {
      wx.showToast({ 
        title: mergeTargetId ? '已合并删除' : '已删除',
        icon: 'success'
      });
      this.loadData();
      this.closeDeleteModal();
    } else {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  // 导出已掌握单词
  exportMasteredWords() {
    const masteredLib = this.data.libraries.find(lib => lib.category === 'mastered');
    if (!masteredLib || masteredLib.wordCount === 0) {
      wx.showToast({ title: '暂无已掌握单词', icon: 'none' });
      return;
    }

    const words = db.getWords(masteredLib.id);
    const wordList = words.map(w => w.word).join('\n');
    
    wx.setClipboardData({
      data: wordList,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  }
});

const db = require('../../services/db');

Page({
  data: {
    libraryId: null,
    library: null,
    words: [],
    filter: 'all', // all, mastered, unlearned, learning
    searchQuery: '',
    isLoading: true,
    stats: null
  },

  onLoad(options) {
    const libraryId = parseInt(options.libraryId);
    if (!libraryId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
      return;
    }

    const library = db.getLibraryById(libraryId);
    if (!library) {
      wx.showToast({ title: '词库不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }

    this.setData({ libraryId, library });
    this.loadWords();
  },

  onShow() {
    this.loadWords();
  },

  // 加载单词列表
  loadWords() {
    const { libraryId, filter, searchQuery } = this.data;
    const words = db.getWords(libraryId, { filter, search: searchQuery });
    const stats = db.getLibraryStats(libraryId);

    this.setData({
      words,
      stats,
      isLoading: false
    });
  },

  // 搜索
  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value });
    this.loadWords();
  },

  // 切换筛选
  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ filter });
    this.loadWords();
  },

  // 标记为已掌握
  markAsMastered(e) {
    const wordId = e.currentTarget.dataset.id;
    db.markAsMastered(wordId, this.data.libraryId);
    this.loadWords();
    wx.showToast({ title: '已标记为掌握', icon: 'success' });
  },

  // 朗读单词
  speakWord(e) {
    const word = e.currentTarget.dataset.word;
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word)}`;
    innerAudioContext.play();
  },

  // 开始学习
  startStudy() {
    wx.navigateTo({
      url: `/pages/study/study?libraryId=${this.data.libraryId}`
    });
  },

  // 返回
  goBack() {
    wx.navigateBack();
  }
});

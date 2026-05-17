const db = require('../../services/db');

Page({
  data: {
    libraryId: null,
    library: null,
    currentWord: null,
    isFlipped: false,
    isAnimating: false,
    sessionStats: {
      studied: 0,
      mastered: 0
    },
    history: [],
    isReviewing: false,
    isComplete: false,
    studyCount: 0
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
    this.loadNextWord();
  },

  // 加载下一个单词
  loadNextWord() {
    const word = db.getNextFlashcard(this.data.libraryId);
    
    if (!word) {
      this.setData({ isComplete: true });
      return;
    }

    this.setData({
      currentWord: word,
      isFlipped: false,
      isAnimating: false
    });
  },

  // 翻转卡片
  flipCard() {
    if (this.data.isAnimating) return;
    this.setData({ isFlipped: true });
  },

  // 提交反馈
  submitFeedback(e) {
    if (!this.data.currentWord || this.data.isAnimating) return;
    
    const feedback = e.currentTarget.dataset.feedback;
    this.setData({ isAnimating: true });

    // 保存进度
    db.submitFeedback(
      this.data.currentWord.id,
      this.data.libraryId,
      feedback
    );

    // 更新历史记录
    const history = [...this.data.history, {
      word: this.data.currentWord,
      feedback
    }];

    // 更新统计
    const sessionStats = {
      studied: this.data.sessionStats.studied + 1,
      mastered: feedback === 'mastered' 
        ? this.data.sessionStats.mastered + 1 
        : this.data.sessionStats.mastered
    };

    this.setData({
      history,
      sessionStats,
      studyCount: this.data.studyCount + 1
    });

    // 延迟后加载下一个
    setTimeout(() => {
      this.setData({
        isFlipped: false,
        isReviewing: false
      });
      this.loadNextWord();
    }, 300);
  },

  // 直接标记为已掌握
  markAsMastered() {
    if (!this.data.currentWord || this.data.isAnimating) return;
    
    this.setData({ isAnimating: true });

    db.markAsMastered(
      this.data.currentWord.id,
      this.data.libraryId
    );

    const history = [...this.data.history, {
      word: this.data.currentWord,
      feedback: 'mastered'
    }];

    const sessionStats = {
      studied: this.data.sessionStats.studied + 1,
      mastered: this.data.sessionStats.mastered + 1
    };

    this.setData({
      history,
      sessionStats,
      studyCount: this.data.studyCount + 1
    });

    setTimeout(() => {
      this.setData({
        isFlipped: false,
        isReviewing: false
      });
      this.loadNextWord();
    }, 300);
  },

  // 返回上一个单词
  goBack() {
    if (this.data.history.length === 0 || this.data.isAnimating) return;

    const prev = this.data.history[this.data.history.length - 1];
    const history = this.data.history.slice(0, -1);

    // 回退统计
    const sessionStats = { ...this.data.sessionStats };
    sessionStats.studied = Math.max(0, sessionStats.studied - 1);
    if (prev.feedback === 'mastered') {
      sessionStats.mastered = Math.max(0, sessionStats.mastered - 1);
    }

    this.setData({
      currentWord: prev.word,
      isFlipped: true,
      isReviewing: true,
      history,
      sessionStats,
      studyCount: Math.max(0, this.data.studyCount - 1),
      isAnimating: false
    });
  },

  // 朗读单词
  speakWord() {
    if (!this.data.currentWord) return;
    
    const innerAudioContext = wx.createInnerAudioContext();
    // 使用有道词典发音 API
    innerAudioContext.src = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(this.data.currentWord.word)}`;
    innerAudioContext.play();
  },

  // 继续学习
  continueStudy() {
    this.setData({
      isComplete: false,
      sessionStats: { studied: 0, mastered: 0 },
      history: []
    });
    this.loadNextWord();
  },

  // 返回首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 返回上一页
  goBackPage() {
    wx.navigateBack();
  }
});

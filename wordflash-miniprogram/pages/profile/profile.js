const db = require('../../services/db');
const ai = require('../../services/ai');

Page({
  data: {
    globalStats: null,
    stats: null,
    settings: null,
    aiConfig: {
      baseUrl: '',
      apiKey: '',
      model: 'qwen-turbo'
    },
    showAiConfig: false,
    showDataManage: false,
    dataSize: '0 KB'
  },

  onLoad() {
    this.loadData();
    this.calculateDataSize();
  },

  onShow() {
    this.loadData();
    this.calculateDataSize();
  },

  // 加载数据
  loadData() {
    const globalStats = db.getGlobalStats();
    const stats = db.getStats();
    const settings = db.getSettings();
    const aiConfig = ai.getConfig();

    this.setData({
      globalStats,
      stats,
      settings,
      aiConfig: {
        baseUrl: aiConfig.baseUrl || '',
        apiKey: aiConfig.apiKey || '',
        model: aiConfig.model || 'qwen-turbo'
      }
    });
  },

  // 计算数据大小
  calculateDataSize() {
    try {
      const data = wx.getStorageSync('wordflash_db');
      if (data) {
        const jsonStr = JSON.stringify(data);
        const bytes = new Blob([jsonStr]).size;
        const kb = (bytes / 1024).toFixed(1);
        this.setData({ dataSize: `${kb} KB` });
      }
    } catch (e) {
      this.setData({ dataSize: '未知' });
    }
  },

  // 显示 AI 配置弹窗
  showAiConfigModal() {
    this.setData({ showAiConfig: true });
  },

  // 关闭 AI 配置弹窗
  closeAiConfigModal() {
    this.setData({ showAiConfig: false });
  },

  // AI 配置输入变化
  onAiUrlChange(e) {
    this.setData({ 'aiConfig.baseUrl': e.detail.value });
  },

  onAiKeyChange(e) {
    this.setData({ 'aiConfig.apiKey': e.detail.value });
  },

  onAiModelChange(e) {
    this.setData({ 'aiConfig.model': e.detail.value });
  },

  // 保存 AI 配置
  saveAiConfig() {
    const { baseUrl, apiKey, model } = this.data.aiConfig;
    
    if (!baseUrl.trim() || !apiKey.trim()) {
      wx.showToast({ title: '请填写完整配置', icon: 'none' });
      return;
    }

    ai.saveConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model });
    wx.showToast({ title: '保存成功', icon: 'success' });
    this.closeAiConfigModal();
  },

  // 测试 AI 连接
  async testAiConnection() {
    if (!this.data.aiConfig.baseUrl || !this.data.aiConfig.apiKey) {
      wx.showToast({ title: '请先填写配置', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '测试中...' });

    try {
      // 临时保存配置用于测试
      ai.saveConfig(this.data.aiConfig);
      
      // 调用一个简单的测试
      const result = await ai.callAI([
        { role: 'user', content: 'Hello' }
      ], { maxTokens: 10 });

      wx.hideLoading();
      wx.showModal({
        title: '连接成功',
        content: 'AI 服务连接正常，可以开始使用了！',
        showCancel: false
      });
    } catch (error) {
      wx.hideLoading();
      wx.showModal({
        title: '连接失败',
        content: error.message || '无法连接到 AI 服务，请检查配置',
        showCancel: false
      });
    }
  },

  // 显示数据管理弹窗
  showDataManageModal() {
    this.setData({ showDataManage: true });
  },

  // 关闭数据管理弹窗
  closeDataManageModal() {
    this.setData({ showDataManage: false });
  },

  // 导出数据
  exportData() {
    const data = db.exportData();
    const jsonStr = JSON.stringify(data, null, 2);
    
    wx.setClipboardData({
      data: jsonStr,
      success: () => {
        wx.showModal({
          title: '导出成功',
          content: '数据已复制到剪贴板，请妥善保存。',
          showCancel: false
        });
      }
    });
  },

  // 导入数据
  importData() {
    wx.showModal({
      title: '导入数据',
      content: '导入数据将覆盖当前所有数据，确定要继续吗？',
      success: (res) => {
        if (res.confirm) {
          wx.getClipboardData({
            success: (clipboard) => {
              try {
                const data = JSON.parse(clipboard.data);
                if (db.importData(data)) {
                  wx.showToast({ title: '导入成功', icon: 'success' });
                  this.loadData();
                  this.calculateDataSize();
                } else {
                  wx.showToast({ title: '数据格式错误', icon: 'none' });
                }
              } catch (e) {
                wx.showToast({ title: '导入失败：无效数据', icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  // 清空所有数据
  clearAllData() {
    wx.showModal({
      title: '清空数据',
      content: '此操作将删除所有词库、单词和学习进度，且无法恢复。确定要继续吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '再次确认',
            content: '你真的要清空所有数据吗？',
            confirmColor: '#ef4444',
            success: (res2) => {
              if (res2.confirm) {
                db.clearAllData();
                wx.showToast({ title: '数据已清空', icon: 'success' });
                this.loadData();
                this.calculateDataSize();
              }
            }
          });
        }
      }
    });
  },

  // 设置每日目标
  setDailyGoal() {
    wx.showActionSheet({
      itemList: ['10 个', '20 个', '30 个', '50 个', '100 个'],
      success: (res) => {
        const goals = [10, 20, 30, 50, 100];
        db.updateSettings({ dailyGoal: goals[res.tapIndex] });
        this.loadData();
        wx.showToast({ title: '设置成功', icon: 'success' });
      }
    });
  },

  // 切换提醒
  toggleReminder(e) {
    const enabled = e.detail.value;
    db.updateSettings({ reminderEnabled: enabled });
    this.loadData();
  },

  // 设置提醒时间
  setReminderTime(e) {
    const time = e.detail.value;
    db.updateSettings({ reminderTime: time });
    this.loadData();
  },

  // 关于页面
  showAbout() {
    wx.showModal({
      title: '关于 WordFlash',
      content: 'WordFlash 是一款 AI 驱动的英语单词学习应用。\n\n所有数据存储在本地，无需注册账号，保护您的隐私。',
      showCancel: false
    });
  }
});

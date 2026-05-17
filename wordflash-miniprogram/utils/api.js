const app = getApp();

// API 请求封装
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: `${app.globalData.apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token 过期，清除登录状态
          wx.removeStorageSync('token');
          wx.showToast({ title: '登录已过期', icon: 'none' });
          reject(new Error('Unauthorized'));
        } else {
          const errorMsg = res.data?.message || `请求失败 (${res.statusCode})`;
          wx.showToast({ title: errorMsg, icon: 'none' });
          reject(new Error(errorMsg));
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      }
    });
  });
};

// API 方法
module.exports = {
  // GET 请求
  get: (url, params = {}) => request({ url, method: 'GET', data: params }),
  
  // POST 请求
  post: (url, data = {}) => request({ url, method: 'POST', data }),
  
  // PUT 请求
  put: (url, data = {}) => request({ url, method: 'PUT', data }),
  
  // DELETE 请求
  delete: (url) => request({ url, method: 'DELETE' }),

  // 词库相关
  library: {
    // 获取词库列表
    list: () => request({ url: '/api/library/list', method: 'GET' }),
    
    // 获取词库详情
    getById: (id) => request({ url: '/api/library/getById', method: 'GET', data: { id } }),
    
    // 删除词库
    delete: (id, mergeToLibraryId) => request({ 
      url: '/api/library/delete', 
      method: 'POST', 
      data: { id, mergeToLibraryId } 
    })
  },

  // 单词相关
  word: {
    // 获取单词列表
    list: (libraryId, params = {}) => request({ 
      url: '/api/word/list', 
      method: 'GET', 
      data: { libraryId, ...params } 
    }),
    
    // 获取下一个闪卡
    getNextFlashcard: (libraryId, excludeWordId) => request({ 
      url: '/api/word/getNextFlashcard', 
      method: 'GET', 
      data: { libraryId, excludeWordId } 
    })
  },

  // 学习进度相关
  progress: {
    // 提交反馈
    submitFeedback: (data) => request({ 
      url: '/api/progress/submitFeedback', 
      method: 'POST', 
      data 
    }),
    
    // 标记为已掌握
    markAsMastered: (data) => request({ 
      url: '/api/progress/markAsMastered', 
      method: 'POST', 
      data 
    }),
    
    // 获取全局统计
    getGlobalStats: () => request({ url: '/api/progress/getGlobalStats', method: 'GET' }),
    
    // 获取词库统计
    getLibraryStats: (libraryId) => request({ 
      url: '/api/progress/getLibraryStats', 
      method: 'GET', 
      data: { libraryId } 
    })
  },

  // AI 相关
  ai: {
    // 生成主题单词
    generateTopicWords: (prompt, excludeLibraryId) => request({ 
      url: '/api/ai/generateTopicWords', 
      method: 'POST', 
      data: { prompt, excludeLibraryId } 
    }),
    
    // 查找相关词库
    findRelatedLibraries: (topic) => request({ 
      url: '/api/ai/findRelatedLibraries', 
      method: 'POST', 
      data: { topic } 
    }),
    
    // 创建主题词库
    createTopicLibrary: (data) => request({ 
      url: '/api/ai/createTopicLibrary', 
      method: 'POST', 
      data 
    }),
    
    // 标记单词为已掌握
    markWordsAsMastered: (wordList) => request({ 
      url: '/api/ai/markWordsAsMastered', 
      method: 'POST', 
      data: { wordList } 
    })
  }
};

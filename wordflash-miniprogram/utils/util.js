// 格式化日期
const formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute);
};

// 防抖函数
const debounce = (fn, delay = 300) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 节流函数
const throttle = (fn, interval = 300) => {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
};

// 显示加载中
const showLoading = (title = '加载中...') => {
  wx.showLoading({ title, mask: true });
};

// 隐藏加载
const hideLoading = () => {
  wx.hideLoading();
};

// 显示成功提示
const showSuccess = (title = '成功', duration = 1500) => {
  wx.showToast({ title, icon: 'success', duration });
};

// 显示错误提示
const showError = (title = '失败', duration = 1500) => {
  wx.showToast({ title, icon: 'error', duration });
};

// 显示普通提示
const showToast = (title = '', icon = 'none', duration = 1500) => {
  wx.showToast({ title, icon, duration });
};

// 确认对话框
const showConfirm = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => resolve(res.confirm)
    });
  });
};

// 本地存储
const storage = {
  set: (key, value) => {
    try {
      wx.setStorageSync(key, value);
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },
  get: (key, defaultValue = null) => {
    try {
      return wx.getStorageSync(key) || defaultValue;
    } catch (e) {
      console.error('Storage get error:', e);
      return defaultValue;
    }
  },
  remove: (key) => {
    try {
      wx.removeStorageSync(key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  },
  clear: () => {
    try {
      wx.clearStorageSync();
      return true;
    } catch (e) {
      console.error('Storage clear error:', e);
      return false;
    }
  }
};

// 文本转语音
const speak = (text, rate = 0.8) => {
  // 微信小程序使用微信同声传译插件或第三方 TTS 服务
  // 这里预留接口，需要接入实际的语音服务
  console.log('朗读:', text);
};

// 复制文本到剪贴板
const copyText = async (text) => {
  try {
    await wx.setClipboardData({ data: text });
    showSuccess('已复制');
    return true;
  } catch (e) {
    showError('复制失败');
    return false;
  }
};

// 检查网络状态
const checkNetwork = () => {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => {
        resolve(res.networkType !== 'none');
      },
      fail: () => resolve(false)
    });
  });
};

// 获取系统信息
const getSystemInfo = () => {
  try {
    return wx.getSystemInfoSync();
  } catch (e) {
    return null;
  }
};

// 计算学习进度百分比
const calculateProgress = (mastered, total) => {
  if (!total) return 0;
  return Math.round((mastered / total) * 100);
};

// 格式化数字（超过 1000 显示为 1k）
const formatNumber = (num) => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return String(num);
};

module.exports = {
  formatDate,
  debounce,
  throttle,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showToast,
  showConfirm,
  storage,
  speak,
  copyText,
  checkNetwork,
  getSystemInfo,
  calculateProgress,
  formatNumber
};

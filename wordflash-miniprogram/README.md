# WordFlash 微信小程序（本地版）

一款 AI 驱动的英语单词学习小程序，所有数据存储在本地，无需注册账号，保护隐私。

## 特点

- **纯本地存储**：所有词库、单词和学习进度都保存在用户手机本地
- **无需账号**：不需要注册登录，打开即用
- **AI 智能生成**：描述学习主题，AI 自动生成相关词库
- **闪卡学习**：点击翻转查看释义，四级掌握程度反馈
- **数据可迁移**：支持导出/导入数据，换手机不丢进度

## 项目结构

```
wordflash-miniprogram/
├── app.js              # 小程序入口
├── app.json            # 全局配置
├── app.wxss            # 全局样式
├── sitemap.json        # 站点地图
├── pages/              # 页面
│   ├── index/          # 首页 - 词库列表
│   ├── study/          # 学习页面 - 闪卡学习
│   ├── wordlist/       # 单词列表
│   └── profile/        # 个人中心
├── services/           # 服务层
│   ├── db.js           # 本地数据库服务
│   └── ai.js           # AI 服务
├── utils/              # 工具函数
│   ├── util.js         # 通用工具
│   └── api.js          # API 封装（预留）
├── components/         # 组件（预留）
└── assets/             # 静态资源
    └── icons/          # 图标
```

## 功能说明

### 1. AI 生成词库
- 在首页点击 AI 生成入口
- 描述你想学习的主题（如"天气相关词汇"）
- 选择是否排除已有词库中的单词
- AI 自动生成 15-30 个相关单词
- 可删除不需要的单词
- 选择创建新词库或合并到已有词库

### 2. 闪卡学习
- 点击词库的"开始学习"进入学习模式
- 点击卡片翻转查看释义
- 四级掌握程度反馈：不认识/有点印象/快记住了/已掌握
- 支持"上一个"回退功能
- 支持语音朗读（使用有道词典发音）

### 3. 单词列表
- 查看词库中所有单词
- 支持搜索和筛选（全部/已掌握/学习中/未学习）
- 显示学习进度和复习次数
- 可手动标记为已掌握

### 4. 个人中心
- 查看学习统计（总单词、已掌握、学习中、总进度）
- 设置每日学习目标
- 配置 AI 服务（支持阿里云 DashScope 等 OpenAI 兼容 API）
- 数据导入/导出（通过剪贴板）
- 清空所有数据

## 技术栈

- **框架**：微信小程序原生框架
- **数据存储**：`wx.getStorageSync` / `wx.setStorageSync`
- **AI 服务**：支持 OpenAI 兼容 API（阿里云 DashScope 等）
- **发音**：有道词典语音 API
- **释义**：有道词典 API

## 配置 AI 服务

1. 进入个人中心 → AI 配置
2. 填写 API 地址（如阿里云 DashScope）
3. 填写 API Key
4. 点击"测试连接"验证
5. 保存配置

**推荐 AI 服务**：
- 阿里云 DashScope（通义千问）
- 其他 OpenAI 兼容 API

## 数据说明

### 存储位置
所有数据存储在微信小程序本地存储中，路径为 `wordflash_db`。

### 数据结构
```javascript
{
  version: '1.0.0',           // 数据版本
  libraries: [...],           // 词库列表
  words: [...],               // 单词详情
  libraryWords: [...],        // 词库-单词关联
  progress: [...],            // 学习进度
  settings: {...},            // 用户设置
  stats: {...}                // 统计数据
}
```

### 数据迁移
- **导出**：个人中心 → 导入/导出 → 导出数据（复制到剪贴板）
- **导入**：个人中心 → 导入/导出 → 导入数据（从剪贴板粘贴）

## 开发说明

### 本地数据库服务
`services/db.js` 提供了完整的本地数据库操作：
- `getLibraries()` - 获取词库列表
- `createLibrary(name, description, category)` - 创建词库
- `deleteLibrary(id, mergeToLibraryId)` - 删除词库
- `getWords(libraryId, options)` - 获取单词列表
- `addWord(wordData, libraryId)` - 添加单词
- `getNextFlashcard(libraryId)` - 获取下一个学习单词
- `submitFeedback(wordId, libraryId, feedback)` - 提交学习反馈
- `getGlobalStats()` - 获取全局统计
- `exportData()` / `importData(data)` - 导出/导入数据

### AI 服务
`services/ai.js` 封装了 AI 调用：
- `generateTopicWords(topic, excludeWords)` - 生成主题单词
- `findRelatedLibraries(topic, libraries)` - 查找相关词库
- `fetchWordDefinition(word)` - 获取单词释义

## 注意事项

1. **数据安全**：数据仅存储在本地，卸载小程序会丢失数据，建议定期导出备份
2. **AI 配置**：AI 功能需要自行配置 API，API Key 仅存储在本地
3. **存储限制**：微信小程序本地存储有 10MB 限制，一般足够使用
4. **网络需求**：AI 生成和发音功能需要网络连接

## 许可证

MIT

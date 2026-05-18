# WordFlash 项目开发记录

## 项目概述

基于 Taro 框架重新搭建 WordFlash 英语单词学习小程序，从原生微信小程序迁移至 Taro 4.x + React 18 + Taro UI 技术栈，集成腾讯云 CloudBase AI 服务（混元大模型），实现零配置 AI 智能生词功能。

---

## 一、项目初始化

- 使用 `miniprogram` 模板初始化 Taro 项目
- 技术栈：Taro 4.x + React 18 + Taro UI + SCSS + Express + TypeScript
- 配置 TabBar 图标（词库、我的），主题色 #3b82f6
- 配置四个页面路由：首页、学习页、单词列表页、个人中心页

---

## 二、核心功能开发

### 2.1 数据层（services/db.ts）

- 本地存储方案，使用 `Taro.getStorageSync` / `setStorageSync`
- 实现 LocalDatabase 类，包含：
  - 词库 CRUD（创建、删除、合并、更新单词数）
  - 单词管理（添加、查询、搜索、筛选）
  - 闪卡算法（未学按词频排序优先、复习按掌握度加权随机）
  - 学习进度（四档反馈评分、已掌握标记、自动归入已掌握词库）
  - 全局统计 / 词库统计
  - 数据导入导出 / 清空
- 9 个内置词库：四级、六级、托福、雅思、专八、BEC、高中、高频10000、已掌握

### 2.2 首页（pages/index）

- 渐变色统计卡片：总单词、已掌握、学习中、未学习、进度条
- AI 智能生词入口
- 词库网格列表，每个词库卡片包含：
  - 分类图标 + 词库名 + 单词数
  - 有数据：显示学习/列表按钮
  - 无数据：显示"点击 AI 生词添加"引导
- AI 生词弹窗四步流程：
  1. 输入主题 + 快速建议标签
  2. 生成中动画
  3. 预览结果（可删除不想要的单词）
  4. 选择目标词库（新建或合并到已有词库）
- 删除词库弹窗（支持合并到其他词库）
- 已掌握单词导出（复制到剪贴板）

### 2.3 学习页（pages/study）

- 闪卡居中展示，点击翻转查看释义
- 卡片正面：单词 + 音标 + 词频排名(#N) + 发音按钮 + 快捷已掌握
- 卡片背面：释义（词性+含义）+ 例句 + 词组
- 四档反馈按钮：不认识(红)、有点印象(蓝)、快记住了(琥珀)、已掌握(绿)
- 回退上一个单词
- 有道词典发音
- 会话统计（本次学习/掌握数量）
- 学习完成页（继续学习/返回首页）

### 2.4 单词列表页（pages/wordlist）

- 搜索栏
- 状态筛选（全部/未学习/学习中/已掌握）
- 单词列表（单词 + 音标 + 释义 + 词频 + 学习状态标签）

### 2.5 个人中心页（pages/profile）

- AI 服务连接状态（自动检测，无需手动配置）
- 学习统计（累计学习/累计掌握/连续天数）
- 数据管理（导出/清空）

---

## 三、AI 服务集成

### 3.1 前端 AI 服务（services/ai.ts）

- 改为调用后端 API，不再需要用户手动配置 API 地址和密钥
- 接口：`generateTopicWords`、`findRelatedLibraries`、`fetchWordDefinition`、`testConnection`

### 3.2 后端 AI 代理（backend/src/modules/ai.ts）

- 使用 CloudBase AI REST API（OpenAI 兼容协议）
- 端点：`https://{ENV_ID}.api.tcloudbasegateway.com/v1/ai/hunyuan-v3/chat/completions`
- 认证：`Authorization: Bearer {API_KEY}`
- 模型：`hy3-preview`（hunyuan-v3 分组）
- 5 个 API 接口：
  - `POST /api/ai/chat` — 通用对话
  - `POST /api/ai/generate-words` — 主题生词
  - `POST /api/ai/find-libraries` — 匹配相关词库
  - `POST /api/ai/word-definition` — 有道词典释义代理
  - `GET /api/ai/test` — 连接测试
- API Key 存储在后端 `.env` 文件，前端不可见

### 3.3 隐藏 AI 配置

- 移除个人中心的 API 地址/密钥/模型输入框
- 替换为 AI 服务状态展示（连接中/已连接/不可用）
- 提示文字："AI 服务由腾讯混元大模型提供，无需手动配置"

---

## 四、词库数据初始化

### 4.1 数据来源

- 六级词汇：从原项目 `CET6_单词表.txt` 导入（2,273 行，去重后 2,219 词）
- COCA 高频 10000 词：从原项目 `COCA_高频10000词.txt` 导入（8,670 词，含词频排名）
- 四级词汇：从 COCA 排名 501-3500 提取（2,613 词）
- 高中词汇：从 COCA 排名 101-1500 提取（1,249 词）

### 4.2 初始化流程

- 后端接口 `POST /api/data/init-libraries`（backend/src/modules/data.ts）
- 解析词表文件，构建完整数据库对象
- 前端首次启动时自动调用（services/init-data.ts）
- 数据写入本地存储，后续离线可用
- 总去重单词数：8,911

### 4.3 各词库数据量

| 词库 | 单词数 | 数据来源 |
|------|--------|----------|
| 四级词汇 | 2,613 | COCA 排名 501-3500 |
| 六级词汇 | 2,219 | CET6_单词表.txt |
| 托福词汇 | 0 | 待 AI 生成 |
| 雅思词汇 | 0 | 待 AI 生成 |
| 英语八级 | 0 | 待 AI 生成 |
| BEC商务 | 0 | 待 AI 生成 |
| 高中词汇 | 1,249 | COCA 排名 101-1500 |
| 高频10000 | 8,670 | COCA_高频10000词.txt |
| 已掌握 | 0 | 学习过程中自动积累 |

---

## 五、问题修复

### 5.1 空词库学习跳转问题

- **问题**：点击空词库的"学习"按钮后，闪卡返回 null，页面直接显示"学习完成"，看起来像回到了首页
- **修复**：
  - 空词库点学习时弹出提示"词库为空，请先添加单词"
  - 空词库卡片显示"点击 AI 生词添加"引导文字
  - 有数据的词库才显示学习/列表按钮

### 5.2 CloudBase AI Token 额度耗尽问题

- **问题**：最初使用 `hunyuan-turbo` 模型（hunyuan-exp 分组），调用时返回 `429 EXCEED_TOKEN_QUOTA_LIMIT`，小程序成长计划赠送的体验额度已耗尽
- **排查**：登录 CloudBase 控制台查看 AI 资源用量，发现 hunyuan-exp 分组额度为 0，而 hunyuan-v3 分组有 100,100,000 Token 完全未使用
- **修复**：切换至 `hunyuan-v3` 分组的 `hy3-preview` 模型，API 端点从 `hunyuan-turbo` 改为 `hunyuan-v3`
- **教训**：CloudBase 小程序成长计划赠送的体验模型额度有限，应优先使用 `hy3-preview`（hunyuan-v3）而非 `hunyuan-turbo`（hunyuan-exp），前者有 1 亿 Token 免费额度

### 5.3 CloudBase AI 认证问题

- **问题**：最初尝试使用 CloudBase Auth Proxy 代理认证，在沙箱环境中返回 401 未授权
- **排查**：沙箱环境未绑定腾讯云 OAuth 账号，auth-proxy 无法获取有效 Token
- **修复**：改为直接使用 CloudBase API Key（JWT 格式），由用户提供后写入后端 `.env` 文件，通过 `Authorization: Bearer {API_KEY}` 直接调用 AI 接口

### 5.4 ES Module 兼容问题

- **问题**：后端 `type: "module"`，`require('node-fetch')` 报错 `require is not defined`
- **修复**：使用 `createRequire(import.meta.url)` 创建 require 函数加载 CommonJS 包

### 5.5 GitHub 代码推送问题

- **问题 1**：`gh auth login --web` 在沙箱环境中无法完成浏览器授权流程，验证码过期后无法刷新
- **问题 2**：第一个 Personal Access Token（fine-grained）没有 `repo` 权限，创建仓库返回 `Resource not accessible`，推送返回 `401 Bad credentials`
- **问题 3**：第一个 Token 失效后，`gh auth login --with-token` 也返回 401
- **修复**：重新生成 Classic Token（勾选 `repo` 完整权限），通过 `git remote set-url` 嵌入 Token 认证，推送至 `taro` 分支的 `wordflash-taro/` 目录
- **教训**：Fine-grained Token 权限粒度细，容易遗漏必要权限；Classic Token 勾选 `repo` 即可满足大部分场景

### 5.6 上传文件问题

- **问题**：用户希望上传本地 zip 包到沙箱环境，Cloud Studio 没有直接上传文件入口
- **替代方案**：
  1. 将代码推送到 GitHub 公开仓库，在沙箱中 `git clone` 拉取
  2. 私有仓库需授权 GitHub Token 后 clone
- **教训**：Cloud Studio 沙箱是云端容器，无法直接访问本地文件系统；需通过 GitHub 等代码托管平台中转

### 5.7 下载文件问题

- **问题**：Cloud Studio 文件浏览器无法右键下载文件，只能拖到对话框
- **替代方案**：将文件放到前端 `public/` 目录，通过预览 URL 直接访问下载
- **教训**：沙箱环境的文件操作受限，需利用 Web 服务暴露静态文件

---

## 六、项目文件结构

```
frontend/src/
├── app.tsx                    # 根组件（初始化词库数据）
├── app.config.ts              # 页面路由 + TabBar 配置
├── app.scss                   # 全局样式
├── pages/
│   ├── index/                 # 首页（词库管理 + AI 生词）
│   ├── study/                 # 学习页（闪卡模式）
│   ├── wordlist/              # 单词列表页
│   └── profile/               # 个人中心页
├── services/
│   ├── db.ts                  # 本地数据库服务
│   ├── ai.ts                  # AI 服务（调用后端 API）
│   ├── api-client.ts          # HTTP 请求客户端
│   └── init-data.ts           # 词库数据初始化
├── types/
│   └── wordflash.ts           # TypeScript 类型定义
└── assets/
    └── tabbar/                # TabBar 图标

backend/src/
├── modules/
│   ├── ai.ts                  # AI 代理接口（CloudBase Hunyuan）
│   ├── data.ts                # 数据初始化接口
│   └── system.ts              # 系统接口
├── lib/
│   └── hunyuan-chat.ts        # 混元 SDK 封装（备用）
├── app.ts                     # Express 配置
└── index.ts                   # 服务入口
```

---

## 七、技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Taro 4.x + React 18 |
| UI 组件库 | Taro UI |
| 样式 | SCSS |
| 后端框架 | Express + TypeScript |
| AI 服务 | 腾讯云 CloudBase AI（混元-v3 / hy3-preview） |
| 数据存储 | 前端本地存储（Taro.getStorageSync） |
| 释义接口 | 有道词典 suggest API |
| 发音接口 | 有道词典 dictvoice API |

---

## 八、待办事项

- [ ] AI 生成单词时批量获取释义（当前逐个调用，速度较慢）
- [ ] 添加词库内单词导入功能（支持 txt 文件）
- [ ] 托福/雅思/专八/BEC 词库数据填充
- [ ] 学习记录日历/连续打卡提醒
- [ ] 微信小程序发布配置（AppID: wx91a54e09459c1f16）
- [ ] 导出为微信小程序原生代码，使用微信开发者工具编译

---

## 九、代码仓库

- 仓库地址：https://github.com/dexinshao/wordAIFlash
- Taro 版本代码位于 `taro` 分支的 `wordflash-taro/` 目录
- `main` 分支保留原生微信小程序代码

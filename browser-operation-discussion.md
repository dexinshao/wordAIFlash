# 浏览器操作方案沟通记录

> 本文档整理了关于 SOLO 如何操控浏览器的技术方案讨论。

---

## 一、SOLO 的浏览器能力来源

### 1.1 工具名称

`integrated_browser` — SOLO 平台内置的 MCP 服务器。

### 1.2 提供方

SOLO 平台团队开发并内置，属于 SOLO 的核心能力之一。

### 1.3 底层推测

底层很可能基于 **Playwright** 等主流浏览器自动化框架封装，但具体实现细节不公开。

### 1.4 运行环境

SOLO 在用户电脑上运行一个轻量级 Linux 虚拟机（Ubuntu 22），浏览器就是这个虚拟机内嵌的无头浏览器（headless browser），通过 MCP 协议暴露给 AI 使用。

---

## 二、调用方式

### 2.1 不是通过 Agent

SOLO **不是**启动一个独立的"浏览器代理"来操作浏览器，而是 AI 直接通过 MCP 协议逐个调用浏览器工具。

### 2.2 工作模式

```
AI 发指令 → MCP 工具执行 → 返回结构化结果 → AI 分析 → 发下一条指令
```

这是一个**循环交互**的过程，每次调用都是一次性的指令-响应。

### 2.3 提供的工具列表

| 工具 | 功能 |
|------|------|
| `browser_navigate` | 导航到指定 URL |
| `browser_snapshot` | 获取页面结构（精简版 DOM，带 ref 引用） |
| `browser_click` | 点击元素（通过 ref 定位） |
| `browser_type` | 输入文本 |
| `browser_scroll` | 滚动页面 |
| `browser_hover` | 悬停元素 |
| `browser_select_option` | 下拉选择 |
| `browser_press_key` | 按键（支持组合键） |
| `browser_take_screenshot` | 截图 |
| `browser_tabs` | 标签页管理（新建/关闭/切换） |
| `browser_lock/unlock` | 锁定/解锁浏览器（防止用户干扰） |
| `browser_console_messages` | 获取控制台日志 |
| `browser_network_requests` | 获取网络请求 |
| `browser_wait_for` | 等待文本出现/消失 |
| `browser_get_attribute` | 读取元素属性 |
| `browser_waiting_for_user_interaction` | 交出控制权给用户 |

---

## 三、与 agent-browser 的对比

### 3.1 agent-browser 是什么

Vercel Labs 在 2026 年初开源的浏览器自动化 CLI 工具，专为 AI Agent 设计。纯 Rust 编写，GitHub 星标 30k+，NPM 周下载量 90 万+。

### 3.2 核心设计理念

agent-browser 的核心思路：让 AI 通过 **snapshot**（快照）理解页面结构，再通过 **ref**（引用）精准操控元素。这和 SOLO 的 `integrated_browser` 的设计理念**高度一致**。

### 3.3 Playwright vs agent-browser

| 维度 | Playwright | agent-browser |
|------|-----------|---------------|
| 开发者 | 微软（2020） | Vercel Labs（2026） |
| 语言 | TypeScript / Python / Java / .NET | 纯 Rust |
| 目标用户 | **人类开发者** | **AI Agent** |
| 页面理解 | 手写 CSS 选择器 / XPath | snapshot + ref |
| Token 消耗 | 传输完整 HTML，消耗大 | 精简 snapshot，消耗小 |
| 性能 | 基于 Node.js | 原生 Rust，快 5-10 倍 |
| 使用方式 | 写测试脚本 | CLI 命令 |

### 3.4 能否用 agent-browser 替代 SOLO 内置工具？

**理论上可以安装，但实际意义不大：**

| 对比项 | SOLO MCP 工具 | agent-browser (CLI) |
|--------|-------------|-------------------|
| 调用方式 | `run_mcp` 返回结构化 JSON | `RunCommand` 返回原始文本 |
| 集成度 | SOLO 原生集成 | 第三方工具，需额外安装 |
| 浏览器实例 | SOLO 统一管理 | 需自己管理生命周期 |
| 并发控制 | 内置 lock/unlock 机制 | 无 |
| 环境兼容 | SOLO VM 已适配 | 不确定能否正常运行 |

**核心结论**：SOLO 的 `integrated_browser` 已经实现了 agent-browser 想要解决的核心问题（snapshot + ref 模式），只是封装成了更高效的 MCP 协议，没必要再套一层。

---

## 四、snapshot 输出格式说明

### 4.1 SOLO browser_snapshot 的输出

返回的是**精简的页面结构**，不是完整 HTML。只包含关键交互元素，每个元素带有 `ref` 引用：

```yaml
- role: button
  name: Login
  ref: e5
- role: textbox
  name: Email
  ref: e8
- role: link
  name: Forgot password
  ref: e12
```

### 4.2 agent-browser snapshot 的输出

格式几乎一样，同样只包含关键交互元素带 ref 引用。

### 4.3 如果用 curl 抓页面

拿到的是**完整 HTML 源码**，包含大量 CSS、JS、隐藏元素等噪声，AI 处理的 token 消耗非常大，且难以精准定位交互元素。

---

## 五、总结

```
传统方式：AI → 传输完整 HTML → 消耗大量 token → 难以精准操作
                    ↓ 优化
现代方式：AI → snapshot（精简结构 + ref 引用）→ 低 token 消耗 → 通过 ref 精准操作
                    ↓
SOLO 实现：integrated_browser MCP → 已经采用现代方式，无需额外工具
```

SOLO 的 `integrated_browser` 本质上就是 agent-browser 设计理念的 MCP 协议实现，两者解决的是同一个问题：**让 AI 能高效地"看见"和"操作"浏览器页面**。

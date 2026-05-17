const app = getApp();

// AI 服务
class AIService {
  constructor() {
    this.config = null;
  }

  // 获取配置
  getConfig() {
    if (!this.config) {
      this.config = app.globalData.aiConfig;
    }
    return this.config;
  }

  // 检查是否已配置
  isConfigured() {
    const config = this.getConfig();
    return config.baseUrl && config.apiKey;
  }

  // 保存配置
  saveConfig(config) {
    this.config = { ...this.config, ...config };
    app.saveAIConfig(this.config);
  }

  // 调用 AI API
  async callAI(messages, options = {}) {
    const config = this.getConfig();
    
    if (!config.baseUrl || !config.apiKey) {
      throw new Error('请先配置 AI API');
    }

    const { temperature = 0.7, maxTokens = 1000 } = options;

    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${config.baseUrl}/chat/completions`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          data: {
            model: config.model,
            messages,
            temperature,
            max_tokens: maxTokens
          },
          success: resolve,
          fail: reject
        });
      });

      if (res.statusCode !== 200) {
        throw new Error(`API 错误: ${res.statusCode}`);
      }

      const content = res.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI 返回内容为空');
      }

      return content;
    } catch (error) {
      console.error('AI 调用失败:', error);
      throw error;
    }
  }

  // 生成主题单词
  async generateTopicWords(topic, excludeWords = []) {
    const excludeHint = excludeWords.length > 0 
      ? `\n6. 以下单词已存在，请不要生成这些单词：${excludeWords.slice(0, 50).join(', ')}`
      : '';

    const messages = [
      {
        role: 'system',
        content: `你是一个英语词汇专家。用户会描述一个主题，你需要生成与该主题相关的英语单词列表。
要求：
1. 生成 15-30 个与主题直接相关的英语单词
2. 单词难度适中，适合英语学习者
3. 只返回 JSON 格式，不要其他文字
4. JSON 格式为：{"topic": "主题名称", "words": ["word1", "word2", ...]}
5. 单词不要重复，全部小写${excludeHint}`
      },
      {
        role: 'user',
        content: topic
      }
    ];

    const content = await this.callAI(messages);
    
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 返回格式不正确');
    }

    try {
      const result = JSON.parse(jsonMatch[0]);
      return {
        topic: result.topic || topic,
        words: result.words || []
      };
    } catch (e) {
      throw new Error('解析 AI 返回失败');
    }
  }

  // 查找相关词库
  async findRelatedLibraries(topic, libraries) {
    if (libraries.length === 0) return [];

    const libListText = libraries.map((lib, i) => {
      return `${i + 1}. [ID:${lib.id}] ${lib.name}${lib.description ? ' - ' + lib.description : ''}`;
    }).join('\n');

    const messages = [
      {
        role: 'system',
        content: `你是一个分类匹配助手。用户会描述一个英语学习主题，你需要判断哪些词库与该主题相关。
注意：词库名可能是英文或中文，请根据语义判断相关性。
只返回相关词库的 ID 列表，用 JSON 数组格式，例如：[1, 5, 9]
如果没有相关的，返回空数组 []。只返回 JSON 数组，不要其他文字。`
      },
      {
        role: 'user',
        content: `用户主题："${topic}"

现有词库列表：
${libListText}`
      }
    ];

    const content = await this.callAI(messages, { temperature: 0.3, maxTokens: 500 });
    
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];
      
      // 兼容多种格式
      return parsed.map(item => {
        if (typeof item === 'number') return item;
        if (typeof item === 'string') return parseInt(item, 10);
        if (item?.id != null) return typeof item.id === 'number' ? item.id : parseInt(item.id, 10);
        return NaN;
      }).filter(id => !isNaN(id));
    } catch {
      return [];
    }
  }

  // 获取单词释义（使用有道词典 API）
  async fetchWordDefinition(word) {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word.toLowerCase())}`,
          method: 'GET',
          header: {
            'User-Agent': 'Mozilla/5.0'
          },
          success: resolve,
          fail: reject
        });
      });

      if (res.statusCode !== 200) return null;

      const data = res.data;
      const entries = data?.data?.entries;
      if (!Array.isArray(entries) || entries.length === 0) return null;

      const entry = entries[0];
      const explain = entry.explain || '';
      if (!explain) return null;

      // 解析释义
      const definitions = [];
      const parts = explain.split(/(?=[a-z]\.\s)/i);
      
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^([a-z]+\.)\s*(.+)/i);
        if (match) {
          definitions.push({ pos: match[1], meaning: match[2].trim() });
        } else if (definitions.length === 0) {
          definitions.push({ pos: '', meaning: trimmed });
        }
      }

      return {
        phonetic: '',
        definitions: definitions.slice(0, 3),
        phrases: [],
        examples: []
      };
    } catch (error) {
      console.error('获取单词释义失败:', error);
      return null;
    }
  }
}

// 导出单例
module.exports = new AIService();

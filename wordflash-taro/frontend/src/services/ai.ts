import Taro from '@tarojs/taro';

// CloudBase AI Configuration - 直连混元大模型
const TCB_ENV_ID = 'wordflash-d9gajqwvq157a1b06';
const TCB_API_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJhdWQiOiJ3b3JkZmxhc2gtZDlnYWpxd3ZxMTU3YTFiMDYiLCJleHAiOjI1MzQwMjMwMDc5OSwiaWF0IjoxNzc5MDI2MjY2LCJhdF9oYXNoIjoiMWdjaHB3cjVSME9WQ0IxVjRubFB1USIsInByb2plY3RfaWQiOiJ3b3JkZmxhc2gtZDlnYWpxd3ZxMTU3YTFiMDYiLCJtZXRhIjp7InBsYXRmb3JtIjoiQXBpS2V5In0sImFkbWluaXN0cmF0b3JfaWQiOiIyMDU1NjM2ODcxMTg1MjE5NTg1IiwidXNlcl90eXBlIjoiIiwiY2xpZW50X3R5cGUiOiJjbGllbnRfc2VydmVyIiwiaXNfc3lzdGVtX2FkbWluIjp0cnVlfQ.a7yZDiEDIjgkj7i2ix1Q40zZftoTtjkPybwrGhXHEr87BQTn0ViMfI__c1J7xXjY6C9XlDdFd3NzoIm6r1Da8AJpjinDaEZw3iQb5mYLnitI5O6gVUHLD6NKd5qYPRj1gptGZ3fZe3kvoPHw1j28mVlidKqPm1rKEp36FxV62lIcVYWj8FF1hvb-dalaNZqMnyEqN2I2gInGe-VdGxLzcTCIwrvhHSmfHqcAWNNkxZHXhiasRoF1KbRnlbN-EaFAxnDnNAG4D9QkTKlYpfqUNirLk4GA8XjzN2xNJzaoIxq0GqGMTELSlonsSP6xuMFJmrHbC7imuvVLjuQYzdfGzQ';
const AI_BASE_URL = `https://${TCB_ENV_ID}.api.tcloudbasegateway.com/v1/ai/hunyuan-v3/chat/completions`;
const AI_MODEL = 'hy3-preview';

interface GenerateResult {
  topic: string;
  words: string[];
}

interface WordDefinition {
  phonetic: string;
  definitions: { pos: string; meaning: string }[];
  phrases: string[];
  examples: string[];
}

interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Direct call to CloudBase AI (Hunyuan) - no backend needed
 */
async function callCloudBaseAI(messages: ChatMessage[], options: { temperature?: number } = {}): Promise<{ content: string }> {
  const body = {
    model: AI_MODEL,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: false,
    temperature: options.temperature ?? 0.7
  };

  const env = Taro.getEnv();
  const url = AI_BASE_URL;

  // H5 mode: use Taro.request with proxy
  // WeChat mode: direct request
  const res = await Taro.request({
    url,
    method: 'POST',
    data: body,
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TCB_API_KEY}`
    },
    timeout: 30000
  });

  if (res.statusCode !== 200) {
    throw new Error(`AI 请求失败: ${res.statusCode}`);
  }

  const data = res.data as any;
  if (data.error) {
    throw new Error(data.error.message || 'AI 调用出错');
  }

  const content = data.choices?.[0]?.message?.content || '';
  return { content };
}

/**
 * Direct call to Youdao Dictionary API - no backend needed
 */
async function fetchYoudaoDefinition(word: string): Promise<WordDefinition | null> {
  try {
    const res = await Taro.request({
      url: `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word.toLowerCase())}`,
      method: 'GET',
      timeout: 10000
    });

    const data = res.data as any;
    const entries = data?.data?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const entry = entries[0];
    const explain = entry.explain || '';
    if (!explain) return null;

    const definitions: { pos: string; meaning: string }[] = [];
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
    console.error('有道词典查询失败:', error);
    return null;
  }
}

class AIService {
  isConfigured(): boolean {
    return true;
  }

  async generateTopicWords(topic: string, excludeWords: string[] = []): Promise<GenerateResult> {
    const excludeHint = excludeWords && excludeWords.length > 0
      ? `\n6. 以下单词已存在，请不要生成这些单词：${excludeWords.slice(0, 50).join(', ')}`
      : '';

    const messages: ChatMessage[] = [
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
      { role: 'user', content: topic }
    ];

    const result = await callCloudBaseAI(messages, { temperature: 0.7 });
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 返回格式不正确');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      topic: parsed.topic || topic,
      words: parsed.words || []
    };
  }

  async findRelatedLibraries(topic: string, libraries: { id: number; name: string; description: string }[]): Promise<number[]> {
    const libListText = libraries.map((lib, i) => {
      return `${i + 1}. [ID:${lib.id}] ${lib.name}${lib.description ? ' - ' + lib.description : ''}`;
    }).join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个分类匹配助手。用户会描述一个英语学习主题，你需要判断哪些词库与该主题相关。
注意：词库名可能是英文或中文，请根据语义判断相关性。
只返回相关词库的 ID 列表，用 JSON 数组格式，例如：[1, 5, 9]
如果没有相关的，返回空数组 []。只返回 JSON 数组，不要其他文字。`
      },
      {
        role: 'user',
        content: `用户主题："${topic}"\n\n现有词库列表：\n${libListText}`
      }
    ];

    const result = await callCloudBaseAI(messages, { temperature: 0.3 });
    const jsonMatch = result.content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed)
      ? parsed.map((item: any) => {
          if (typeof item === 'number') return item;
          if (typeof item === 'string') return parseInt(item, 10);
          if (item?.id != null) return typeof item.id === 'number' ? item.id : parseInt(item.id, 10);
          return NaN;
        }).filter((id: number) => !isNaN(id))
      : [];
  }

  async fetchWordDefinition(word: string): Promise<WordDefinition | null> {
    return fetchYoudaoDefinition(word);
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await callCloudBaseAI(
        [{ role: 'user', content: 'Hello, reply with OK' }],
        { temperature: 0.1 }
      );
      return !!result.content;
    } catch {
      return false;
    }
  }

  isBackendAvailable(): boolean {
    return true;
  }
}

export const ai = new AIService();

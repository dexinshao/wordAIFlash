import { apiClient } from './api-client';

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

class AIService {
  // AI 已默认配置在后端（混元大模型），始终可用
  isConfigured(): boolean {
    return true;
  }

  async generateTopicWords(topic: string, excludeWords: string[] = []): Promise<GenerateResult> {
    const result = await apiClient.post<{ topic: string; words: string[] }>('/api/ai/generate-words', {
      topic,
      excludeWords
    });
    return result;
  }

  async findRelatedLibraries(topic: string, libraries: { id: number; name: string; description: string }[]): Promise<number[]> {
    const result = await apiClient.post<{ ids: number[] }>('/api/ai/find-libraries', {
      topic,
      libraries
    });
    return result.ids || [];
  }

  async fetchWordDefinition(word: string): Promise<WordDefinition | null> {
    try {
      const result = await apiClient.post<{ definition: WordDefinition | null }>('/api/ai/word-definition', {
        word
      });
      return result.definition;
    } catch (error) {
      console.error('获取单词释义失败:', error);
      return null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await apiClient.get<{ success: boolean }>('/api/ai/test');
      return result.success;
    } catch {
      return false;
    }
  }
}

export const ai = new AIService();

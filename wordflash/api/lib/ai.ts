import "dotenv/config";
import { getSecret } from "./crypto-utils";

// OpenAI 兼容接口配置（支持 DeepSeek、智谱、通义千问等）
// 优先从加密文件读取，回退到环境变量
const secretPassword = process.env.SECRET_PASSWORD || "";

export const aiConfig = {
  baseUrl: getSecret("AI_BASE_URL", "AI_BASE_URL", secretPassword) || "https://api.deepseek.com/v1",
  apiKey: getSecret("AI_API_KEY", "AI_API_KEY", secretPassword),
  model: getSecret("AI_MODEL", "AI_MODEL", secretPassword) || "deepseek-chat",
};

export async function callAI(prompt: string, excludeWords?: string[]): Promise<string> {
  if (!aiConfig.apiKey) {
    throw new Error("未配置 AI_API_KEY，请运行 npx tsx scripts/setup-secrets.ts 配置密钥");
  }

  // 构建排除单词提示（最多取前 100 个）
  let excludeHint = "";
  if (excludeWords && excludeWords.length > 0) {
    const sampled = excludeWords.slice(0, 100);
    excludeHint = `\n6. 以下单词已存在，请不要生成这些单词：${sampled.join(", ")}`;
    if (excludeWords.length > 100) {
      excludeHint += `\n（还有 ${excludeWords.length - 100} 个已省略）`;
    }
  }

  const res = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content: `你是一个英语词汇专家。用户会描述一个主题，你需要生成与该主题相关的英语单词列表。
要求：
1. 生成 15-30 个与主题直接相关的英语单词
2. 单词难度适中，适合英语学习者
3. 只返回 JSON 格式，不要其他文字
4. JSON 格式为：{"topic": "主题名称", "words": ["word1", "word2", ...]}
5. 单词不要重复，全部小写${excludeHint}`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI 服务调用失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空");

  // 提取 JSON（可能被 markdown 代码块包裹）
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 返回格式不正确，未找到 JSON");

  return jsonMatch[0];
}

/**
 * 通用 AI 调用（自定义 system prompt）
 */
export async function callAILite(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!aiConfig.apiKey) {
    throw new Error("未配置 AI_API_KEY，请运行 npx tsx scripts/setup-secrets.ts 配置密钥");
  }

  const res = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI 服务调用失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空");

  return content.trim();
}

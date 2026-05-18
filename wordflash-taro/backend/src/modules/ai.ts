import { Router, Request, Response } from 'express'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fetch = require('node-fetch')

export const aiRouter = Router()

const TCB_ENV_ID = process.env.TCB_ENV_ID || ''
const TCB_API_KEY = process.env.TCB_API_KEY || ''
const AI_BASE_URL = `https://${TCB_ENV_ID}.api.tcloudbasegateway.com/v1/ai/hunyuan-v3/chat/completions`
const AI_MODEL = 'hy3-preview'

interface ChatMessage {
  role: string
  content: string
}

/**
 * Call CloudBase AI (Hunyuan) via OpenAI-compatible API
 */
async function callCloudBaseAI(messages: ChatMessage[], options: { temperature?: number; model?: string } = {}): Promise<{ content: string; usage?: any }> {
  if (!TCB_ENV_ID || !TCB_API_KEY) {
    throw new Error('CloudBase 环境未配置')
  }

  const body = {
    model: options.model || AI_MODEL,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: false,
    temperature: options.temperature ?? 0.7
  }

  const response = await fetch(AI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TCB_API_KEY}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI 请求失败: ${response.status} ${text.slice(0, 200)}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'AI 调用出错')
  }

  const content = data.choices?.[0]?.message?.content || ''
  return { content, usage: data.usage }
}

/**
 * AI Chat completion
 */
aiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, temperature } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages is required and must be a non-empty array' })
      return
    }

    const result = await callCloudBaseAI(messages, { temperature })

    res.json({
      content: result.content,
      model: AI_MODEL
    })
  } catch (error: any) {
    console.error('AI chat error:', error)
    res.status(500).json({ error: error.message || 'AI 服务调用失败' })
  }
})

/**
 * Generate topic words
 */
aiRouter.post('/generate-words', async (req: Request, res: Response) => {
  try {
    const { topic, excludeWords } = req.body

    if (!topic || !topic.trim()) {
      res.status(400).json({ error: 'topic is required' })
      return
    }

    const excludeHint = excludeWords && excludeWords.length > 0
      ? `\n6. 以下单词已存在，请不要生成这些单词：${excludeWords.slice(0, 50).join(', ')}`
      : ''

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
    ]

    const result = await callCloudBaseAI(messages, { temperature: 0.7 })
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      res.status(500).json({ error: 'AI 返回格式不正确' })
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    res.json({
      topic: parsed.topic || topic,
      words: parsed.words || []
    })
  } catch (error: any) {
    console.error('Generate words error:', error)
    res.status(500).json({ error: error.message || 'AI 生词失败' })
  }
})

/**
 * Find related libraries
 */
aiRouter.post('/find-libraries', async (req: Request, res: Response) => {
  try {
    const { topic, libraries } = req.body

    if (!topic || !libraries || !Array.isArray(libraries)) {
      res.status(400).json({ error: 'topic and libraries are required' })
      return
    }

    const libListText = libraries.map((lib: any, i: number) => {
      return `${i + 1}. [ID:${lib.id}] ${lib.name}${lib.description ? ' - ' + lib.description : ''}`
    }).join('\n')

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
    ]

    const result = await callCloudBaseAI(messages, { temperature: 0.3 })
    const jsonMatch = result.content.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
      res.json({ ids: [] })
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    const ids = Array.isArray(parsed)
      ? parsed.map((item: any) => {
          if (typeof item === 'number') return item
          if (typeof item === 'string') return parseInt(item, 10)
          if (item?.id != null) return typeof item.id === 'number' ? item.id : parseInt(item.id, 10)
          return NaN
        }).filter((id: number) => !isNaN(id))
      : []

    res.json({ ids })
  } catch (error: any) {
    console.error('Find libraries error:', error)
    res.status(500).json({ error: error.message || 'AI 匹配失败' })
  }
})

/**
 * Get word definition using Youdao API
 */
aiRouter.post('/word-definition', async (req: Request, res: Response) => {
  try {
    const { word } = req.body

    if (!word) {
      res.status(400).json({ error: 'word is required' })
      return
    }

    const response = await fetch(
      `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word.toLowerCase())}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )

    const data = await response.json() as any
    const entries = data?.data?.entries
    if (!Array.isArray(entries) || entries.length === 0) {
      res.json({ definition: null })
      return
    }

    const entry = entries[0]
    const explain = entry.explain || ''
    if (!explain) {
      res.json({ definition: null })
      return
    }

    const definitions: { pos: string; meaning: string }[] = []
    const parts = explain.split(/(?=[a-z]\.\s)/i)
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const match = trimmed.match(/^([a-z]+\.)\s*(.+)/i)
      if (match) {
        definitions.push({ pos: match[1], meaning: match[2].trim() })
      } else if (definitions.length === 0) {
        definitions.push({ pos: '', meaning: trimmed })
      }
    }

    res.json({
      definition: {
        phonetic: '',
        definitions: definitions.slice(0, 3),
        phrases: [],
        examples: []
      }
    })
  } catch (error: any) {
    console.error('Word definition error:', error)
    res.status(500).json({ error: error.message || '获取释义失败' })
  }
})

/**
 * Test AI connection
 */
aiRouter.get('/test', async (_req: Request, res: Response) => {
  try {
    const result = await callCloudBaseAI(
      [{ role: 'user', content: 'Hello, reply with OK' }],
      { temperature: 0.1 }
    )

    res.json({
      success: true,
      content: result.content,
      model: AI_MODEL
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'AI 连接测试失败'
    })
  }
})

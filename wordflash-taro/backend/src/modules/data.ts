import { Router, Request, Response } from 'express'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as path from 'path'

const require = createRequire(import.meta.url)

export const dataRouter = Router()

interface Definition {
  pos: string
  meaning: string
}

interface WordData {
  word: string
  phonetic: string
  definitions: Definition[]
  frequencyRank: number
}

function parseCET6(): WordData[] {
  const file = '/workspace/wordAIFlash/CET6_单词表.txt'
  if (!fs.existsSync(file)) return []

  const content = fs.readFileSync(file, 'utf-8')
  const words: WordData[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(/^(\S+)\s+(\[[^\]]*\])?\s*(.*)/)
    if (!match) continue

    const word = match[1].toLowerCase()
    const phonetic = (match[2] || '').replace(/\[|\]/g, '')
    const rest = match[3].trim()

    const definitions: Definition[] = []
    if (rest) {
      const parts = rest.split(/\s+(?=[a-z]+\.)/)
      for (const part of parts) {
        const p = part.trim()
        if (!p) continue
        const posMatch = p.match(/^([a-z]+\.)\s*(.*)/)
        if (posMatch) {
          definitions.push({ pos: posMatch[1], meaning: posMatch[2].trim().slice(0, 100) })
        } else if (definitions.length > 0) {
          definitions[definitions.length - 1].meaning += ' ' + p.trim().slice(0, 50)
        } else {
          definitions.push({ pos: '', meaning: p.slice(0, 100) })
        }
      }
    }

    if (definitions.length === 0) {
      definitions.push({ pos: '', meaning: '' })
    }

    words.push({
      word,
      phonetic,
      definitions: definitions.slice(0, 3),
      frequencyRank: 99999
    })
  }

  return words
}

function parseCOCA(): WordData[] {
  const file = '/workspace/wordAIFlash/COCA_高频10000词.txt'
  if (!fs.existsSync(file)) return []

  const content = fs.readFileSync(file, 'utf-8')
  const words: WordData[] = []
  const seen = new Set<string>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(/^(\S+)\s+#(\d+)\s+(.*)/)
    if (!match) continue

    const word = match[1].toLowerCase()
    const rank = parseInt(match[2], 10)
    const rest = match[3].trim()

    if (seen.has(word)) continue
    seen.add(word)

    const definitions: Definition[] = []
    if (rest) {
      const parts = rest.split(/\s+(?=[a-z]+\.)/)
      for (const part of parts) {
        const p = part.trim()
        if (!p) continue
        const posMatch = p.match(/^([a-z]+\.)\s*(.*)/)
        if (posMatch) {
          definitions.push({ pos: posMatch[1], meaning: posMatch[2].trim().slice(0, 100) })
        } else if (definitions.length > 0) {
          definitions[definitions.length - 1].meaning += ' ' + p.trim().slice(0, 50)
        } else {
          definitions.push({ pos: '', meaning: p.slice(0, 100) })
        }
      }
    }

    if (definitions.length === 0) {
      definitions.push({ pos: '', meaning: '' })
    }

    words.push({
      word,
      phonetic: '',
      definitions: definitions.slice(0, 3),
      frequencyRank: rank
    })
  }

  return words
}

// CET4 from COCA - extract top ~2000 common words that overlap with CET4 level
// We use COCA top 2500 words (rank 1-2500) as a proxy for CET4
function generateCET4FromCOCA(cocaWords: WordData[]): WordData[] {
  // Take COCA words ranked 501-3000 as CET4-level (skip super basic like "the", "is")
  // These are common intermediate words suitable for CET4 level
  return cocaWords
    .filter(w => w.frequencyRank >= 501 && w.frequencyRank <= 3500)
    .map(w => ({ ...w, frequencyRank: 99999 }))
}

// High school words from COCA - top 500 most common words
function generateHighSchoolFromCOCA(cocaWords: WordData[]): WordData[] {
  return cocaWords
    .filter(w => w.frequencyRank >= 101 && w.frequencyRank <= 1500)
    .map(w => ({ ...w, frequencyRank: 99999 }))
}

/**
 * Initialize all word libraries with data
 */
dataRouter.post('/init-libraries', async (_req: Request, res: Response) => {
  try {
    const cocaWords = parseCOCA()
    const cet6Words = parseCET6()
    const cet4Words = generateCET4FromCOCA(cocaWords)
    const highSchoolWords = generateHighSchoolFromCOCA(cocaWords)

    // Build the full database structure for frontend Storage
    let wordIdCounter = Date.now()
    const allWords: any[] = []
    const libraryWords: any[] = []

    function addWordsToLibrary(words: WordData[], libraryId: number) {
      let count = 0
      for (const w of words) {
        const existingWord = allWords.find(ew => ew.word === w.word)
        let wordId: number

        if (existingWord) {
          wordId = existingWord.id
        } else {
          wordId = wordIdCounter++
          allWords.push({
            id: wordId,
            word: w.word,
            phonetic: w.phonetic,
            definitions: w.definitions,
            phrases: [],
            examples: [],
            frequencyRank: w.frequencyRank,
            createdAt: Date.now()
          })
        }

        // Link word to library
        const existingLink = libraryWords.find(
          (lw: any) => lw.libraryId === libraryId && lw.wordId === wordId
        )
        if (!existingLink) {
          libraryWords.push({
            libraryId,
            wordId,
            addedAt: Date.now()
          })
          count++
        }
      }
      return count
    }

    // Library IDs matching the frontend defaults
    const cet4Count = addWordsToLibrary(cet4Words, 1)
    const cet6Count = addWordsToLibrary(cet6Words, 2)
    const hsCount = addWordsToLibrary(highSchoolWords, 7)
    const cocaCount = addWordsToLibrary(cocaWords, 8)

    // Build complete DB object
    const dbData = {
      version: '1.0.0',
      libraries: [
        { id: 1, name: '四级词汇', description: '大学英语四级考试核心词汇', wordCount: cet4Count, category: 'cet4', isBuiltin: true, createdAt: Date.now() },
        { id: 2, name: '六级词汇', description: '大学英语六级考试核心词汇', wordCount: cet6Count, category: 'cet6', isBuiltin: true, createdAt: Date.now() },
        { id: 3, name: '托福词汇', description: '托福考试高频词汇', wordCount: 0, category: 'toefl', isBuiltin: true, createdAt: Date.now() },
        { id: 4, name: '雅思词汇', description: '雅思考试核心词汇', wordCount: 0, category: 'ielts', isBuiltin: true, createdAt: Date.now() },
        { id: 5, name: '英语八级', description: '英语专业八级词汇', wordCount: 0, category: 'tem8', isBuiltin: true, createdAt: Date.now() },
        { id: 6, name: 'BEC商务', description: '商务英语考试词汇', wordCount: 0, category: 'bec', isBuiltin: true, createdAt: Date.now() },
        { id: 7, name: '高中词汇', description: '高考英语核心词汇', wordCount: hsCount, category: 'high_school', isBuiltin: true, createdAt: Date.now() },
        { id: 8, name: '高频10000', description: 'COCA高频词汇', wordCount: cocaCount, category: 'top10000', isBuiltin: true, createdAt: Date.now() },
        { id: 9, name: '✅ 已掌握', description: '已掌握的单词汇总', wordCount: 0, category: 'mastered', isBuiltin: true, createdAt: Date.now() }
      ],
      words: allWords,
      libraryWords,
      progress: [],
      masteredWords: [],
      settings: {
        dailyGoal: 20,
        reminderEnabled: false,
        reminderTime: '20:00'
      },
      stats: {
        totalStudied: 0,
        totalMastered: 0,
        streakDays: 0,
        lastStudyDate: null
      }
    }

    res.json({
      success: true,
      data: dbData,
      summary: {
        cet4: cet4Count,
        cet6: cet6Count,
        highSchool: hsCount,
        cocaTop10000: cocaCount,
        totalWords: allWords.length
      }
    })
  } catch (error: any) {
    console.error('Init libraries error:', error)
    res.status(500).json({ error: error.message || '初始化词库失败' })
  }
})

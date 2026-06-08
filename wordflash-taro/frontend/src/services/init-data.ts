import Taro from '@tarojs/taro'

const INIT_KEY = 'wordflash_initialized_v3'

export function isInitialized(): boolean {
  return !!Taro.getStorageSync(INIT_KEY)
}

export function markInitialized(): void {
  Taro.setStorageSync(INIT_KEY, true)
}

// Global loading state
let _isLoading = true
let _loadProgress = 0
let _loadPromise: Promise<boolean> | null = null

export function isDataLoading(): boolean {
  return _isLoading
}

export function getLoadProgress(): number {
  return _loadProgress
}

/**
 * Load JSON data from local JS modules (works in mini program environment)
 * Uses static require() calls with correct relative paths
 * From weapp/services/init-data.js, data/ is at ../data/
 */
function loadJSON(filePath: string): any {
  try {
    let module;
    
    if (filePath.includes('meta.json')) {
      module = require('../data/meta.js');
    } else if (filePath.includes('lib-1')) {
      module = require('../data/lib-1.js');
    } else if (filePath.includes('lib-2')) {
      module = require('../data/lib-2.js');
    } else if (filePath.includes('lib-3')) {
      module = require('../data/lib-3.js');
    } else if (filePath.includes('lib-4')) {
      module = require('../data/lib-4.js');
    } else if (filePath.includes('lib-5')) {
      module = require('../data/lib-5.js');
    } else if (filePath.includes('lib-6')) {
      module = require('../data/lib-6.js');
    } else if (filePath.includes('lib-7')) {
      module = require('../data/lib-7.js');
    } else if (filePath.includes('lib-8')) {
      module = require('../data/lib-8.js');
    }
    
    return module && (module.default || module);
  } catch (err) {
    console.warn(`无法加载文件: ${filePath}`, err);
    throw err;
  }
}

/**
 * Initialize word data from local JSON files (offline mode)
 */
export function initializeWordData(): Promise<boolean> {
  if (_loadPromise) return _loadPromise;

  _loadPromise = _doInitialize()
  return _loadPromise
}

async function _doInitialize(): Promise<boolean> {
  if (isInitialized()) {
    _isLoading = false
    _loadProgress = 100
    return true
  }

  try {
    console.log('开始初始化词库数据（离线模式）...');

    // Load metadata
    _loadProgress = 5
    const meta = loadJSON('/data/meta.json');

    const dbData: any = {
      version: meta.version,
      libraries: meta.libraries,
      words: [],
      libraryWords: [],
      progress: [],
      masteredWords: [],
      settings: meta.settings,
      stats: meta.stats
    };

    let wordIdCounter = Date.now()
    const wordMap = new Map<string, number>()

    // Count libraries with data for progress tracking
    const activeLibraries = meta.libraries.filter((l: any) => l.wordCount > 0)
    const totalLibs = activeLibraries.length
    let loadedLibs = 0

    // Load each library's word data
    for (const library of meta.libraries) {
      if (library.wordCount === 0) continue;

      try {
        const compactWords = loadJSON(`/data/lib-${library.id}.json`);

        for (const cw of compactWords) {
          const wordText = cw.w.toLowerCase()

          let wordId: number
          if (wordMap.has(wordText)) {
            wordId = wordMap.get(wordText)!
          } else {
            wordId = cw.i || wordIdCounter++
            wordMap.set(wordText, wordId)

            const definitions: any[] = []
            if (cw.d) {
              for (const cd of cw.d) {
                definitions.push({
                  pos: cd.t || '',
                  meaning: cd.m || ''
                })
              }
            }
            if (definitions.length === 0) {
              definitions.push({ pos: '', meaning: '' })
            }

            dbData.words.push({
              id: wordId,
              word: wordText,
              phonetic: cw.p || '',
              definitions,
              phrases: [],
              examples: [],
              frequencyRank: cw.r || 99999,
              createdAt: Date.now()
            })
          }

          dbData.libraryWords.push({
            libraryId: library.id,
            wordId: wordId,
            addedAt: Date.now()
          })
        }

        loadedLibs++
        _loadProgress = Math.round(10 + (loadedLibs / totalLibs) * 80)
        console.log(`词库 ${library.name}: ${compactWords.length} 个单词 (${_loadProgress}%)`)
      } catch (err) {
        console.warn(`跳过词库 ${library.name}（数据文件不存在）`)
        loadedLibs++
      }
    }

    // Write to local storage
    _loadProgress = 92
    Taro.setStorageSync('wordflash_db', dbData)
    markInitialized()

    _loadProgress = 100
    _isLoading = false

    console.log(`词库初始化完成: ${dbData.words.length} 个单词`)
    return true
  } catch (error) {
    console.error('词库初始化出错:', error)
    _isLoading = false
    _loadProgress = 0
    return false
  }
}

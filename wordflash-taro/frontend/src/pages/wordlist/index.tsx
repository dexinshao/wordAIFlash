import React, { Component } from 'react';
import { View, Text, Input, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { db } from '../../services/db';
import { ai } from '../../services/ai';
import type { Word } from '../../types/wordflash';
import './index.scss';

interface WordListState {
  libraryId: number | null;
  libraryName: string;
  words: Word[];
  search: string;
  filter: string;
  showImportModal: boolean;
  importText: string;
  importing: boolean;
}

export default class WordList extends Component<{}, WordListState> {
  constructor(props: any) {
    super(props);
    this.state = {
      libraryId: null,
      libraryName: '',
      words: [],
      search: '',
      filter: 'all',
      showImportModal: false,
      importText: '',
      importing: false
    };
  }

  componentDidMount() {
    const instance = Taro.getCurrentInstance();
    const libraryId = parseInt(instance.router?.params?.libraryId || '0');
    if (!libraryId) {
      Taro.showToast({ title: '参数错误', icon: 'none' });
      Taro.navigateBack();
      return;
    }
    const library = db.getLibraryById(libraryId);
    this.setState({
      libraryId,
      libraryName: library?.name || ''
    }, () => this.loadWords());
  }

  loadWords = () => {
    if (!this.state.libraryId) return;
    const words = db.getWords(this.state.libraryId, {
      search: this.state.search,
      filter: this.state.filter
    });
    this.setState({ words });
  }

  onSearchChange = (value: string) => {
    this.setState({ search: value }, () => this.loadWords());
  }

  setFilter = (filter: string) => {
    this.setState({ filter }, () => this.loadWords());
  }

  // ==================== 导入功能 ====================

  showImport = () => {
    this.setState({ showImportModal: true, importText: '' });
  }

  closeImport = () => {
    this.setState({ showImportModal: false, importText: '' });
  }

  onImportTextChange = (value: string) => {
    this.setState({ importText: value });
  }

  handleFileUpload = () => {
    // WeChat MiniProgram: use Taro.chooseMessageFile
    // H5: use hidden file input
    const env = Taro.getEnv();
    if (env === Taro.ENV_TYPE.WEAPP) {
      Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['.txt'],
        success: async (res) => {
          const filePath = res.tempFiles[0].path;
          try {
            const fs = Taro.getFileSystemManager();
            const content = fs.readFileSync(filePath, 'utf-8');
            this.setState({ importText: content as string });
          } catch (err) {
            Taro.showToast({ title: '读取文件失败', icon: 'none' });
          }
        }
      });
    } else {
      // H5 mode
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          this.setState({ importText: text });
        };
        reader.readAsText(file);
      };
      input.click();
    }
  }

  confirmImport = async () => {
    const { importText, libraryId } = this.state;
    if (!importText.trim()) {
      Taro.showToast({ title: '请输入或上传内容', icon: 'none' });
      return;
    }
    if (!libraryId) return;

    this.setState({ importing: true });

    try {
      // Parse txt content directly on frontend (no backend needed)
      const words = this.parseTxtContent(importText);

      if (words.length > 0) {
        // Add parsed words to local database
        const addedCount = db.addWordsBatch(words, libraryId);

        // Try to fetch definitions for words without meanings in background
        const wordsWithoutMeaning = words.filter(
          (w: any) => !w.definitions?.[0]?.meaning
        );
        if (wordsWithoutMeaning.length > 0 && wordsWithoutMeaning.length <= 50) {
          this.fetchMissingDefinitions(wordsWithoutMeaning, libraryId);
        }

        Taro.showToast({ title: `成功导入 ${addedCount} 个单词`, icon: 'success' });
        this.setState({ showImportModal: false, importText: '' });
        this.loadWords();
      } else {
        Taro.showToast({ title: '未能解析出有效单词', icon: 'none' });
      }
    } catch (error: any) {
      Taro.showToast({ title: error.message || '导入失败', icon: 'none' });
    } finally {
      this.setState({ importing: false });
    }
  }

  /**
   * Parse txt content into word data (frontend-only, no backend)
   */
  parseTxtContent(content: string): Array<Partial<Word> & { word: string }> {
    const words: Array<Partial<Word> & { word: string }> = [];
    const seen = new Set<string>();

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      let word = '';
      let phonetic = '';
      let rest = '';

      // Try: word [phonetic] definition or word /phonetic/ definition
      const phoneticMatch = trimmed.match(/^(\S+)\s+[/\[\\]([^/\]\\]*)[/\]\\]\s*(.*)/);
      if (phoneticMatch) {
        word = phoneticMatch[1].toLowerCase();
        phonetic = phoneticMatch[2].trim();
        rest = phoneticMatch[3].trim();
      } else {
        // Try tab separated
        const tabParts = trimmed.split('\t');
        if (tabParts.length >= 2) {
          word = tabParts[0].trim().toLowerCase();
          rest = tabParts.slice(1).join(' ').trim();
        } else {
          // Try pipe separated
          const pipeParts = trimmed.split('|');
          if (pipeParts.length >= 2) {
            word = pipeParts[0].trim().toLowerCase();
            rest = pipeParts.slice(1).join('|').trim();
          } else {
            // Space separated
            const spaceMatch = trimmed.match(/^(\S+)\s+(.*)/);
            if (spaceMatch) {
              word = spaceMatch[1].toLowerCase();
              rest = spaceMatch[2].trim();
            } else {
              word = trimmed.toLowerCase();
            }
          }
        }
      }

      // Remove trailing asterisk
      word = word.replace(/\*+$/, '');
      if (!word || !/^[a-z]/i.test(word) || word.length < 2) continue;
      if (seen.has(word)) continue;
      seen.add(word);

      const definitions: { pos: string; meaning: string }[] = [];
      if (rest) {
        const parts = rest.split(/\s+(?=[a-z]+\.\s)/);
        for (const part of parts) {
          const p = part.trim();
          if (!p) continue;
          const posMatch = p.match(/^([a-z]+\.)\s*(.*)/i);
          if (posMatch) {
            definitions.push({ pos: posMatch[1], meaning: posMatch[2].trim().slice(0, 200) });
          } else if (definitions.length > 0) {
            definitions[definitions.length - 1].meaning += ' ' + p.trim().slice(0, 100);
          } else {
            definitions.push({ pos: '', meaning: p.slice(0, 200) });
          }
        }
      }

      if (definitions.length === 0) {
        definitions.push({ pos: '', meaning: '' });
      }

      words.push({
        word,
        phonetic,
        definitions: definitions.slice(0, 5)
      });
    }

    return words;
  }

  fetchMissingDefinitions = async (words: any[], libraryId: number) => {
    for (const wordData of words) {
      try {
        const definition = await ai.fetchWordDefinition(wordData.word);
        if (definition) {
          // Update the word in db
          const dbData = db.getDB();
          const word = dbData.words.find(w => w.word.toLowerCase() === wordData.word.toLowerCase());
          if (word && (!word.definitions?.[0]?.meaning)) {
            word.definitions = definition.definitions || word.definitions;
            word.phonetic = definition.phonetic || word.phonetic;
            word.phrases = definition.phrases || word.phrases;
            word.examples = definition.examples || word.examples;
            db.save();
          }
        }
      } catch {
        // Silently skip failed definition fetches
      }
    }
  }

  render() {
    const { libraryName, words, search, filter, showImportModal, importText, importing } = this.state;
    const filters = [
      { key: 'all', label: '全部' },
      { key: 'unlearned', label: '未学习' },
      { key: 'learning', label: '学习中' },
      { key: 'mastered', label: '已掌握' }
    ];

    return (
      <View className='wordlist-page'>
        {/* 搜索栏 */}
        <View className='search-bar'>
          <Input
            className='search-input'
            placeholder='搜索单词...'
            value={search}
            onInput={e => this.onSearchChange(e.detail.value)}
          />
        </View>

        {/* 筛选栏 */}
        <View className='filter-bar'>
          {filters.map(f => (
            <View
              key={f.key}
              className={`filter-tag ${filter === f.key ? 'active' : ''}`}
              onClick={() => this.setFilter(f.key)}
            >
              <Text className='filter-text'>{f.label}</Text>
            </View>
          ))}
          <View className='filter-tag import-tag' onClick={this.showImport}>
            <Text className='filter-text'>导入</Text>
          </View>
        </View>

        {/* 单词列表 */}
        <View className='word-count'>
          <Text className='count-text'>{libraryName} · {words.length} 个单词</Text>
        </View>

        <View className='word-list'>
          {words.map(word => (
            <View key={word.id} className='word-item'>
              <View className='word-left'>
                <Text className='word-name'>{word.word}</Text>
                {word.phonetic && <Text className='word-phonetic'>{word.phonetic}</Text>}
                <Text className='word-meaning'>
                  {word.definitions?.[0]?.pos && `${word.definitions[0].pos} `}
                  {word.definitions?.[0]?.meaning || ''}
                </Text>
              </View>
              <View className='word-right'>
                {word.frequencyRank && word.frequencyRank < 99999 && (
                  <Text className='word-freq'>#{word.frequencyRank}</Text>
                )}
                {word.progress?.isMastered && <Text className='word-status mastered'>已掌握</Text>}
                {word.progress && !word.progress.isMastered && <Text className='word-status learning'>学习中</Text>}
                {!word.progress && <Text className='word-status unlearned'>未学习</Text>}
              </View>
            </View>
          ))}

          {words.length === 0 && (
            <View className='empty-state'>
              <Text className='empty-text'>暂无单词</Text>
            </View>
          )}
        </View>

        {/* 导入弹窗 */}
        {showImportModal && (
          <View className='modal-overlay' onClick={this.closeImport}>
            <View className='modal-content import-modal' onClick={e => e.stopPropagation()}>
              <Text className='modal-title'>导入单词</Text>

              <View className='import-format-hint'>
                <Text className='hint-title'>支持的格式：</Text>
                <Text className='hint-line'>· 每行一个单词：apple</Text>
                <Text className='hint-line'>· 单词+释义：apple n. 苹果</Text>
                <Text className='hint-line'>· 单词+音标+释义：apple [ˈæpl] n. 苹果</Text>
                <Text className='hint-line'>· Tab分隔：apple{'\t'}n. 苹果</Text>
                <Text className='hint-line'>· 竖线分隔：apple | n. 苹果</Text>
              </View>

              <View className='import-actions'>
                <View className='import-upload-btn' onClick={this.handleFileUpload}>
                  <Text className='upload-btn-text'>选择 .txt 文件</Text>
                </View>
              </View>

              <View className='import-textarea-wrap'>
                <Textarea
                  className='import-textarea'
                  placeholder='或直接粘贴单词内容到此处...'
                  value={importText}
                  onInput={e => this.onImportTextChange(e.detail.value)}
                  maxlength={-1}
                />
              </View>

              {importText && (
                <View className='import-preview'>
                  <Text className='preview-hint'>
                    识别到约 {importText.split('\n').filter(l => l.trim()).length} 行内容
                  </Text>
                </View>
              )}

              <View className='modal-btn-row'>
                <View className='modal-btn secondary' onClick={this.closeImport}>
                  <Text className='modal-btn-text'>取消</Text>
                </View>
                <View className={`modal-btn primary ${importing ? 'disabled' : ''}`} onClick={importing ? undefined : this.confirmImport}>
                  <Text className='modal-btn-text'>{importing ? '导入中...' : '确认导入'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }
}

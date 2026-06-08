import React, { Component } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { db } from '../../services/db';
import { ai } from '../../services/ai';
import type { Library, GlobalStats } from '../../types/wordflash';
import './index.scss';

interface IndexState {
  libraries: Library[];
  globalStats: GlobalStats | null;
  isLoading: boolean;
  initProgress: number;
  initMessage: string;
  showDeleteModal: boolean;
  deleteTarget: Library | null;
  mergeTargetId: number | null;
  showAiModal: boolean;
  aiStep: 'input' | 'generating' | 'preview' | 'chooseLib';
  aiInput: string;
  aiGenerating: boolean;
  generatedWords: { word: string; definition: any; tags: string[] }[];
  generatedTopic: string;
  relatedLibraries: Library[];
  excludeLibId: number | null;
  selectedTargetLibId: number | null;
  showExcludeOptions: boolean;
  masteredWords: string[];
  aiSuggestions: string[];
}

export default class Index extends Component<{}, IndexState> {
  constructor(props: any) {
    super(props);
    this.state = {
      libraries: [],
      globalStats: null,
      isLoading: true,
      initProgress: 0,
      initMessage: '正在初始化...',
      showDeleteModal: false,
      deleteTarget: null,
      mergeTargetId: null,
      showAiModal: false,
      aiStep: 'input',
      aiInput: '',
      aiGenerating: false,
      generatedWords: [],
      generatedTopic: '',
      relatedLibraries: [],
      excludeLibId: null,
      selectedTargetLibId: null,
      showExcludeOptions: false,
      masteredWords: [],
      aiSuggestions: ['商务英语', '旅行用语', '编程术语', '医疗词汇', '法律英语', '雅思写作']
    };
  }

  async componentDidMount() {
    // 初始化数据库（首次使用时导入词库）
    if (!db.isInitialized()) {
      await db.initialize((progress, message) => {
        this.setState({ initProgress: progress, initMessage: message });
      });
    }
    this.loadData();
  }

  componentDidShow() {
    if (db.isInitialized()) {
      this.loadData();
    }
  }

  loadData = () => {
    const libraries = db.getLibraries();
    const globalStats = db.getGlobalStats();
    this.setState({ libraries, globalStats, isLoading: false });
  }

  onPullDownRefresh = () => {
    this.loadData();
    Taro.stopPullDownRefresh();
  }

  // ==================== AI 弹窗 ====================

  showAiDialog = () => {
    this.setState({
      showAiModal: true,
      aiStep: 'input',
      aiInput: '',
      generatedWords: [],
      generatedTopic: '',
      excludeLibId: null,
      selectedTargetLibId: null,
      showExcludeOptions: false,
      masteredWords: []
    });
  }

  closeAiDialog = () => {
    if (this.state.aiGenerating) return;
    this.setState({ showAiModal: false });
  }

  onAiInputChange = (value: string) => {
    this.setState({ aiInput: value });
  }

  selectSuggestion = (suggestion: string) => {
    this.setState({ aiInput: suggestion });
  }

  toggleExcludeOptions = () => {
    const newShow = !this.state.showExcludeOptions;
    this.setState({ showExcludeOptions: newShow });
    if (newShow && this.state.aiInput) {
      this.findRelatedLibraries();
    }
  }

  findRelatedLibraries = async () => {
    const nonMasteredLibs = this.state.libraries.filter(lib => lib.category !== 'mastered');
    try {
      const relatedIds = await ai.findRelatedLibraries(this.state.aiInput, nonMasteredLibs);
      const relatedLibraries = nonMasteredLibs.filter(lib => relatedIds.includes(lib.id));
      this.setState({
        relatedLibraries,
        excludeLibId: relatedLibraries.length > 0 ? relatedLibraries[0].id : null
      });
    } catch (error) {
      console.error('查找相关词库失败:', error);
    }
  }

  onExcludeLibSelect = (id: number | null) => {
    this.setState({ excludeLibId: id });
  }

  generateWords = async () => {
    if (!this.state.aiInput.trim()) {
      Taro.showToast({ title: '请输入学习主题', icon: 'none' });
      return;
    }

    this.setState({ aiGenerating: true, aiStep: 'generating' });

    try {
      let excludeWords: string[] = [];
      if (this.state.excludeLibId) {
        const words = db.getWords(this.state.excludeLibId);
        excludeWords = words.map(w => w.word);
      }
      const masteredLib = this.state.libraries.find(lib => lib.category === 'mastered');
      if (masteredLib) {
        const masteredW = db.getWords(masteredLib.id);
        excludeWords = [...excludeWords, ...masteredW.map(w => w.word)];
      }

      const result = await ai.generateTopicWords(this.state.aiInput, [...new Set(excludeWords)]);

      const wordsWithDefs: { word: string; definition: any; tags: string[] }[] = [];
      for (const word of result.words) {
        const definition = await ai.fetchWordDefinition(word);
        wordsWithDefs.push({
          word,
          definition: definition || { definitions: [{ pos: '', meaning: '释义获取中...' }] },
          tags: []
        });
      }

      this.setState({
        aiStep: 'preview',
        aiGenerating: false,
        generatedWords: wordsWithDefs,
        generatedTopic: result.topic,
        selectedTargetLibId: null
      });

      this.findRelatedLibraries();
    } catch (error: any) {
      Taro.showToast({ title: error.message || '生成失败', icon: 'none' });
      this.setState({ aiGenerating: false, aiStep: 'input' });
    }
  }

  removeGeneratedWord = (index: number) => {
    const words = [...this.state.generatedWords];
    const word = words[index];
    words.splice(index, 1);
    const masteredWords = [...this.state.masteredWords, word.word];
    this.setState({ generatedWords: words, masteredWords });
    db.markWordsAsMastered([word.word]);
  }

  goToChooseLib = () => {
    if (this.state.generatedWords.length === 0) {
      Taro.showToast({ title: '没有单词可添加', icon: 'none' });
      return;
    }
    this.setState({ aiStep: 'chooseLib' });
  }

  selectTargetLib = (id: number) => {
    this.setState({ selectedTargetLibId: id });
  }

  createLibrary = async () => {
    if (this.state.generatedWords.length === 0) return;
    this.setState({ aiGenerating: true });

    try {
      let libraryId: number;
      if (this.state.selectedTargetLibId) {
        libraryId = this.state.selectedTargetLibId;
      } else {
        const newLib = db.createLibrary(
          `🤖 ${this.state.generatedTopic}`,
          `AI 生成：${this.state.generatedTopic} 相关词汇`,
          'ai_topic'
        );
        libraryId = newLib.id;
      }

      for (const item of this.state.generatedWords) {
        db.addWord({
          word: item.word,
          phonetic: item.definition?.phonetic,
          definitions: item.definition?.definitions,
          phrases: item.definition?.phrases,
          examples: item.definition?.examples
        }, libraryId);
      }

      Taro.showToast({ title: '创建成功', icon: 'success' });
      this.setState({ showAiModal: false });
      this.loadData();
      // 自动跳转学习
      const updatedLib = db.getLibraryById(libraryId);
      if (updatedLib && updatedLib.wordCount > 0) {
        Taro.navigateTo({ url: `/pages/study/index?libraryId=${libraryId}` });
      }
    } catch (error: any) {
      Taro.showToast({ title: error.message || '创建失败', icon: 'none' });
      this.setState({ aiGenerating: false });
    }
  }

  // ==================== 删除弹窗 ====================

  showDeleteModal = (library: Library) => {
    this.setState({
      deleteTarget: library,
      showDeleteModal: true,
      mergeTargetId: null
    });
  }

  closeDeleteModal = () => {
    this.setState({ showDeleteModal: false, deleteTarget: null, mergeTargetId: null });
  }

  selectMergeTarget = (id: number) => {
    this.setState({ mergeTargetId: id });
  }

  confirmDelete = () => {
    const { deleteTarget, mergeTargetId } = this.state;
    if (!deleteTarget) return;
    const success = db.deleteLibrary(deleteTarget.id, mergeTargetId);
    if (success) {
      Taro.showToast({ title: mergeTargetId ? '已合并删除' : '已删除', icon: 'success' });
      this.loadData();
      this.closeDeleteModal();
    } else {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  }

  // ==================== 导航 ====================

  startStudy = (libraryId: number) => {
    const library = db.getLibraryById(libraryId);
    if (!library || library.wordCount === 0) {
      Taro.showToast({ title: '词库为空，请先添加单词', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: `/pages/study/index?libraryId=${libraryId}` });
  }

  viewWordList = (libraryId: number) => {
    Taro.navigateTo({ url: `/pages/wordlist/index?libraryId=${libraryId}` });
  }

  exportMasteredWords = () => {
    const masteredLib = this.state.libraries.find(lib => lib.category === 'mastered');
    if (!masteredLib || masteredLib.wordCount === 0) {
      Taro.showToast({ title: '暂无已掌握单词', icon: 'none' });
      return;
    }
    const words = db.getWords(masteredLib.id);
    const wordList = words.map(w => w.word).join('\n');
    Taro.setClipboardData({
      data: wordList,
      success: () => {
        Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  }

  getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      cet4: '📘', cet6: '📗', toefl: '📙', ielts: '📕',
      tem8: '📓', bec: '💼', high_school: '📒', top10000: '🔥',
      mastered: '✅', ai_topic: '🤖', custom: '📌'
    };
    return icons[category] || '📌';
  }

  render() {
    const { libraries, globalStats, isLoading, initProgress, initMessage, showAiModal, aiStep, aiInput, aiGenerating,
      generatedWords, generatedTopic, relatedLibraries, excludeLibId, selectedTargetLibId,
      showExcludeOptions, showDeleteModal, deleteTarget, mergeTargetId, aiSuggestions } = this.state;

    // 显示初始化加载进度
    if (isLoading) {
      return (
        <View className='index-page'>
          <View className='loading-container'>
            <View className='loading-spinner' />
            <Text className='loading-message'>{initMessage}</Text>
            <View className='loading-progress-bar'>
              <View className='loading-progress-fill' style={{ width: `${initProgress}%` }} />
            </View>
            <Text className='loading-progress-text'>{initProgress}%</Text>
          </View>
        </View>
      );
    }

    const nonMasteredLibs = libraries.filter(lib => lib.category !== 'mastered');
    const mergeCandidates = libraries.filter(lib =>
      lib.id !== deleteTarget?.id && !lib.isBuiltin
    );

    return (
      <View className='index-page'>
        {/* 全局统计 */}
        {globalStats && (
          <View className='stats-card'>
            <View className='stats-header'>
              <Text className='stats-title'>学习概览</Text>
              <Text className='stats-progress'>{globalStats.progress}%</Text>
            </View>
            <View className='progress-bar'>
              <View className='progress-fill' style={{ width: `${globalStats.progress}%` }} />
            </View>
            <View className='stats-row'>
              <View className='stat-item'>
                <Text className='stat-value'>{globalStats.totalWords}</Text>
                <Text className='stat-label'>总单词</Text>
              </View>
              <View className='stat-item' onClick={this.exportMasteredWords}>
                <Text className='stat-value mastered'>{globalStats.mastered}</Text>
                <Text className='stat-label'>已掌握</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value learning'>{globalStats.learning}</Text>
                <Text className='stat-label'>学习中</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value unlearned'>{globalStats.unlearned}</Text>
                <Text className='stat-label'>未学习</Text>
              </View>
            </View>
          </View>
        )}

        {/* AI 生词按钮 */}
        <View className='ai-entry' onClick={this.showAiDialog}>
          <Text className='ai-entry-icon'>✨</Text>
          <Text className='ai-entry-text'>AI 智能生词</Text>
          <Text className='ai-entry-arrow'>›</Text>
        </View>

        {/* 词库列表 */}
        <View className='section-title'>
          <Text>我的词库</Text>
        </View>
        <View className='library-grid'>
          {nonMasteredLibs.map(lib => (
            <View key={lib.id} className={`library-card ${lib.wordCount === 0 ? 'empty' : ''}`}>
              <View className='lib-icon'>{this.getCategoryIcon(lib.category)}</View>
              <Text className='lib-name'>{lib.name}</Text>
              <Text className='lib-count'>{lib.wordCount} 词</Text>
              {lib.wordCount === 0 ? (
                <View className='lib-hint' onClick={this.showAiDialog}>
                  <Text className='lib-hint-text'>点击 AI 生词添加</Text>
                </View>
              ) : (
                <View className='lib-actions'>
                  <View className='lib-btn study-btn' onClick={() => this.startStudy(lib.id)}>
                    <Text className='btn-text'>学习</Text>
                  </View>
                  <View className='lib-btn list-btn' onClick={() => this.viewWordList(lib.id)}>
                    <Text className='btn-text'>列表</Text>
                  </View>
                  {!lib.isBuiltin && (
                    <View className='lib-btn delete-btn' onClick={() => this.showDeleteModal(lib)}>
                      <Text className='btn-text'>删除</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* AI 弹窗 */}
        {showAiModal && (
          <View className='modal-overlay' onClick={this.closeAiDialog}>
            <View className='modal-content' onClick={e => e.stopPropagation()}>
              {aiStep === 'input' && (
                <View className='ai-step-input'>
                  <Text className='modal-title'>AI 智能生词</Text>
                  <View className='ai-input-area'>
                    <Input
                    className='ai-input'
                    placeholder='输入学习主题，如：商务英语'
                    value={aiInput}
                    onInput={e => this.onAiInputChange(e.detail.value)}
                  />
                  </View>
                  <View className='ai-suggestions'>
                    {aiSuggestions.map(s => (
                      <View key={s} className='suggestion-tag' onClick={() => this.selectSuggestion(s)}>
                        <Text className='suggestion-text'>{s}</Text>
                      </View>
                    ))}
                  </View>
                  <View className='exclude-section'>
                    <View className='exclude-toggle' onClick={this.toggleExcludeOptions}>
                      <Text>{showExcludeOptions ? '▼' : '▶'} 排除已有单词</Text>
                    </View>
                    {showExcludeOptions && relatedLibraries.length > 0 && (
                      <View className='exclude-options'>
                        {relatedLibraries.map(lib => (
                          <View
                            key={lib.id}
                            className={`exclude-option ${excludeLibId === lib.id ? 'active' : ''}`}
                            onClick={() => this.onExcludeLibSelect(lib.id)}
                          >
                            <Text>{lib.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View className='modal-btn primary' onClick={this.generateWords}>
                    <Text className='modal-btn-text'>生成单词</Text>
                  </View>
                </View>
              )}

              {aiStep === 'generating' && (
                <View className='ai-step-generating'>
                  <Text className='modal-title'>正在生成...</Text>
                  <Text className='generating-hint'>AI 正在为您挑选合适的单词</Text>
                  <View className='loading-dots'>
                    <View className='dot' /><View className='dot' /><View className='dot' />
                  </View>
                </View>
              )}

              {aiStep === 'preview' && (
                <View className='ai-step-preview'>
                  <Text className='modal-title'>生成结果：{generatedTopic}</Text>
                  <Text className='preview-count'>{generatedWords.length} 个单词</Text>
                  <View className='generated-list'>
                    {generatedWords.map((item, index) => (
                      <View key={item.word} className='generated-item'>
                        <View className='generated-word-info'>
                          <Text className='generated-word'>{item.word}</Text>
                          <Text className='generated-meaning'>
                            {item.definition?.definitions?.[0]?.meaning || ''}
                          </Text>
                        </View>
                        <View className='generated-remove' onClick={() => this.removeGeneratedWord(index)}>
                          <Text>✕</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View className='modal-btn primary' onClick={this.goToChooseLib}>
                    <Text className='modal-btn-text'>选择词库 ({generatedWords.length} 词)</Text>
                  </View>
                </View>
              )}

              {aiStep === 'chooseLib' && (
                <View className='ai-step-choose'>
                  <Text className='modal-title'>选择目标词库</Text>
                  <View className='choose-option' onClick={() => this.selectTargetLib(0)}>
                    <View className={`choose-radio ${selectedTargetLibId === null ? 'checked' : ''}`} />
                    <Text>创建新词库：🤖 {generatedTopic}</Text>
                  </View>
                  {relatedLibraries.map(lib => (
                    <View key={lib.id} className='choose-option' onClick={() => this.selectTargetLib(lib.id)}>
                      <View className={`choose-radio ${selectedTargetLibId === lib.id ? 'checked' : ''}`} />
                      <Text>{this.getCategoryIcon(lib.category)} {lib.name}</Text>
                    </View>
                  ))}
                  <View className='modal-btn-row'>
                    <View className='modal-btn secondary' onClick={() => this.setState({ aiStep: 'preview' })}>
                      <Text className='modal-btn-text'>返回</Text>
                    </View>
                    <View className='modal-btn primary' onClick={this.createLibrary}>
                      <Text className='modal-btn-text'>确认添加</Text>
                    </View>
                  </View>
                </View>
              )}

              {!aiGenerating && (
                <View className='modal-close' onClick={this.closeAiDialog}>
                  <Text>✕</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 删除弹窗 */}
        {showDeleteModal && deleteTarget && (
          <View className='modal-overlay' onClick={this.closeDeleteModal}>
            <View className='modal-content delete-modal' onClick={e => e.stopPropagation()}>
              <Text className='modal-title'>删除词库</Text>
              <Text className='delete-hint'>确定删除「{deleteTarget.name}」吗？</Text>
              {mergeCandidates.length > 0 && (
                <View className='merge-section'>
                  <Text className='merge-label'>合并到其他词库（可选）：</Text>
                  {mergeCandidates.map(lib => (
                    <View
                      key={lib.id}
                      className={`merge-option ${mergeTargetId === lib.id ? 'active' : ''}`}
                      onClick={() => this.selectMergeTarget(lib.id)}
                    >
                      <Text>{this.getCategoryIcon(lib.category)} {lib.name}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View className='modal-btn-row'>
                <View className='modal-btn secondary' onClick={this.closeDeleteModal}>
                  <Text className='modal-btn-text'>取消</Text>
                </View>
                <View className='modal-btn danger' onClick={this.confirmDelete}>
                  <Text className='modal-btn-text'>{mergeTargetId ? '合并删除' : '删除'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }
}

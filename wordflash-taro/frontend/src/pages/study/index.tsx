import React, { Component } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { db } from '../../services/db';
import type { Word, Library } from '../../types/wordflash';import './index.scss';

interface StudyState {
  libraryId: number | null;
  library: Library | null;
  currentWord: Word | null;
  isFlipped: boolean;
  isAnimating: boolean;
  sessionStats: { studied: number; mastered: number };
  history: { word: Word; feedback: string }[];
  isComplete: boolean;
}

export default class Study extends Component<{}, StudyState> {
  constructor(props: any) {
    super(props);
    this.state = {
      libraryId: null,
      library: null,
      currentWord: null,
      isFlipped: false,
      isAnimating: false,
      sessionStats: { studied: 0, mastered: 0 },
      history: [],
      isComplete: false
    };
  }

  componentDidMount() {
    // 从路由参数获取 libraryId
    const instance = Taro.getCurrentInstance();
    const libraryId = parseInt(instance.router?.params?.libraryId || '0');
    if (!libraryId) {
      Taro.showToast({ title: '参数错误', icon: 'none' });
      Taro.navigateBack();
      return;
    }
    const library = db.getLibraryById(libraryId);
    if (!library) {
      Taro.showToast({ title: '词库不存在', icon: 'none' });
      Taro.navigateBack();
      return;
    }
    this.setState({ libraryId, library }, () => this.loadNextWord());
  }

  loadNextWord = () => {
    const word = db.getNextFlashcard(this.state.libraryId!);
    if (!word) {
      this.setState({ isComplete: true });
      return;
    }
    this.setState({
      currentWord: word,
      isFlipped: false,
      isAnimating: false
    });
  }

  flipCard = () => {
    if (this.state.isAnimating) return;
    this.setState({ isFlipped: !this.state.isFlipped });
  }

  submitFeedback = (feedback: string) => {
    if (!this.state.currentWord || this.state.isAnimating) return;
    this.setState({ isAnimating: true });

    db.submitFeedback(this.state.currentWord.id, this.state.libraryId!, feedback);

    const history = [...this.state.history, { word: this.state.currentWord, feedback }];
    const sessionStats = {
      studied: this.state.sessionStats.studied + 1,
      mastered: feedback === 'mastered' ? this.state.sessionStats.mastered + 1 : this.state.sessionStats.mastered
    };

    this.setState({ history, sessionStats });

    setTimeout(() => {
      this.setState({ isFlipped: false, isAnimating: false });
      this.loadNextWord();
    }, 300);
  }

  markAsMastered = () => {
    if (!this.state.currentWord || this.state.isAnimating) return;
    this.setState({ isAnimating: true });

    db.markAsMastered(this.state.currentWord.id, this.state.libraryId!);

    const history = [...this.state.history, { word: this.state.currentWord, feedback: 'mastered' }];
    const sessionStats = {
      studied: this.state.sessionStats.studied + 1,
      mastered: this.state.sessionStats.mastered + 1
    };

    this.setState({ history, sessionStats });

    setTimeout(() => {
      this.setState({ isFlipped: false, isAnimating: false });
      this.loadNextWord();
    }, 300);
  }

  goBack = () => {
    if (this.state.history.length === 0 || this.state.isAnimating) return;
    const prev = this.state.history[this.state.history.length - 1];
    const history = this.state.history.slice(0, -1);

    const sessionStats = { ...this.state.sessionStats };
    sessionStats.studied = Math.max(0, sessionStats.studied - 1);
    if (prev.feedback === 'mastered') {
      sessionStats.mastered = Math.max(0, sessionStats.mastered - 1);
    }

    this.setState({
      currentWord: prev.word,
      isFlipped: true,
      history,
      sessionStats,
      isAnimating: false
    });
  }

  speakWord = () => {
    if (!this.state.currentWord) return;
    const innerAudioContext = Taro.createInnerAudioContext();
    innerAudioContext.src = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(this.state.currentWord.word)}`;
    innerAudioContext.play();
  }

  continueStudy = () => {
    this.setState({
      isComplete: false,
      sessionStats: { studied: 0, mastered: 0 },
      history: []
    });
    this.loadNextWord();
  }

  goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' });
  }

  getFeedbackLabel = (feedback: string): string => {
    const labels: Record<string, string> = {
      unknown: '不认识',
      familiar: '有点印象',
      well_known: '快记住了',
      mastered: '已掌握'
    };
    return labels[feedback] || feedback;
  }

  render() {
    const { library, currentWord, isFlipped, sessionStats, history, isComplete } = this.state;

    if (isComplete) {
      return (
        <View className='study-page'>
          <View className='complete-card'>
            <Text className='complete-icon'>🎉</Text>
            <Text className='complete-title'>学习完成！</Text>
            <Text className='complete-stats'>
              本次学习 {sessionStats.studied} 个单词，掌握 {sessionStats.mastered} 个
            </Text>
            <View className='complete-actions'>
              <View className='complete-btn primary' onClick={this.continueStudy}>
                <Text className='btn-label'>继续学习</Text>
              </View>
              <View className='complete-btn secondary' onClick={this.goHome}>
                <Text className='btn-label'>返回首页</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View className='study-page'>
        {/* 顶部栏 */}
        <View className='study-header'>
          <View className='back-btn' onClick={this.goBack}>
            <Text className='back-text'>← 回退</Text>
          </View>
          <Text className='study-title'>{library?.name || '学习'}</Text>
          <View className='session-info'>
            <Text className='session-text'>{sessionStats.studied}词 | 掌握{sessionStats.mastered}</Text>
          </View>
        </View>

        {/* 闪卡 */}
        {currentWord && (
          <View className='card-container'>
            <View className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={this.flipCard}>
              {/* 正面 */}
              <View className='card-front'>
                <View className='word-row'>
                  <Text className='word-text'>{currentWord.word}</Text>
                  {currentWord.frequencyRank && currentWord.frequencyRank < 99999 && (
                    <Text className='freq-badge'>#{currentWord.frequencyRank}</Text>
                  )}
                </View>
                {currentWord.phonetic && (
                  <Text className='phonetic-text'>{currentWord.phonetic}</Text>
                )}
                <View className='speak-btn' onClick={e => { e.stopPropagation(); this.speakWord(); }}>
                  <Text className='speak-icon'>🔊</Text>
                </View>
                <Text className='flip-hint'>点击翻转查看释义</Text>
                <View className='quick-master' onClick={e => { e.stopPropagation(); this.markAsMastered(); }}>
                  <Text className='quick-master-text'>✓ 已掌握</Text>
                </View>
              </View>

              {/* 背面 */}
              <View className='card-back'>
                <View className='back-word-row'>
                  <Text className='back-word'>{currentWord.word}</Text>
                  {currentWord.frequencyRank && currentWord.frequencyRank < 99999 && (
                    <Text className='freq-badge'>#{currentWord.frequencyRank}</Text>
                  )}
                </View>
                <View className='definitions'>
                  {currentWord.definitions?.map((def, i) => (
                    <View key={i} className='definition-item'>
                      {def.pos && <Text className='def-pos'>{def.pos}</Text>}
                      <Text className='def-meaning'>{def.meaning}</Text>
                    </View>
                  ))}
                </View>
                {currentWord.examples && currentWord.examples.length > 0 && (
                  <View className='examples'>
                    {currentWord.examples.map((ex, i) => (
                      <Text key={i} className='example-text'>{ex}</Text>
                    ))}
                  </View>
                )}
                {currentWord.phrases && currentWord.phrases.length > 0 && (
                  <View className='phrases'>
                    {currentWord.phrases.map((ph, i) => (
                      <Text key={i} className='phrase-text'>{ph}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* 反馈按钮 */}
        <View className='feedback-bar'>
          <View className='feedback-btn unknown' onClick={() => this.submitFeedback('unknown')}>
            <Text className='fb-text'>不认识</Text>
          </View>
          <View className='feedback-btn familiar' onClick={() => this.submitFeedback('familiar')}>
            <Text className='fb-text'>有点印象</Text>
          </View>
          <View className='feedback-btn well-known' onClick={() => this.submitFeedback('well_known')}>
            <Text className='fb-text'>快记住了</Text>
          </View>
          <View className='feedback-btn mastered' onClick={() => this.submitFeedback('mastered')}>
            <Text className='fb-text'>已掌握</Text>
          </View>
        </View>

        {/* 历史记录 */}
        {history.length > 0 && (
          <View className='history-section'>
            <Text className='history-title'>本次记录</Text>
            <View className='history-list'>
              {history.slice(-5).reverse().map((item, i) => (
                <View key={i} className='history-item'>
                  <Text className='history-word'>{item.word.word}</Text>
                  <Text className={`history-feedback ${item.feedback}`}>{this.getFeedbackLabel(item.feedback)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }
}

import React, { Component } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { db } from '../../services/db';
import type { Word } from '../../types/wordflash';
import './index.scss';

interface WordListState {
  libraryId: number | null;
  libraryName: string;
  words: Word[];
  search: string;
  filter: string;
}

export default class WordList extends Component<{}, WordListState> {
  constructor(props: any) {
    super(props);
    this.state = {
      libraryId: null,
      libraryName: '',
      words: [],
      search: '',
      filter: 'all'
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

  render() {
    const { libraryName, words, search, filter } = this.state;
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
      </View>
    );
  }
}

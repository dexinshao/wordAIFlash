import React, { Component } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { db } from '../../services/db';
import { ai } from '../../services/ai';
import type { Stats } from '../../types/wordflash';
import './index.scss';

interface ProfileState {
  stats: Stats;
  aiStatus: 'checking' | 'connected' | 'error';
  showDataManage: boolean;
}

export default class Profile extends Component<{}, ProfileState> {
  constructor(props: any) {
    super(props);
    this.state = {
      stats: db.getStats(),
      aiStatus: 'checking',
      showDataManage: false
    };
  }

  checkAI = async () => {
    // If no backend configured, show offline status immediately
    if (!ai.isBackendAvailable()) {
      this.setState({ aiStatus: 'error' });
      return;
    }
    try {
      const success = await ai.testConnection();
      this.setState({ aiStatus: success ? 'connected' : 'error' });
    } catch {
      this.setState({ aiStatus: 'error' });
    }
  }

  componentDidMount() {
    this.checkAI();
  }

  toggleDataManage = () => {
    this.setState({ showDataManage: !this.state.showDataManage });
  }

  exportData = () => {
    const data = db.exportData();
    const json = JSON.stringify(data);
    Taro.setClipboardData({
      data: json,
      success: () => {
        Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  }

  clearData = () => {
    Taro.showModal({
      title: '确认清空',
      content: '此操作将清除所有学习数据，无法恢复',
      success: (res) => {
        if (res.confirm) {
          db.clearAllData();
          this.setState({ stats: db.getStats() });
          Taro.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  }

  render() {
    const { stats, aiStatus, showDataManage } = this.state;

    return (
      <View className='profile-page'>
        {/* AI 服务状态 */}
        <View className='section'>
          <View className='section-header'>
            <Text className='section-icon'>🤖</Text>
            <Text className='section-title'>AI 服务</Text>
          </View>
          <View className='ai-status-card'>
            <View className='ai-status-row'>
              <Text className={`ai-status-dot ${aiStatus === 'connected' ? 'active' : ''}`}>
                {aiStatus === 'checking' ? '⏳' : aiStatus === 'connected' ? '✅' : '❌'}
              </Text>
              <Text className='ai-status-text'>
                {aiStatus === 'checking' ? '检测中...' : aiStatus === 'connected' ? '混元大模型已连接' : 'AI 服务暂不可用'}
              </Text>
            </View>
            <Text className='ai-status-hint'>
              AI 服务由腾讯混元大模型提供，无需手动配置
            </Text>
          </View>
        </View>

        {/* 学习统计 */}
        <View className='section'>
          <View className='section-header'>
            <Text className='section-icon'>📊</Text>
            <Text className='section-title'>学习统计</Text>
          </View>
          <View className='stats-grid'>
            <View className='stat-card'>
              <Text className='stat-number'>{stats.totalStudied || 0}</Text>
              <Text className='stat-desc'>累计学习</Text>
            </View>
            <View className='stat-card'>
              <Text className='stat-number'>{stats.totalMastered || 0}</Text>
              <Text className='stat-desc'>累计掌握</Text>
            </View>
            <View className='stat-card'>
              <Text className='stat-number'>{stats.streakDays || 0}</Text>
              <Text className='stat-desc'>连续天数</Text>
            </View>
          </View>
        </View>

        {/* 数据管理 */}
        <View className='section'>
          <View className='section-header' onClick={this.toggleDataManage}>
            <Text className='section-icon'>📁</Text>
            <Text className='section-title'>数据管理</Text>
            <Text className={`section-arrow ${showDataManage ? 'open' : ''}`}>›</Text>
          </View>

          {showDataManage && (
            <View className='data-actions'>
              <View className='data-btn' onClick={this.exportData}>
                <Text className='data-btn-text'>导出数据（复制到剪贴板）</Text>
              </View>
              <View className='data-btn danger' onClick={this.clearData}>
                <Text className='data-btn-text'>清空所有数据</Text>
              </View>
            </View>
          )}
        </View>

        {/* 关于 */}
        <View className='about-section'>
          <Text className='about-text'>WordFlash v1.0</Text>
          <Text className='about-subtext'>基于词频的英语单词学习工具</Text>
          <Text className='about-subtext'>AI 由腾讯混元大模型驱动</Text>
        </View>
      </View>
    );
  }
}

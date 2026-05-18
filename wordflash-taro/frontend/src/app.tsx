import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import 'taro-ui/dist/style/index.scss';
import './app.scss';
import { initializeWordData, isDataLoading, getLoadProgress } from './services/init-data';

interface AppState {
  dataReady: boolean;
  progress: number;
}

class App extends Component<PropsWithChildren, AppState> {
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  constructor(props: any) {
    super(props);
    this.state = { dataReady: false, progress: 0 };
  }

  async componentDidMount() {
    // Start progress polling
    this.progressTimer = setInterval(() => {
      if (isDataLoading()) {
        this.setState({ progress: getLoadProgress() });
      }
    }, 200);

    const success = await initializeWordData();
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    this.setState({ dataReady: true, progress: 100 });
  }

  componentWillUnmount() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
    }
  }

  render() {
    if (!this.state.dataReady) {
      const { progress } = this.state;
      return (
        <View style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#f5f5f5',
          padding: '0 60px'
        }}>
          <Text style={{ fontSize: '48px', marginBottom: '32px' }}>📚</Text>
          <Text style={{ fontSize: '32px', fontWeight: '600', color: '#333', marginBottom: '32px' }}>
            正在准备词库
          </Text>

          {/* Progress bar */}
          <View style={{
            width: '100%',
            height: '12px',
            background: '#e5e7eb',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '16px'
          }}>
            <View style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
          </View>

          <Text style={{ fontSize: '26px', color: '#6366f1', fontWeight: '600', marginBottom: '40px' }}>
            {progress}%
          </Text>

          <Text style={{ fontSize: '24px', color: '#94a3b8', textAlign: 'center', lineHeight: '1.6' }}>
            首次打开需要加载词库数据，稍等片刻就好~{'\n'}下次启动即可瞬间打开
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default App;

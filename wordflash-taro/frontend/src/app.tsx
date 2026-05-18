import { Component, PropsWithChildren } from 'react';
import 'taro-ui/dist/style/index.scss';
import './app.scss';
import { initializeWordData } from './services/init-data';

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    // Initialize word data on first launch
    initializeWordData();
  }

  componentDidShow() {}

  componentDidHide() {}

  render() {
    return this.props.children;
  }
}

export default App;

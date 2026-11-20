import { render } from '@solidjs/web';
import App from './App';
import '@plunz/storybook/styles.css';
import './style.css';

render(() => <App />, document.getElementById('root')!);

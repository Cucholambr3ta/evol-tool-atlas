import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { mountApp } from './app';

const appRoot = document.getElementById('app');
if (appRoot) {
  mountApp(appRoot);
}

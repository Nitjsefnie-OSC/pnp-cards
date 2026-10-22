import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import './styles/global.css';
import './i18n';
import { App } from './App';
import { appTitle } from './lib/appTitle';

document.title = appTitle(__APP_VERSION__, window.matchMedia('(display-mode: standalone)').matches);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

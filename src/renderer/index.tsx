import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'xterm/css/xterm.css';
import './styles/globals.css';

// StrictMode intentionally disabled — it double-invokes effects in dev mode which
// breaks xterm.js initialization (disposes the terminal before rAF fires to open it).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

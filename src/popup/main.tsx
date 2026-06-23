import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupApp } from './components/PopupApp';
import '../styles/tokens.css';
import './popup.css';

const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);

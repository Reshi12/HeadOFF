import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsApp } from './components/OptionsApp';
import '../styles/tokens.css';
import './options.css';

const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);

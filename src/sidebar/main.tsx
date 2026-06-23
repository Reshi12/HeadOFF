import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidebarApp } from './components/SidebarApp';
import '../styles/tokens.css';
import './sidebar.css';

const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SidebarApp />
  </React.StrictMode>
);

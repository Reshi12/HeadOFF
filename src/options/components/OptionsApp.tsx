import React, { useState, useEffect, useCallback } from 'react';
import type { Settings, SiteId } from '../../shared/types';
import type { ExtensionMessage, MessageResponse } from '../../shared/messaging';

// ─── Icons ──────────────────────────────────────────────────
const HandoffIcon = () => (
  <img 
    src={chrome.runtime.getURL('public/icons/icon111.png')} 
    alt="Handoff" 
    style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'contain', marginRight: 'var(--space-2)' }} 
  />
);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── OptionsApp ─────────────────────────────────────────────
export function OptionsApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [apiKeyError, setApiKeyError] = useState('');
  const [storageUsage, setStorageUsage] = useState<{ used: number; quota: number }>({ used: 0, quota: 0 });
  const [threadCount, setThreadCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Apply theme
  useEffect(() => {
    if (settings?.theme) {
      const resolved = settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : settings.theme;
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }, [settings?.theme]);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const [settingsRes, storageRes, threadsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' } as ExtensionMessage),
        chrome.runtime.sendMessage({ type: 'GET_STORAGE_USAGE' } as ExtensionMessage),
        chrome.runtime.sendMessage({ type: 'GET_THREADS' } as ExtensionMessage),
      ]);

      if (settingsRes?.success) {
        setSettings(settingsRes.data);
        setApiKey(settingsRes.data.geminiApiKey || '');
      }
      if (storageRes?.success) setStorageUsage(storageRes.data);
      if (threadsRes?.success) setThreadCount(threadsRes.data?.length || 0);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Save settings
  const saveSetting = async (partial: Partial<Settings>) => {
    const res: MessageResponse = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      data: partial,
    } as ExtensionMessage);
    if (res.success) {
      setSettings(prev => prev ? { ...prev, ...partial } : null);
      showToast('Settings saved');
    }
  };

  // Test API key
  const testKey = async () => {
    if (!apiKey.trim()) return;
    setApiKeyStatus('testing');
    setApiKeyError('');

    const res: MessageResponse = await chrome.runtime.sendMessage({
      type: 'TEST_API_KEY',
      data: { apiKey: apiKey.trim() },
    } as ExtensionMessage);

    if (res.success) {
      setApiKeyStatus('valid');
      await saveSetting({ geminiApiKey: apiKey.trim() });
    } else {
      setApiKeyStatus('invalid');
      setApiKeyError(res.error || 'Invalid key');
    }
  };

  // Export threads
  const handleExport = async () => {
    const res: MessageResponse = await chrome.runtime.sendMessage({
      type: 'EXPORT_THREADS',
    } as ExtensionMessage);

    if (res.success && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `handoff-threads-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${(res.data as any[]).length} threads`);
    }
  };

  // Import threads
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const threads = JSON.parse(text);
      if (!Array.isArray(threads)) throw new Error('Invalid format');

      const res: MessageResponse = await chrome.runtime.sendMessage({
        type: 'IMPORT_THREADS',
        data: { threads },
      } as ExtensionMessage);

      if (res.success) {
        showToast(`Imported ${(res.data as any).imported} threads`);
        loadSettings();
      }
    } catch (err) {
      showToast(`Import failed: ${(err as Error).message}`, 'error');
    }
  };

  // Clear all threads
  const handleClearAll = async () => {
    if (!confirm('Delete ALL threads? This cannot be undone. Consider exporting first.')) return;
    if (!confirm('Are you sure? This will permanently delete all captured threads.')) return;

    // Delete all threads one by one (or we could add a CLEAR_ALL message type)
    const res: MessageResponse = await chrome.runtime.sendMessage({
      type: 'GET_THREADS',
    } as ExtensionMessage);

    if (res.success && res.data) {
      for (const thread of res.data as any[]) {
        await chrome.runtime.sendMessage({
          type: 'DELETE_THREAD',
          data: { id: thread.id },
        } as ExtensionMessage);
      }
      showToast('All threads deleted');
      loadSettings();
    }
  };

  if (!settings) {
    return (
      <div className="options-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const storagePercent = storageUsage.quota > 0 ? (storageUsage.used / storageUsage.quota) * 100 : 0;

  return (
    <div className="options-container">
      {/* Header */}
      <div className="options-header">
        <HandoffIcon />
        <h1>Handoff Settings</h1>
        <span className="version">v1.0.0</span>
      </div>

      {/* API Key Section */}
      <div className="options-section">
        <h2>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M10 1l5 5-7 7H3v-5L10 1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Gemini API Key
        </h2>
        <div className="options-card">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
            Used for auto-structuring captured conversations. Get a free key from{' '}
            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener"
              style={{ color: 'var(--color-primary-500)', textDecoration: 'none' }}>
              Google AI Studio
            </a>.
            The key is stored locally and never leaves your device.
          </p>
          <div className="api-key-group">
            <input
              className="input"
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setApiKeyStatus('idle'); }}
              placeholder="Enter your Gemini API key"
            />
            <button className="btn btn-primary" onClick={testKey} disabled={apiKeyStatus === 'testing' || !apiKey.trim()}>
              {apiKeyStatus === 'testing' ? 'Testing...' : 'Save & Test'}
            </button>
          </div>
          {apiKeyStatus !== 'idle' && (
            <div className={`api-key-status ${apiKeyStatus}`}>
              {apiKeyStatus === 'testing' && '⏳ Testing API key...'}
              {apiKeyStatus === 'valid' && '✓ API key is valid and saved'}
              {apiKeyStatus === 'invalid' && `✗ Invalid key: ${apiKeyError}`}
            </div>
          )}
        </div>
      </div>

      {/* Site Toggles */}
      <div className="options-section">
        <h2>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Enabled Sites
        </h2>
        <div className="options-card">
          {(['chatgpt', 'claude', 'gemini'] as SiteId[]).map(site => (
            <div key={site} className="options-row">
              <div className="options-row-label">
                <h3>{site === 'chatgpt' ? 'ChatGPT' : site === 'claude' ? 'Claude' : 'Gemini'}</h3>
                <p>{site === 'chatgpt' ? 'chatgpt.com / chat.openai.com' :
                  site === 'claude' ? 'claude.ai' : 'gemini.google.com'}</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.enabledSites[site]}
                  onChange={e => saveSetting({
                    enabledSites: { ...settings.enabledSites, [site]: e.target.checked },
                  })}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="options-section">
        <h2>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Theme
        </h2>
        <div className="options-card">
          <div className="theme-select">
            {(['light', 'dark', 'system'] as const).map(theme => (
              <button
                key={theme}
                className={`theme-option ${settings.theme === theme ? 'active' : ''}`}
                onClick={() => saveSetting({ theme })}
              >
                {theme === 'light' ? '☀ Light' : theme === 'dark' ? '🌙 Dark' : '💻 System'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="options-section">
        <h2>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
            <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.3"/>
            <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Data Management
        </h2>
        <div className="options-card">
          <div className="options-row">
            <div className="options-row-label">
              <h3>Storage Usage</h3>
              <p>{threadCount} threads · {formatBytes(storageUsage.used)} used</p>
              <div className="storage-bar">
                <div className="storage-bar-fill" style={{ width: `${Math.min(storagePercent, 100)}%` }} />
              </div>
              <div className="storage-info">
                <span>{formatBytes(storageUsage.used)}</span>
                <span>{formatBytes(storageUsage.quota)}</span>
              </div>
            </div>
          </div>

          <div className="options-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="options-row-label">
              <h3>Export & Import</h3>
              <p>Back up your threads as JSON or restore from a previous export.</p>
            </div>
            <div className="export-import-row">
              <button className="btn btn-secondary" onClick={handleExport}>
                📦 Export Threads
              </button>
              <label className="file-input-label">
                📥 Import Threads
                <input type="file" accept=".json" onChange={handleImport} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="options-section">
        <h2 style={{ color: 'var(--color-error)' }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="12" r="0.7" fill="currentColor"/>
          </svg>
          Danger Zone
        </h2>
        <div className="options-card danger-zone">
          <div className="options-row">
            <div className="options-row-label">
              <h3>Delete All Threads</h3>
              <p>Permanently remove all captured threads. This cannot be undone.</p>
            </div>
            <button className="btn btn-danger" onClick={handleClearAll}>
              Delete All
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`options-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

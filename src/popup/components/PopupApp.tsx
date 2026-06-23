import React, { useState, useEffect, useCallback } from 'react';
import type { Thread, Draft, SiteId, Settings } from '../../shared/types';
import type { ExtensionMessage, MessageResponse } from '../../shared/messaging';

// ─── Icons ──────────────────────────────────────────────────
const HandoffIcon = () => (
  <img 
    src={chrome.runtime.getURL('public/icons/icon111.png')} 
    alt="Handoff" 
    style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'contain' }} 
  />
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <polyline points="10,3 5,8 10,13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const InjectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 8h8M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <polyline points="3,5 4,14 12,14 13,5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M6 3h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const EmptyThreadsIcon = () => (
  <img 
    src={chrome.runtime.getURL('public/icons/icon111.png')} 
    alt="Empty" 
    style={{ width: '64px', height: '64px', borderRadius: '12px', opacity: 0.35, objectFit: 'contain' }} 
  />
);

// ─── Helpers ────────────────────────────────────────────────
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getSiteBadgeClass(site: SiteId): string {
  return `site-badge site-badge-${site}`;
}

function getSiteDisplayName(site: SiteId): string {
  const names: Record<SiteId, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
  };
  return names[site] || site;
}

// ─── PopupApp ───────────────────────────────────────────────
export function PopupApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // States for API Key setup
  const [newApiKey, setNewApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) return;
    setSavingKey(true);
    setSaveError('');
    try {
      const testRes: MessageResponse = await chrome.runtime.sendMessage({
        type: 'TEST_API_KEY',
        data: { apiKey: newApiKey.trim() },
      } as ExtensionMessage);

      if (!testRes.success) {
        setSaveError(testRes.error || 'Invalid Gemini API key');
        setSavingKey(false);
        return;
      }

      const partialSettings = { geminiApiKey: newApiKey.trim() };
      const res: MessageResponse = await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        data: partialSettings,
      } as ExtensionMessage);

      if (res.success) {
        setSettings(prev => prev ? { ...prev, ...partialSettings } : null);
        setNewApiKey('');
      } else {
        setSaveError(res.error || 'Failed to save settings');
      }
    } catch (e) {
      setSaveError((e as Error).message || 'Failed to save settings');
    }
    setSavingKey(false);
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

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const settingsRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' } as ExtensionMessage);
      if (settingsRes?.success) setSettings(settingsRes.data);
    } catch (e) {
      console.error('[Handoff] Failed to load data:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Open options
  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="popup-container" style={{ paddingBottom: '16px' }}>
      {loading && <div className="loading-bar" />}

      {/* Header */}
      <div className="popup-header">
        <div className="popup-logo">
          <HandoffIcon />
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Handoff</h1>
        </div>
        <div className="popup-header-actions">
          <button className="icon-btn" onClick={openOptions} title="Settings" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
          Gemini API key
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="password"
            placeholder="Your Gemini API key..."
            value={newApiKey}
            onChange={e => {
              setNewApiKey(e.target.value);
              setSaveError('');
            }}
            style={{ 
              flex: 1, 
              padding: '8px 12px', 
              borderRadius: '6px', 
              border: '1px solid var(--border-color, #e5e7eb)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSaveApiKey}
            disabled={savingKey || !newApiKey.trim()}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px',
              background: 'var(--accent-color, #4F46E5)',
              color: 'white',
              border: 'none',
              cursor: (savingKey || !newApiKey.trim()) ? 'not-allowed' : 'pointer',
              opacity: (savingKey || !newApiKey.trim()) ? 0.7 : 1,
              fontWeight: 500,
              fontSize: '13px'
            }}
          >
            {savingKey ? 'Saving...' : 'Save'}
          </button>
        </div>
        
        {saveError && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>{saveError}</div>}
        
        {settings?.geminiApiKey && !saveError && (
          <div style={{ color: '#10b981', fontSize: '12px', marginTop: '8px' }}>✓ API key saved</div>
        )}
      </div>
    </div>
  );
}

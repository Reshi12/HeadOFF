import React, { useState, useEffect, useCallback } from 'react';
import type { Thread, SiteId } from '../../shared/types';
import type { ExtensionMessage, MessageResponse } from '../../shared/messaging';

// ─── Helpers ────────────────────────────────────────────────
function formatTimeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function getSiteLabel(s: SiteId) {
  return s === 'chatgpt' ? 'ChatGPT' : s === 'claude' ? 'Claude' : 'Gemini';
}

const HandoffIcon = ({ size = 20, opacity = 1 }: { size?: number; opacity?: number }) => (
  <img 
    src={chrome.runtime.getURL('public/icons/icon111.png')} 
    alt="Handoff" 
    style={{ width: `${size}px`, height: `${size}px`, borderRadius: '4px', objectFit: 'contain', opacity }} 
  />
);

// ─── SidebarApp ─────────────────────────────────────────────
export function SidebarApp() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<SiteId | 'all'>('all');
  const [selected, setSelected] = useState<Thread | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [status, setStatus] = useState('');

  // Apply theme from settings
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' } as ExtensionMessage).then(res => {
      if (res?.success) {
        const theme = res.data.theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : res.data.theme;
        document.documentElement.setAttribute('data-theme', theme);
      }
    });
  }, []);

  const loadThreads = useCallback(async () => {
    const res: MessageResponse = await chrome.runtime.sendMessage({
      type: 'GET_THREADS',
    } as ExtensionMessage);
    if (res.success) setThreads(res.data || []);
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Filtered threads
  const filtered = threads.filter(t => {
    if (siteFilter !== 'all' && t.sourceSite !== siteFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q));
    }
    return true;
  });

  // Inject
  const handleInject = async (thread: Thread) => {
    setInjecting(true);
    setStatus('');
    try {
      // Get active tab
      const siteRes: MessageResponse = await chrome.runtime.sendMessage({
        type: 'GET_ACTIVE_SITE',
      } as ExtensionMessage);

      if (!siteRes.success || !siteRes.data?.tabId) {
        setStatus('No active AI chat tab found.');
        setInjecting(false);
        return;
      }

      const res: MessageResponse = await chrome.runtime.sendMessage({
        type: 'INJECT_THREAD',
        data: { threadId: thread.id, tabId: siteRes.data.tabId },
      } as ExtensionMessage);

      if (res.success) {
        setStatus('✓ Inserted into chat');
        setTimeout(() => setStatus(''), 3000);
      } else {
        setStatus(`Error: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
    setInjecting(false);
  };

  // ─── Detail View ──────────────────────────────────────────
  if (selected) {
    return (
      <div className="sidebar-container">
        <div className="sidebar-header">
          <HandoffIcon size={20} />
          <h2>Handoff</h2>
        </div>

        <div className="sidebar-detail">
          <div className="sidebar-detail-header">
            <button className="sidebar-close" onClick={() => setSelected(null)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <polyline points="10,3 5,8 10,13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.title}
            </span>
            <span className={`site-badge site-badge-${selected.sourceSite}`}>
              {getSiteLabel(selected.sourceSite)}
            </span>
          </div>

          <div className="sidebar-detail-body">
            {selected.summary && (
              <div className="sidebar-detail-section">
                <div className="sidebar-detail-section-label">Summary</div>
                <div className="sidebar-detail-section-content">{selected.summary}</div>
              </div>
            )}
            {selected.goals.length > 0 && (
              <div className="sidebar-detail-section">
                <div className="sidebar-detail-section-label">Goals</div>
                <div className="sidebar-detail-section-content">
                  <ul>{selected.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </div>
              </div>
            )}
            {selected.keyDecisions.length > 0 && (
              <div className="sidebar-detail-section">
                <div className="sidebar-detail-section-label">Key Decisions</div>
                <div className="sidebar-detail-section-content">
                  <ul>{selected.keyDecisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              </div>
            )}
            {selected.openQuestions.length > 0 && (
              <div className="sidebar-detail-section">
                <div className="sidebar-detail-section-label">Open Questions</div>
                <div className="sidebar-detail-section-content">
                  <ul>{selected.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </div>
              </div>
            )}
            {selected.tags.length > 0 && (
              <div className="sidebar-detail-section">
                <div className="sidebar-detail-section-label">Tags</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {selected.tags.map((t, i) => <span key={i} className="tag">{t}</span>)}
                </div>
              </div>
            )}

            {status && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                background: status.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: status.startsWith('✓') ? '#059669' : '#dc2626',
                textAlign: 'center',
              }}>
                {status}
              </div>
            )}
          </div>

          <div className="sidebar-detail-footer">
            <button
              className="btn btn-primary"
              onClick={() => handleInject(selected)}
              disabled={injecting}
            >
              {injecting ? 'Inserting...' : '→ Insert into chat'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────
  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <HandoffIcon size={20} />
        <h2>Handoff</h2>
      </div>

      <div className="sidebar-filters">
        <input
          type="text"
          placeholder="Search threads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="site-filter-tabs">
          <button
            className={`site-tab ${siteFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSiteFilter('all')}
          >All</button>
          {(['chatgpt', 'claude', 'gemini'] as SiteId[]).map(s => (
            <button
              key={s}
              className={`site-tab ${siteFilter === s ? 'active' : ''}`}
              onClick={() => setSiteFilter(s)}
            >
              {getSiteLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-list">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <HandoffIcon size={48} opacity={0.35} />
            <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>
              {search ? 'No matching threads' : 'No threads yet'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Capture a conversation to get started
            </p>
          </div>
        ) : (
          filtered.map(thread => (
            <div
              key={thread.id}
              className="sidebar-thread-item"
              onClick={() => setSelected(thread)}
            >
              <div className="sidebar-thread-title">{thread.title}</div>
              <div className="sidebar-thread-meta">
                <span className={`site-badge site-badge-${thread.sourceSite}`} style={{ padding: '1px 6px' }}>
                  {getSiteLabel(thread.sourceSite)}
                </span>
                <span>{formatTimeAgo(thread.createdAt)}</span>
              </div>
              {thread.summary && (
                <div className="sidebar-thread-summary">{thread.summary}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

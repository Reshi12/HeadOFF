// ─── Floating Capture Button (injected into AI sites) ────────
import type { SiteAdapter } from './adapters/SiteAdapter';
import type { ExtensionMessage } from '../shared/messaging';

const BUTTON_ID = 'handoff-floating-btn';
const PANEL_ID = 'handoff-capture-panel';

// Branding icon image HTML using icon111.png
const ICON_URL = chrome.runtime.getURL('public/icons/icon111.png');
const HANDOFF_ICON = `<img src="${ICON_URL}" width="28" height="28" alt="Handoff" style="border-radius: 50%; object-fit: cover; pointer-events: none;" />`;
const HANDOFF_HEADER_ICON = `<img src="${ICON_URL}" width="20" height="20" alt="Handoff" style="border-radius: 4px; object-fit: contain; pointer-events: none;" />`;

// Module-level tracking for position interval and event listeners to prevent leaks
let positionInterval: any = null;
let scrollListener: (() => void) | null = null;
let resizeListener: (() => void) | null = null;

export function injectFloatingButton(adapter: SiteAdapter) {
  // Don't double-inject
  if (document.getElementById(BUTTON_ID)) return;

  // Create shadow DOM host to isolate styles
  const host = document.createElement('div');
  host.id = BUTTON_ID;
  // Start hidden to prevent a flicker before the first positioning
  host.style.cssText = 'position:fixed;z-index:2147483647;display:none;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }

      .handoff-fab {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        padding: 0;
        overflow: hidden;
        transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }
      .handoff-fab:hover {
        transform: scale(1.12);
        filter: brightness(1.1);
      }
      .handoff-fab:active {
        transform: scale(0.94);
      }
      .handoff-fab img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }
      .handoff-fab .pulse-ring {
        display: none;
      }

      @keyframes pulse-expand {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1.4); opacity: 0; }
      }

      /* ── Capture Panel ── */
      .capture-panel {
        position: fixed;
        width: 340px;
        max-height: 400px;
        background: #ffffff;
        border: 1px solid #e7e5e4;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: #1c1917;
        display: none;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 200ms ease-out;
        z-index: 2147483647;
      }
      .capture-panel.visible { display: flex; }

      @media (prefers-color-scheme: dark) {
        .capture-panel {
          background: #27272a;
          border-color: #3f3f46;
          color: #f4f4f5;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        .capture-panel input, .capture-panel textarea {
          background: #18181b;
          border-color: #3f3f46;
          color: #f4f4f5;
        }
        .capture-panel .panel-header {
          border-bottom-color: #3f3f46;
        }
        .capture-panel .preview-area {
          background: #18181b;
          border-color: #3f3f46;
        }
      }

      @keyframes slideUp {
        from { transform: translateY(12px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .panel-header {
        padding: 16px;
        border-bottom: 1px solid #e7e5e4;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .panel-header h3 {
        font-size: 15px;
        font-weight: 600;
        flex: 1;
      }
      .panel-header .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #78716c;
        padding: 4px;
        border-radius: 6px;
        display: flex;
      }
      .panel-header .close-btn:hover { background: #f5f5f4; color: #1c1917; }

      .panel-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        max-height: 350px;
      }

      label {
        font-size: 12px;
        font-weight: 600;
        color: #57534e;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      input, textarea {
        width: 100%;
        padding: 8px 12px;
        font-family: inherit;
        font-size: 13px;
        border: 1px solid #e7e5e4;
        border-radius: 8px;
        outline: none;
        background: #fafaf9;
        transition: border-color 150ms;
      }
      input:focus, textarea:focus {
        border-color: #818cf8;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
      }

      textarea {
        min-height: 60px;
        resize: vertical;
      }

      .preview-area {
        background: #fafaf9;
        border: 1px solid #e7e5e4;
        border-radius: 8px;
        padding: 10px;
        font-size: 12px;
        color: #57534e;
        max-height: 120px;
        overflow-y: auto;
        white-space: pre-wrap;
        font-family: 'JetBrains Mono', monospace;
        line-height: 1.5;
      }

      .turn-count {
        font-size: 12px;
        color: #78716c;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .panel-footer {
        padding: 12px 16px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        border-top: 1px solid #e7e5e4;
      }

      .btn {
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        border: 1px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        transition: all 150ms;
      }
      .btn-cancel {
        background: transparent;
        border-color: #e7e5e4;
        color: #57534e;
      }
      .btn-cancel:hover { background: #f5f5f4; }

      .btn-capture {
        background: linear-gradient(135deg, #4F46E5, #3730A3);
        color: white;
        box-shadow: 0 2px 8px rgba(55, 48, 163, 0.3);
      }
      .btn-capture:hover {
        box-shadow: 0 4px 12px rgba(55, 48, 163, 0.4);
        transform: translateY(-1px);
      }
      .btn-capture:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .status-msg {
        font-size: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        text-align: center;
      }
      .status-success {
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
      }
      .status-error {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
      }
      .status-loading {
        background: rgba(99, 102, 241, 0.1);
        color: #4f46e5;
      }
    </style>

    <button class="handoff-fab" title="Capture conversation with Handoff">
      <span class="pulse-ring"></span>
      ${HANDOFF_ICON}
    </button>

    <div class="capture-panel" id="capture-panel">
      <div class="panel-header">
        <span style="display:flex;">${HANDOFF_HEADER_ICON}</span>
        <h3>Capture Thread</h3>
        <button class="close-btn" title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="panel-body">
        <div>
          <label>Title</label>
          <input type="text" id="thread-title" placeholder="Auto-generated if left blank" />
        </div>
        <div id="status-container"></div>
      </div>
      <div class="panel-footer">
        <button class="btn btn-cancel" id="btn-cancel">Cancel</button>
        <button class="btn btn-capture" id="btn-capture">Capture Thread</button>
      </div>
    </div>
  `;

  // ─── Event Wiring ───────────────────────────────────────────
  const fab = shadow.querySelector('.handoff-fab') as HTMLButtonElement;
  const panel = shadow.querySelector('#capture-panel') as HTMLDivElement;
  const closeBtn = shadow.querySelector('.close-btn') as HTMLButtonElement;
  const cancelBtn = shadow.querySelector('#btn-cancel') as HTMLButtonElement;
  const captureBtn = shadow.querySelector('#btn-capture') as HTMLButtonElement;
  const titleInput = shadow.querySelector('#thread-title') as HTMLInputElement;
  const statusContainer = shadow.querySelector('#status-container') as HTMLDivElement;

  let extractedData: ReturnType<typeof adapter.extractConversation> | null = null;

  // ─── Position Calculation Logic ─────────────────────────────
  // Find the input bar — the rounded dark container that holds the text field.
  // Walk up from the inner input element looking for the first ancestor with
  // a visible border-radius (the "pill" bar).
  function findInputBar(inputEl: HTMLElement): HTMLElement {
    let el: HTMLElement = inputEl;
    let best: HTMLElement = inputEl;

    while (el.parentElement && el.parentElement !== document.body) {
      const parent = el.parentElement as HTMLElement;
      const style = window.getComputedStyle(parent);
      const rect = parent.getBoundingClientRect();

      if (rect.height === 0 || rect.width === 0) { el = parent; continue; }

      const br = parseFloat(style.borderRadius) || 0;
      if (br >= 8 && rect.width < window.innerWidth * 0.95) {
        best = parent;
      }

      if (rect.width >= window.innerWidth * 0.95) break;
      el = parent;
    }
    return best;
  }

  const BUTTON_SIZE = 36;

  function updatePosition() {
    const inputBox = adapter.findActiveInputBox();

    host.style.zIndex = '2147483647';
    host.style.position = 'fixed';

    if (inputBox && inputBox.offsetHeight > 0) {
      const bar = findInputBar(inputBox);
      const rect = bar.getBoundingClientRect();

      // Position BELOW the input bar, right-aligned
      const left = rect.right - BUTTON_SIZE - 8;
      const top = rect.bottom + 8;

      host.style.top = `${top}px`;
      host.style.left = `${left}px`;
      host.style.bottom = 'auto';
      host.style.right = 'auto';
      host.style.display = 'block';
    } else {
      // Fallback: bottom-right corner
      host.style.bottom = '24px';
      host.style.right = '24px';
      host.style.top = 'auto';
      host.style.left = 'auto';
      host.style.display = 'block';
    }
  }

  // Setup periodic repositioning and viewport action hooks
  scrollListener = updatePosition;
  resizeListener = updatePosition;
  window.addEventListener('scroll', scrollListener, { passive: true });
  window.addEventListener('resize', resizeListener, { passive: true });
  positionInterval = setInterval(updatePosition, 100);

  // Trigger initial positioning right away
  updatePosition();

  function showPanel() {
    // Position the panel above the FAB button so it's fully visible
    const hostRect = host.getBoundingClientRect();
    const panelWidth = 340;
    const panelHeight = 260; // approximate

    let panelLeft = hostRect.right - panelWidth;
    let panelBottom = window.innerHeight - hostRect.top + 8;

    // If there's not enough space above, open below
    if (hostRect.top < panelHeight + 16) {
      panel.style.top = `${hostRect.bottom + 8}px`;
      panel.style.bottom = 'auto';
    } else {
      panel.style.bottom = `${panelBottom}px`;
      panel.style.top = 'auto';
    }

    // Keep panel within horizontal bounds
    if (panelLeft < 8) panelLeft = 8;
    panel.style.left = `${panelLeft}px`;
    panel.style.right = 'auto';

    panel.classList.add('visible');
    fab.style.opacity = '0';
    fab.style.pointerEvents = 'none';

    // Extract conversation
    try {
      extractedData = adapter.extractConversation();
    } catch (err) {
      captureBtn.disabled = true;
      statusContainer.innerHTML = '<div class="status-msg status-error">Failed to extract conversation.</div>';
    }
  }

  function hidePanel() {
    panel.classList.remove('visible');
    fab.style.opacity = '1';
    fab.style.pointerEvents = 'auto';
    statusContainer.innerHTML = '';
    captureBtn.disabled = false;
  }

  fab.addEventListener('click', showPanel);
  closeBtn.addEventListener('click', hidePanel);
  cancelBtn.addEventListener('click', hidePanel);

  captureBtn.addEventListener('click', async () => {
    if (!extractedData || extractedData.rawText.trim().length === 0) {
      statusContainer.innerHTML = '<div class="status-msg status-error">No conversation content found to capture.</div>';
      return;
    }

    captureBtn.disabled = true;
    statusContainer.innerHTML = '<div class="status-msg status-loading">Capturing & structuring...</div>';

    try {
      const tags: string[] = [];

      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_REQUEST',
        data: {
          conversation: extractedData,
          siteId: adapter.siteId,
          sourceUrl: window.location.href,
          title: titleInput.value.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        },
      } satisfies ExtensionMessage);

      if (response?.success) {
        statusContainer.innerHTML = `<div class="status-msg status-success">✓ Thread saved: "${response.data?.title || 'Untitled'}"</div>`;
        setTimeout(hidePanel, 2000);
      } else {
        statusContainer.innerHTML = `<div class="status-msg status-error">Error: ${response?.error || 'Unknown error'}</div>`;
        captureBtn.disabled = false;
      }
    } catch (err) {
      statusContainer.innerHTML = `<div class="status-msg status-error">Error: ${(err as Error).message}</div>`;
      captureBtn.disabled = false;
    }
  });
}

export function removeFloatingButton() {
  if (positionInterval) {
    clearInterval(positionInterval);
    positionInterval = null;
  }
  if (scrollListener) {
    window.removeEventListener('scroll', scrollListener);
    scrollListener = null;
  }
  if (resizeListener) {
    window.removeEventListener('resize', resizeListener);
    resizeListener = null;
  }
  const el = document.getElementById(BUTTON_ID);
  if (el) el.remove();
}


// ─── Gemini Content Script Entry ─────────────────────────────
import { GeminiAdapter } from './adapters/gemini';
import { injectFloatingButton } from './floatingButton';
import { handleInsertRequest } from './injector';
import type { ExtensionMessage } from '../shared/messaging';

const adapter = new GeminiAdapter();

function init() {
  injectFloatingButton(adapter);
}

// Handle SPA navigation
const observer = new MutationObserver(() => {
  if (!document.getElementById('handoff-floating-btn')) {
    init();
  }
});

// ─── Message Listener ────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONVERSATION') {
    try {
      const conversation = adapter.extractConversation();
      sendResponse({ success: true, data: conversation });
    } catch (err) {
      sendResponse({ success: false, error: (err as Error).message });
    }
    return true;
  }

  if (message.type === 'INSERT_INTO_INPUT') {
    handleInsertRequest(adapter, message.data)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─── Initialize ──────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

observer.observe(document.body, { childList: true, subtree: true });

console.log('[Handoff] Gemini content script loaded');

// ─── Claude Site Adapter ─────────────────────────────────────
import type { SiteAdapter } from './SiteAdapter';
import {
  insertIntoContentEditable,
  insertIntoTextarea,
  simulateFileDrop,
  base64ToFile,
  extractTextWithCodeBlocks,
} from './SiteAdapter';
import type { ExtractedConversation, ConversationTurn } from '../../shared/types';

export class ClaudeAdapter implements SiteAdapter {
  siteId = 'claude' as const;

  matches(url: string): boolean {
    return /^https:\/\/claude\.ai\//.test(url);
  }

  extractConversation(): ExtractedConversation {
    const turns: ConversationTurn[] = [];

    // Claude uses distinct containers for human/assistant messages
    // Try data attributes first, then structural selectors
    const messageContainers = document.querySelectorAll(
      '[data-testid="user-human-turn"], [data-testid="user-assistant-turn"], ' +
      '[class*="human-turn"], [class*="assistant-turn"], ' +
      '.font-user-message, .font-claude-message'
    );

    if (messageContainers.length > 0) {
      messageContainers.forEach(container => {
        const el = container as HTMLElement;
        const isHuman =
          el.getAttribute('data-testid')?.includes('human') ||
          el.className?.includes('human') ||
          el.classList.contains('font-user-message');

        const turnRole: 'user' | 'assistant' = isHuman ? 'user' : 'assistant';

        const content = extractTextWithCodeBlocks(el);
        const codeBlocks = Array.from(el.querySelectorAll('pre code')).map(code => ({
          language: code.className?.match(/language-(\w+)/)?.[1] || '',
          code: code.textContent || '',
        }));

        if (content.trim()) {
          turns.push({
            role: turnRole,
            content,
            codeBlocks,
            attachmentHints: [],
          });
        }
      });
    } else {
      // Broader fallback: look for the main conversation container
      const conversationEl = document.querySelector(
        '[class*="conversation"], [class*="chat-messages"], main'
      );
      if (conversationEl) {
        // Try to identify turn boundaries by looking at direct children
        const children = conversationEl.querySelectorAll(':scope > div');
        children.forEach((child, index) => {
          const content = extractTextWithCodeBlocks(child as HTMLElement);
          if (content.trim() && content.length > 5) {
            turns.push({
              role: index % 2 === 0 ? 'user' : 'assistant',
              content,
              codeBlocks: [],
              attachmentHints: [],
            });
          }
        });
      }
    }

    const rawText = turns.map(t =>
      `[${t.role === 'user' ? 'User' : 'Assistant'}]:\n${t.content}`
    ).join('\n\n---\n\n');

    return { turns, rawText, attachments: [] };
  }

  findActiveInputBox(): HTMLElement | null {
    const selectors = [
      '[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-placeholder]',
      'fieldset [contenteditable="true"]',
      'div.ProseMirror',
      '[contenteditable="true"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && (el as HTMLElement).offsetHeight > 0) {
        return el as HTMLElement;
      }
    }

    return null;
  }

  insertText(el: HTMLElement, text: string): void {
    if (el instanceof HTMLTextAreaElement) {
      insertIntoTextarea(el, text);
    } else {
      insertIntoContentEditable(el, text);
    }
  }

  async insertAttachment(file: File): Promise<boolean> {
    const dropZone = document.querySelector(
      '[class*="composer"], [class*="input-area"], fieldset, form'
    ) as HTMLElement;
    if (dropZone) {
      return simulateFileDrop(dropZone, file);
    }
    return false;
  }

  observeForInputReady(callback: () => void): void {
    const observer = new MutationObserver(() => {
      if (this.findActiveInputBox()) {
        callback();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

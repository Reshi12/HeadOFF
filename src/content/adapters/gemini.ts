// ─── Gemini Site Adapter ─────────────────────────────────────
import type { SiteAdapter } from './SiteAdapter';
import {
  insertIntoContentEditable,
  insertIntoTextarea,
  simulateFileDrop,
  base64ToFile,
  extractTextWithCodeBlocks,
} from './SiteAdapter';
import type { ExtractedConversation, ConversationTurn } from '../../shared/types';

export class GeminiAdapter implements SiteAdapter {
  siteId = 'gemini' as const;

  matches(url: string): boolean {
    return /^https:\/\/gemini\.google\.com\//.test(url);
  }

  extractConversation(): ExtractedConversation {
    const turns: ConversationTurn[] = [];

    // Gemini uses heavily dynamic class names, so rely on structure/ARIA
    // Look for message containers using structural patterns
    const messageContainers = document.querySelectorAll(
      'message-content, .conversation-container > div, ' +
      '[data-content-type="immersive"], ' +
      '.query-content, .response-content, ' +
      '.user-query, .model-response'
    );

    if (messageContainers.length > 0) {
      messageContainers.forEach(container => {
        const el = container as HTMLElement;
        const isUser =
          el.classList.contains('query-content') ||
          el.classList.contains('user-query') ||
          el.tagName.toLowerCase() === 'user-query' ||
          el.querySelector('[data-query-source]') !== null;

        const turnRole: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
        const content = extractTextWithCodeBlocks(el);

        const codeBlocks = Array.from(el.querySelectorAll('pre code, code-block')).map(code => ({
          language: code.getAttribute('language') || code.className?.match(/language-(\w+)/)?.[1] || '',
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
    }

    // Fallback: try to find turns by broader structural patterns
    if (turns.length === 0) {
      // Gemini wraps turns in web-component-like elements or nested divs
      const allTurns = document.querySelectorAll(
        '[class*="turn"], [class*="message"], [class*="query"], [class*="response"]'
      );
      
      const seen = new Set<string>();
      allTurns.forEach((el, index) => {
        const content = extractTextWithCodeBlocks(el as HTMLElement);
        if (content.trim() && content.length > 5 && !seen.has(content)) {
          seen.add(content);
          turns.push({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content,
            codeBlocks: [],
            attachmentHints: [],
          });
        }
      });
    }

    const rawText = turns.map(t =>
      `[${t.role === 'user' ? 'User' : 'Assistant'}]:\n${t.content}`
    ).join('\n\n---\n\n');

    return { turns, rawText, attachments: [] };
  }

  findActiveInputBox(): HTMLElement | null {
    // Gemini uses a rich text editor — try multiple selectors
    const selectors = [
      '.ql-editor[contenteditable="true"]',
      'rich-textarea [contenteditable="true"]',
      '[contenteditable="true"][aria-label*="prompt"]',
      '[contenteditable="true"][aria-label*="message"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && (el as HTMLElement).offsetHeight > 0) {
        return el as HTMLElement;
      }
    }

    // Last resort: any visible contenteditable
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetHeight > 20 && htmlEl.offsetWidth > 100) {
        return htmlEl;
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
      '[class*="input-area"], [class*="composer"], form, rich-textarea'
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

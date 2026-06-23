// ─── ChatGPT Site Adapter ────────────────────────────────────
import type { SiteAdapter } from './SiteAdapter';
import {
  insertIntoContentEditable,
  insertIntoTextarea,
  simulateFileDrop,
  base64ToFile,
  extractTextWithCodeBlocks,
} from './SiteAdapter';
import type { ExtractedConversation, ConversationTurn } from '../../shared/types';

export class ChatGPTAdapter implements SiteAdapter {
  siteId = 'chatgpt' as const;

  matches(url: string): boolean {
    return /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url);
  }

  extractConversation(): ExtractedConversation {
    const turns: ConversationTurn[] = [];

    // ChatGPT uses article elements or divs with data-message-author-role
    // Try multiple selectors for robustness
    const messageContainers = document.querySelectorAll(
      '[data-message-author-role], article[data-testid^="conversation-turn"]'
    );

    if (messageContainers.length > 0) {
      messageContainers.forEach(container => {
        const el = container as HTMLElement;
        const role = el.getAttribute('data-message-author-role') ||
          (el.querySelector('[data-message-author-role]') as HTMLElement)?.getAttribute('data-message-author-role');

        const turnRole: 'user' | 'assistant' = role === 'user' ? 'user' : 'assistant';

        // Find the message content area
        const contentEl = el.querySelector('.markdown, .whitespace-pre-wrap, [data-message-id]') as HTMLElement || el;
        const content = extractTextWithCodeBlocks(contentEl);

        // Extract code blocks
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
      // Fallback: try to find conversation turns by structure
      const allMessages = document.querySelectorAll('[class*="message"], [class*="turn"]');
      allMessages.forEach((el, index) => {
        const content = extractTextWithCodeBlocks(el as HTMLElement);
        if (content.trim()) {
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
    // ChatGPT uses a contenteditable div inside the composer
    const selectors = [
      '#prompt-textarea',
      '[id="prompt-textarea"]',
      'div[contenteditable="true"][data-placeholder]',
      'textarea[data-id="root"]',
      'div.ProseMirror[contenteditable="true"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el as HTMLElement;
    }

    // Broader fallback
    const contentEditables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of contentEditables) {
      if ((el as HTMLElement).offsetHeight > 0) return el as HTMLElement;
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
    // Try to find the file upload area
    const dropZone = document.querySelector('[class*="composer"], [class*="input-area"], form') as HTMLElement;
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

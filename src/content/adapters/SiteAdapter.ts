// ─── Site Adapter Interface ──────────────────────────────────
import type { SiteId, ExtractedConversation } from '../../shared/types';

export interface SiteAdapter {
  siteId: SiteId;
  matches(url: string): boolean;
  extractConversation(): ExtractedConversation;
  findActiveInputBox(): HTMLElement | null;
  insertText(el: HTMLElement, text: string): void;
  insertAttachment(file: File): Promise<boolean>;
  observeForInputReady(callback: () => void): void;
}

// ─── Shared Helpers ──────────────────────────────────────────

/**
 * Insert text into a contenteditable div with proper React/framework event dispatch
 */
export function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();

  // Clear existing content
  const selection = window.getSelection();
  if (selection) {
    selection.selectAllChildren(el);
    selection.deleteFromDocument();
  }

  // Use execCommand for framework compatibility (triggers React onChange)
  document.execCommand('insertText', false, text);

  // Fallback: if execCommand didn't work, set directly and dispatch events
  if (!el.textContent || el.textContent.trim().length === 0) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Insert text into a textarea, bypassing React's value tracker
 */
export function insertIntoTextarea(el: HTMLTextAreaElement, text: string): void {
  el.focus();

  // Use the native setter to bypass React's synthetic event system
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, text);
  } else {
    el.value = text;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Try to simulate a file drop on the page's file input area
 */
export async function simulateFileDrop(
  dropTarget: HTMLElement,
  file: File
): Promise<boolean> {
  try {
    const dt = new DataTransfer();
    dt.items.add(file);

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });

    dropTarget.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
    dropTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    dropTarget.dispatchEvent(dropEvent);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert base64 data to a File object
 */
export function base64ToFile(base64: string, fileName: string, mimeType: string): File {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

/**
 * Extract text content from an element, preserving code blocks as fenced markdown
 */
export function extractTextWithCodeBlocks(container: HTMLElement): string {
  const parts: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Handle code blocks
    if (tag === 'pre') {
      const codeEl = el.querySelector('code');
      const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
      const code = (codeEl || el).textContent || '';
      parts.push(`\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n`);
      return;
    }

    // Handle inline code
    if (tag === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') {
      parts.push(`\`${el.textContent || ''}\``);
      return;
    }

    // Block elements get newlines
    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br'].includes(tag)) {
      parts.push('\n');
    }

    for (const child of node.childNodes) {
      walk(child);
    }

    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tag)) {
      parts.push('\n');
    }
  }

  walk(container);

  return parts.join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

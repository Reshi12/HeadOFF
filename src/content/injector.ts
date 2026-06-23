// ─── Injector (shared insert logic for content scripts) ──────
import type { SiteAdapter } from './adapters/SiteAdapter';
import { base64ToFile } from './adapters/SiteAdapter';

/**
 * Handle INSERT_INTO_INPUT messages from the background worker.
 * Called by each content script when the background wants to inject a thread.
 */
export async function handleInsertRequest(
  adapter: SiteAdapter,
  data: { text: string; attachments?: { fileName: string; base64Data: string; mimeType: string }[] }
): Promise<{ success: boolean; error?: string }> {
  const inputBox = adapter.findActiveInputBox();

  if (!inputBox) {
    return {
      success: false,
      error: `Could not find input box on ${adapter.siteId}. Try clicking into the chat input first.`,
    };
  }

  try {
    // Insert the formatted text
    adapter.insertText(inputBox, data.text);

    // Try to attach files
    if (data.attachments && data.attachments.length > 0) {
      for (const att of data.attachments) {
        const file = base64ToFile(att.base64Data, att.fileName, att.mimeType);
        const success = await adapter.insertAttachment(file);
        if (!success) {
          console.warn(`[Handoff] Could not attach file: ${att.fileName} — file content was included inline in the text instead.`);
        }
      }
    }

    // Scroll input into view and focus
    inputBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inputBox.focus();

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Background Service Worker (message router) ─────────────
import { v4 as uuidv4 } from 'uuid';
import {
  saveThread, getThread, getAllThreads, deleteThread, updateThread,
  searchThreads, exportAllThreads, importThreads, getStorageUsage,
} from './threadStore';
import { saveDraft, getAllDrafts, deleteDraft } from './draftStore';
import { structureTranscript, testApiKey } from './geminiClient';
import { setupAlarms, getSiteIdFromUrl, getActiveAITabs } from './alarms';
import type { ExtensionMessage, MessageResponse } from '../shared/messaging';
import type { Thread, Settings, DEFAULT_SETTINGS } from '../shared/types';
import { buildInjectText } from '../shared/promptTemplates';

// ─── Settings helpers ────────────────────────────────────────

async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return result.settings || {
    geminiApiKey: '',
    enabledSites: { chatgpt: true, claude: true, gemini: true },
    draftSnapshotIntervalMs: 60000,
    theme: 'system',
  };
}

async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

// ─── Message Router ──────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
);

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    // ── Thread CRUD ──────────────────────────────────────────
    case 'CAPTURE_REQUEST': {
      const { conversation, siteId, sourceUrl, title, tags } = message.data;
      const settings = await getSettings();

      // Create initial thread with raw transcript
      const thread: Thread = {
        id: uuidv4(),
        title: title || 'Untitled Thread',
        createdAt: Date.now(),
        sourceSite: siteId,
        sourceUrl,
        summary: '',
        goals: [],
        constraints: [],
        keyDecisions: [],
        openQuestions: [],
        glossary: [],
        rawTranscript: conversation.rawText,
        attachments: conversation.attachments || [],
        tags: tags || [],
        structuringStatus: 'pending',
      };

      // Save immediately (no data loss even if Gemini fails)
      await saveThread(thread);

      // Attempt Gemini structuring if API key is set
      if (settings.geminiApiKey) {
        try {
          const result = await structureTranscript(settings.geminiApiKey, conversation.rawText);
          if (result.structured) {
            const updatedThread = {
              ...thread,
              ...result.structured,
              // Preserve user-provided title if given
              title: title || result.structured.title || thread.title,
              tags: [...(tags || []), ...(result.structured.tags || [])].filter(
                (t, i, a) => a.indexOf(t) === i // dedupe
              ),
            };
            if (result.rawFallback) {
              updatedThread.rawFallback = result.rawFallback;
            }
            await saveThread(updatedThread);
            return { success: true, data: updatedThread };
          }
          if (result.error) {
            // Save with manual_only status but don't fail
            await updateThread({ id: thread.id, structuringStatus: 'manual_only' });
            return { success: true, data: { ...thread, structuringStatus: 'manual_only' } };
          }
        } catch {
          await updateThread({ id: thread.id, structuringStatus: 'manual_only' });
        }
      } else {
        await updateThread({ id: thread.id, structuringStatus: 'manual_only' });
      }

      return { success: true, data: thread };
    }

    case 'GET_THREADS': {
      const limit = message.data?.limit;
      const offset = message.data?.offset;
      const threads = await getAllThreads(limit, offset);
      return { success: true, data: threads };
    }

    case 'GET_THREAD': {
      const thread = await getThread(message.data.id);
      return thread
        ? { success: true, data: thread }
        : { success: false, error: 'Thread not found' };
    }

    case 'DELETE_THREAD': {
      await deleteThread(message.data.id);
      return { success: true };
    }

    case 'UPDATE_THREAD': {
      const updated = await updateThread(message.data.thread);
      return updated
        ? { success: true, data: updated }
        : { success: false, error: 'Thread not found' };
    }

    case 'SEARCH_THREADS': {
      const { query, siteFilter, tagFilter } = message.data;
      const results = await searchThreads(query, siteFilter, tagFilter);
      return { success: true, data: results };
    }

    // ── Inject ───────────────────────────────────────────────
    case 'INJECT_THREAD': {
      const { threadId, tabId } = message.data;
      const thread = await getThread(threadId);
      if (!thread) return { success: false, error: 'Thread not found' };

      const text = buildInjectText(thread);

      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'INSERT_INTO_INPUT',
          data: {
            text,
            attachments: thread.attachments.map(a => ({
              fileName: a.fileName,
              base64Data: a.base64Data,
              mimeType: a.mimeType,
            })),
          },
        } satisfies ExtensionMessage);
        return { success: true };
      } catch (e) {
        return { success: false, error: `Failed to inject: ${(e as Error).message}` };
      }
    }

    // ── Drafts ───────────────────────────────────────────────
    case 'GET_DRAFTS': {
      const drafts = await getAllDrafts();
      return { success: true, data: drafts };
    }

    case 'SAVE_DRAFT': {
      await saveDraft(message.data);
      return { success: true };
    }

    case 'DELETE_DRAFT': {
      await deleteDraft(message.data.tabId);
      return { success: true };
    }

    case 'PROMOTE_DRAFT': {
      const { tabId, title: draftTitle, tags: draftTags } = message.data;
      const drafts = await getAllDrafts();
      const draft = drafts.find(d => d.tabId === tabId);
      if (!draft) return { success: false, error: 'Draft not found' };

      // Promote to a capture request
      const captureMsg: ExtensionMessage = {
        type: 'CAPTURE_REQUEST',
        data: {
          conversation: {
            turns: [],
            rawText: draft.rawTranscriptSnapshot,
            attachments: [],
          },
          siteId: draft.siteId,
          sourceUrl: draft.sourceUrl,
          title: draftTitle,
          tags: draftTags,
        },
      };
      const result = await handleMessage(captureMsg, sender);
      if (result.success) {
        await deleteDraft(tabId);
      }
      return result;
    }

    // ── Settings ─────────────────────────────────────────────
    case 'GET_SETTINGS': {
      const settings = await getSettings();
      return { success: true, data: settings };
    }

    case 'SAVE_SETTINGS': {
      const settings = await saveSettings(message.data);
      // Update alarm interval if changed
      if (message.data.draftSnapshotIntervalMs) {
        setupAlarms(message.data.draftSnapshotIntervalMs);
      }
      return { success: true, data: settings };
    }

    case 'TEST_API_KEY': {
      const result = await testApiKey(message.data.apiKey);
      return { success: result.valid, error: result.error };
    }

    // ── Export/Import ────────────────────────────────────────
    case 'EXPORT_THREADS': {
      const threads = await exportAllThreads();
      return { success: true, data: threads };
    }

    case 'IMPORT_THREADS': {
      const count = await importThreads(message.data.threads);
      return { success: true, data: { imported: count } };
    }

    // ── Active Site Detection ────────────────────────────────
    case 'GET_ACTIVE_SITE': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const siteId = getSiteIdFromUrl(tab.url);
        return { success: true, data: { siteId, tabId: tab.id, url: tab.url } };
      }
      return { success: true, data: { siteId: null } };
    }

    // ── Storage Usage ────────────────────────────────────────
    case 'GET_STORAGE_USAGE': {
      const usage = await getStorageUsage();
      return { success: true, data: usage };
    }

    default:
      return { success: false, error: `Unknown message type: ${(message as any).type}` };
  }
}

// ─── Alarm Handler (draft snapshots) ─────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'handoff-draft-snapshot') return;

  const settings = await getSettings();
  const tabs = await getActiveAITabs();

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    const siteId = getSiteIdFromUrl(tab.url);
    if (!siteId || !settings.enabledSites[siteId]) continue;

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXTRACT_CONVERSATION',
      } satisfies ExtensionMessage);

      if (response?.success && response.data?.rawText) {
        await saveDraft({
          tabId: tab.id,
          siteId,
          lastSnapshotAt: Date.now(),
          rawTranscriptSnapshot: response.data.rawText,
          sourceUrl: tab.url,
        });
      }
    } catch {
      // Content script may not be loaded yet — silently skip
    }
  }
});

// ─── Extension Install/Startup ───────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  setupAlarms(settings.draftSnapshotIntervalMs);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  setupAlarms(settings.draftSnapshotIntervalMs);
});

console.log('[Handoff] Background service worker initialized');

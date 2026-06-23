// ─── Typed messaging contracts for chrome.runtime ────────────
import type { Thread, Draft, Settings, SiteId, ExtractedConversation } from './types';

// ─── Message Types ───────────────────────────────────────────
export type MessageType =
  | 'CAPTURE_REQUEST'
  | 'CAPTURE_RESULT'
  | 'GET_THREADS'
  | 'GET_THREAD'
  | 'DELETE_THREAD'
  | 'UPDATE_THREAD'
  | 'SEARCH_THREADS'
  | 'INJECT_THREAD'
  | 'GET_DRAFTS'
  | 'SAVE_DRAFT'
  | 'DELETE_DRAFT'
  | 'PROMOTE_DRAFT'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'TEST_API_KEY'
  | 'EXPORT_THREADS'
  | 'IMPORT_THREADS'
  | 'GET_ACTIVE_SITE'
  | 'EXTRACT_CONVERSATION'
  | 'INSERT_INTO_INPUT'
  | 'GET_STORAGE_USAGE';

// ─── Request Payloads ────────────────────────────────────────
export interface CaptureRequest {
  type: 'CAPTURE_REQUEST';
  data: {
    conversation: ExtractedConversation;
    siteId: SiteId;
    sourceUrl: string;
    title?: string;
    tags?: string[];
  };
}

export interface GetThreadsRequest {
  type: 'GET_THREADS';
  data?: { limit?: number; offset?: number };
}

export interface GetThreadRequest {
  type: 'GET_THREAD';
  data: { id: string };
}

export interface DeleteThreadRequest {
  type: 'DELETE_THREAD';
  data: { id: string };
}

export interface UpdateThreadRequest {
  type: 'UPDATE_THREAD';
  data: { thread: Partial<Thread> & { id: string } };
}

export interface SearchThreadsRequest {
  type: 'SEARCH_THREADS';
  data: { query: string; siteFilter?: SiteId; tagFilter?: string };
}

export interface InjectThreadRequest {
  type: 'INJECT_THREAD';
  data: { threadId: string; tabId: number };
}

export interface GetDraftsRequest {
  type: 'GET_DRAFTS';
}

export interface SaveDraftRequest {
  type: 'SAVE_DRAFT';
  data: Draft;
}

export interface DeleteDraftRequest {
  type: 'DELETE_DRAFT';
  data: { tabId: number };
}

export interface PromoteDraftRequest {
  type: 'PROMOTE_DRAFT';
  data: { tabId: number; title?: string; tags?: string[] };
}

export interface GetSettingsRequest {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsRequest {
  type: 'SAVE_SETTINGS';
  data: Partial<Settings>;
}

export interface TestApiKeyRequest {
  type: 'TEST_API_KEY';
  data: { apiKey: string };
}

export interface ExportThreadsRequest {
  type: 'EXPORT_THREADS';
}

export interface ImportThreadsRequest {
  type: 'IMPORT_THREADS';
  data: { threads: Thread[] };
}

export interface GetActiveSiteRequest {
  type: 'GET_ACTIVE_SITE';
}

export interface ExtractConversationRequest {
  type: 'EXTRACT_CONVERSATION';
}

export interface InsertIntoInputRequest {
  type: 'INSERT_INTO_INPUT';
  data: { text: string; attachments?: { fileName: string; base64Data: string; mimeType: string }[] };
}

export interface GetStorageUsageRequest {
  type: 'GET_STORAGE_USAGE';
}

export type ExtensionMessage =
  | CaptureRequest
  | GetThreadsRequest
  | GetThreadRequest
  | DeleteThreadRequest
  | UpdateThreadRequest
  | SearchThreadsRequest
  | InjectThreadRequest
  | GetDraftsRequest
  | SaveDraftRequest
  | DeleteDraftRequest
  | PromoteDraftRequest
  | GetSettingsRequest
  | SaveSettingsRequest
  | TestApiKeyRequest
  | ExportThreadsRequest
  | ImportThreadsRequest
  | GetActiveSiteRequest
  | ExtractConversationRequest
  | InsertIntoInputRequest
  | GetStorageUsageRequest;

// ─── Response wrapper ────────────────────────────────────────
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Helper to send typed messages ───────────────────────────
export function sendMessage<T = unknown>(message: ExtensionMessage): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message);
}

export function sendTabMessage<T = unknown>(tabId: number, message: ExtensionMessage): Promise<MessageResponse<T>> {
  return chrome.tabs.sendMessage(tabId, message);
}

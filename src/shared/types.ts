// ─── Site IDs ────────────────────────────────────────────────
export type SiteId = 'chatgpt' | 'claude' | 'gemini';

// ─── Thread (core data model) ────────────────────────────────
export interface Thread {
  id: string;
  title: string;
  createdAt: number;          // epoch ms
  sourceSite: SiteId;
  sourceUrl: string;

  // Structured fields (Gemini-generated)
  summary: string;
  goals: string[];
  constraints: string[];
  keyDecisions: string[];
  openQuestions: string[];
  glossary: GlossaryEntry[];

  // Full content
  rawTranscript: string;
  rawFallback?: string;       // populated if Gemini JSON parsing failed

  // Attachments
  attachments: ThreadAttachment[];

  // Metadata
  tags: string[];
  structuringStatus: StructuringStatus;
}

export type StructuringStatus = 'structured' | 'fallback_raw' | 'manual_only' | 'pending';

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface ThreadAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64Data: string;
  extractedText?: string;
}

// ─── Draft (local-only safety net) ───────────────────────────
export interface Draft {
  tabId: number;
  siteId: SiteId;
  lastSnapshotAt: number;
  rawTranscriptSnapshot: string;
  sourceUrl: string;
}

// ─── Settings ────────────────────────────────────────────────
export interface Settings {
  geminiApiKey: string;
  enabledSites: Record<SiteId, boolean>;
  draftSnapshotIntervalMs: number;
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: '',
  enabledSites: {
    chatgpt: true,
    claude: true,
    gemini: true,
  },
  draftSnapshotIntervalMs: 60000,
  theme: 'system',
};

// ─── Extracted Conversation (from site adapter) ──────────────
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks: CodeBlock[];
  attachmentHints: AttachmentHint[];
}

export interface CodeBlock {
  language: string;
  code: string;
}

export interface AttachmentHint {
  fileName: string;
  mimeType?: string;
  blobUrl?: string;
  thumbnailText?: string;
}

export interface ExtractedConversation {
  turns: ConversationTurn[];
  rawText: string;
  attachments: ThreadAttachment[];
}

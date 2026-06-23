// ─── Gemini API Client ───────────────────────────────────────
import { buildStructuringPrompt } from '../shared/promptTemplates';
import type { Thread } from '../shared/types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';

interface GeminiStructuredOutput {
  suggestedTitle: string;
  summary: string;
  goals: string[];
  constraints: string[];
  keyDecisions: string[];
  openQuestions: string[];
  glossary: { term: string; definition: string }[];
  suggestedTags: string[];
}

// Rate limit state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 4000; // ~15 RPM safety margin for free tier

export async function testApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with exactly: OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { valid: false, error: (err as any)?.error?.message || `HTTP ${res.status}` };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

export async function structureTranscript(
  apiKey: string,
  rawTranscript: string
): Promise<{
  structured?: Partial<Thread>;
  rawFallback?: string;
  error?: string;
}> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const prompt = buildStructuringPrompt(rawTranscript);

  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = (errBody as any)?.error?.message || `HTTP ${res.status}`;
      
      // Check for rate limit
      if (res.status === 429) {
        return { error: 'Rate limit hit. The thread was saved with raw transcript — structuring can be retried later.' };
      }
      
      return { error: errMsg };
    }

    const data = await res.json();
    const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawOutput) {
      return { error: 'Empty response from Gemini' };
    }

    // Try to parse JSON — strip markdown fences if present
    let jsonStr = rawOutput.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
      const parsed: GeminiStructuredOutput = JSON.parse(jsonStr);
      
      return {
        structured: {
          title: parsed.suggestedTitle || 'Untitled Thread',
          summary: parsed.summary || '',
          goals: parsed.goals || [],
          constraints: parsed.constraints || [],
          keyDecisions: parsed.keyDecisions || [],
          openQuestions: parsed.openQuestions || [],
          glossary: parsed.glossary || [],
          tags: parsed.suggestedTags || [],
          structuringStatus: 'structured',
        },
      };
    } catch {
      // JSON parse failed — save raw output as fallback
      return {
        rawFallback: rawOutput,
        structured: {
          structuringStatus: 'fallback_raw',
        },
      };
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ─── Gemini Structuring Prompt Template ──────────────────────

export const STRUCTURING_PROMPT = `You are a context-structuring assistant. You will be given a raw transcript of a conversation between a user and an AI assistant. Your job is to analyze it and output a structured JSON object.

IMPORTANT: Return ONLY valid JSON with no extra text, markdown fences, or commentary. The response must parse directly with JSON.parse().

The JSON must follow this exact schema:

{
  "suggestedTitle": "string — a concise, descriptive title for this conversation (5-10 words)",
  "summary": "string — 2-4 sentence overview of the conversation's purpose and outcomes",
  "goals": ["string array — the user's stated or implied goals"],
  "constraints": ["string array — any constraints, limitations, or requirements mentioned"],
  "keyDecisions": ["string array — important decisions made during the conversation"],
  "openQuestions": ["string array — unresolved questions or topics that need further exploration"],
  "glossary": [{"term": "string", "definition": "string"}],
  "suggestedTags": ["string array — 2-5 short descriptive tags for categorization"]
}

Rules:
- If a field has no relevant content, use an empty array [] or empty string "".
- Keep summaries concise but informative.
- Tags should be lowercase, single or two-word phrases.
- Glossary entries should only include domain-specific or project-specific terms, not common programming terms.
- Capture the essence of the conversation, not every detail.

Here is the conversation transcript:

---
{{TRANSCRIPT}}
---

Return the structured JSON now:`;

export function buildStructuringPrompt(transcript: string): string {
  return STRUCTURING_PROMPT.replace('{{TRANSCRIPT}}', transcript);
}

// ─── Inject format template ─────────────────────────────────

export function buildInjectText(thread: {
  title: string;
  summary: string;
  goals: string[];
  constraints: string[];
  keyDecisions: string[];
  openQuestions: string[];
  rawTranscript: string;
}): string {
  const sections: string[] = [];

  sections.push(`# Context from previous conversation: ${thread.title}\n`);

  if (thread.summary) {
    sections.push(`## Summary\n${thread.summary}\n`);
  }

  if (thread.goals.length > 0) {
    sections.push(`## Goals\n${thread.goals.map(g => `- ${g}`).join('\n')}\n`);
  }

  if (thread.constraints.length > 0) {
    sections.push(`## Constraints\n${thread.constraints.map(c => `- ${c}`).join('\n')}\n`);
  }

  if (thread.keyDecisions.length > 0) {
    sections.push(`## Key Decisions Made\n${thread.keyDecisions.map(d => `- ${d}`).join('\n')}\n`);
  }

  if (thread.openQuestions.length > 0) {
    sections.push(`## Open Questions\n${thread.openQuestions.map(q => `- ${q}`).join('\n')}\n`);
  }

  sections.push(`## Full Transcript\n\`\`\`\n${thread.rawTranscript}\n\`\`\``);

  return sections.join('\n');
}

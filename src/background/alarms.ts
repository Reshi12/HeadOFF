// ─── Draft Snapshot Alarms ───────────────────────────────────
import type { SiteId } from '../shared/types';

const ALARM_NAME = 'handoff-draft-snapshot';

const SUPPORTED_URL_PATTERNS: { site: SiteId; pattern: RegExp }[] = [
  { site: 'chatgpt', pattern: /^https:\/\/(chatgpt\.com|chat\.openai\.com)\// },
  { site: 'claude', pattern: /^https:\/\/claude\.ai\// },
  { site: 'gemini', pattern: /^https:\/\/gemini\.google\.com\// },
];

export function getSiteIdFromUrl(url: string): SiteId | null {
  for (const { site, pattern } of SUPPORTED_URL_PATTERNS) {
    if (pattern.test(url)) return site;
  }
  return null;
}

export function setupAlarms(intervalMs: number = 60000) {
  // MV3 alarms minimum is 1 minute (30 seconds in dev mode)
  const periodInMinutes = Math.max(intervalMs / 60000, 1);
  
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: periodInMinutes,
    periodInMinutes,
  });
}

export function clearAlarms() {
  chrome.alarms.clear(ALARM_NAME);
}

export async function getActiveAITabs(): Promise<chrome.tabs.Tab[]> {
  const tabs = await chrome.tabs.query({ status: 'complete' });
  return tabs.filter(tab => {
    if (!tab.url) return false;
    return getSiteIdFromUrl(tab.url) !== null;
  });
}

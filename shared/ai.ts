import OpenAI from 'openai';

export const MODEL = process.env.POE_MODEL || 'gpt5.1';

export function getAI(): OpenAI | null {
  const key = process.env.POE_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
  });
}

export type CoachPayload = {
  action: string;
  reasoning: string;
  businessAnalogy: string;
  equity: string;
  advice: string;
  outsInfo: string;
  lagPlay: string;
};

export function extractJsonBlock(text: string): string {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

export function tryParseCoachPayload(text: string): Partial<CoachPayload> | null {
  const jsonText = extractJsonBlock(text);
  for (const candidate of [jsonText, jsonText.replace(/,\s*}/g, '}')]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Try the next relaxed candidate.
    }
  }
  return null;
}

export function stripJsonNoise(text: string): string {
  return text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .replace(/[{}]/g, '')
    .replace(/"?(action|reasoning|businessAnalogy|equity|advice|outsInfo|lagPlay)"?\s*:/g, '')
    .replace(/^["']?\s*(Fold|Check|Call|Raise|All-?In)\s*["']?\s*,\s*/i, '')
    .replace(/^["']\s*/, '')
    .replace(/["']\s*$/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalAction(action: unknown): string {
  const raw = String(action || 'Check').toLowerCase();
  if (raw.includes('fold')) return 'Fold';
  if (raw.includes('raise') || raw.includes('bet')) return 'Raise';
  if (raw.includes('call')) return 'Call';
  if (raw.includes('all')) return 'Raise';
  return 'Check';
}

export function normalizeCoachPayload(raw: Partial<CoachPayload> | null, originalText = ''): CoachPayload {
  let payload = raw || {};
  if (typeof payload.reasoning === 'string' && payload.reasoning.trim().startsWith('{')) {
    payload = { ...payload, ...(tryParseCoachPayload(payload.reasoning) || {}) };
  }
  const fallbackReasoning = stripJsonNoise(originalText).slice(0, 420) || '这手牌需要看位置、赔率和对手范围，先别只盯着自己两张牌。';
  return {
    action: canonicalAction(payload.action),
    reasoning: stripJsonNoise(String(payload.reasoning || fallbackReasoning)),
    businessAnalogy: stripJsonNoise(String(payload.businessAnalogy || '像做生意一样，关键不是"有没有机会"，而是这笔投入能不能榨出足够回报。')),
    equity: stripJsonNoise(String(payload.equity || '粗估不明')),
    advice: stripJsonNoise(String(payload.advice || '先用小成本拿信息；如果对手下注尺度突然变重，就重新按赔率和范围算账。')),
    outsInfo: stripJsonNoise(String(payload.outsInfo || '')),
    lagPlay: stripJsonNoise(String(payload.lagPlay || '')),
  };
}

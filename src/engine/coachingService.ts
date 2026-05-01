/**
 * Coaching Service — 前端API调用层
 */

import { type Card, cardsToString, evaluateHand, calculateOuts, calculatePotOdds } from './poker';

export interface CoachingInsight {
  action: string;
  reasoning: string;
  businessAnalogy: string;
  equity: string;
  advice: string;
  outsInfo: string;
  // Local computed fields
  potOdds?: string;
  localOuts?: string;
}

function extractJsonBlock(text: string): string {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

function parseEmbeddedInsight(text: string): Partial<CoachingInsight> | null {
  try {
    const parsed = JSON.parse(extractJsonBlock(text));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function cleanJsonNoise(text: string): string {
  return text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .replace(/[{}]/g, '')
    .replace(/"?(action|reasoning|businessAnalogy|equity|advice|outsInfo)"?\s*:/g, '')
    .replace(/^["']?\s*(Fold|Check|Call|Raise|All-?In)\s*["']?\s*,\s*/i, '')
    .replace(/^["']\s*/, '')
    .replace(/["']\s*$/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalAction(action: unknown): string {
  const raw = String(action || 'Check').toLowerCase();
  if (raw.includes('fold')) return 'Fold';
  if (raw.includes('raise') || raw.includes('bet') || raw.includes('all')) return 'Raise';
  if (raw.includes('call')) return 'Call';
  return 'Check';
}

function normalizeInsightPayload(data: Partial<CoachingInsight>, fallbackReasoning: string): Partial<CoachingInsight> {
  let normalized = data || {};
  if (typeof normalized.reasoning === 'string' && normalized.reasoning.trim().startsWith('{')) {
    normalized = { ...normalized, ...(parseEmbeddedInsight(normalized.reasoning) || {}) };
  }
  for (const key of ['reasoning', 'businessAnalogy', 'advice', 'outsInfo'] as const) {
    const value = normalized[key];
    if (typeof value === 'string' && value.trim().startsWith('{')) {
      const parsed = parseEmbeddedInsight(value);
      if (parsed) normalized = { ...normalized, ...parsed };
      else normalized[key] = cleanJsonNoise(value);
    }
  }
  return {
    action: canonicalAction(normalized.action),
    reasoning: cleanJsonNoise(String(normalized.reasoning || fallbackReasoning)),
    businessAnalogy: cleanJsonNoise(String(normalized.businessAnalogy || '像做项目预算一样，核心是这笔投入能不能换回更高回报。')),
    equity: cleanJsonNoise(String(normalized.equity || '不确定')),
    advice: cleanJsonNoise(String(normalized.advice || '先看赔率，再看对手类型；能榨价值就下注，没弃牌率就少诈唬。')),
    outsInfo: cleanJsonNoise(String(normalized.outsInfo || '')),
  };
}

export async function getCoachingInsight(
  playerHand: Card[],
  communityCards: Card[],
  potSize: number,
  currentBet: number,
  playerStack: number,
  position: string,
  phase: string,
  opponents: number
): Promise<CoachingInsight> {
  // Calculate local data first
  const handEval = evaluateHand([...playerHand, ...communityCards]);
  const outsInfo = communityCards.length >= 3 ? calculateOuts(playerHand, communityCards) : null;
  const potOddsInfo = calculatePotOdds(potSize, currentBet);

  // 格式化手牌：明确标注同花/杂色
  const isSuited = playerHand.length === 2 && playerHand[0].suit === playerHand[1].suit;
  const isPair = playerHand.length === 2 && playerHand[0].rank === playerHand[1].rank;
  const handDesc = playerHand.length === 2
    ? `${cardsToString(playerHand)}（${isPair ? '口袋对子' : isSuited ? '同花' : '杂色'}）`
    : cardsToString(playerHand);

  try {
    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerHand: handDesc,
        communityCards: cardsToString(communityCards),
        potSize,
        currentBet,
        playerStack,
        position,
        handStrength: handEval.name,
        phase,
        opponents,
      })
    });
    
    const data = await response.json();
    const fallbackReasoning = `你现在是 ${handEval.name}。赔率就是这笔跟注买不买得起：${potOddsInfo.description}。${outsInfo?.description ? `Outs 是能改善牌力的补牌：${outsInfo.description}。` : '如果没有明显补牌，就重点看位置、对手类型和下注尺度。'}`;
    const normalized = normalizeInsightPayload(data, fallbackReasoning);
    return {
      ...normalized,
      potOdds: potOddsInfo.description,
      localOuts: outsInfo?.description || '',
    } as CoachingInsight;
  } catch (error) {
    console.error('Coaching fetch error:', error);
    return {
      action: 'Check',
      reasoning: `你现在是 ${handEval.name}。赔率是你花这笔跟注去争当前底池是否合算：${potOddsInfo.description}。${outsInfo?.description ? `Outs（能改善牌力的补牌）这边是：${outsInfo.description}。` : '目前没有特别清晰的补牌，重点看位置和对手下注尺度。'}`,
      businessAnalogy: '这有点像公司做项目预算：不是“项目小就砍掉”，而是看继续投入这一笔钱，能不能换来足够大的回报。',
      equity: '不确定',
      advice: currentBet > 0
        ? `如果跟注成本只占底池一小块，可以用小成本看下一张；如果对手突然下大注，就把它当成项目追加预算，先问回报率够不够。`
        : '没人要你付费时可以先过牌看信息；如果你有位置优势，也可以用小注试探，让对手告诉你一点范围。',
      outsInfo: outsInfo?.description || '',
      potOdds: potOddsInfo.description,
      localOuts: outsInfo?.description || '',
    };
  }
}

export async function getReview(
  handLog: string[],
  heroHand: string,
  communityCards: string,
  pot: number,
  result: string
): Promise<string> {
  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handLog: handLog.join('\n'),
        heroHand,
        communityCards,
        pot,
        result,
      })
    });
    const data = await response.json();
    return data.review || '复盘生成失败';
  } catch {
    return '复盘生成失败，请检查网络连接';
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Texas Hold'em Poker Engine — 完整的牌力评估系统
 * 支持7选5最佳牌型评估、Outs计算、起手牌胜率查表
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠'
};
export const SUIT_NAMES_CN: Record<Suit, string> = {
  hearts: '红心', diamonds: '方块', clubs: '梅花', spades: '黑桃'
};

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export enum HandRank {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9
}

export const HAND_RANK_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: '高牌',
  [HandRank.PAIR]: '一对',
  [HandRank.TWO_PAIR]: '两对',
  [HandRank.THREE_OF_A_KIND]: '三条',
  [HandRank.STRAIGHT]: '顺子',
  [HandRank.FLUSH]: '同花',
  [HandRank.FULL_HOUSE]: '葫芦',
  [HandRank.FOUR_OF_A_KIND]: '四条（金刚）',
  [HandRank.STRAIGHT_FLUSH]: '同花顺',
  [HandRank.ROYAL_FLUSH]: '皇家同花顺'
};

export interface HandEvaluation {
  rank: HandRank;
  score: number;
  name: string;
  bestCards: Card[];  // The best 5 cards
}

// ============================================================
// Deck Management
// ============================================================

export function createDeck(excludeCards: Card[] = []): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const isExcluded = excludeCards.some(ec => ec.suit === suit && ec.rank === rank);
      if (!isExcluded) {
        deck.push({ suit, rank });
      }
    }
  }
  return shuffle(deck);
}

export function shuffle(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function cardToString(card: Card): string {
  return `${SUIT_SYMBOLS[card.suit]}${card.rank}`;
}

export function cardsToString(cards: Card[]): string {
  return cards.map(cardToString).join(' ');
}

// ============================================================
// 7-card → best 5-card evaluation (C(7,5) = 21 combinations)
// ============================================================

function getCombinations(arr: Card[], k: number): Card[][] {
  const result: Card[][] = [];
  function backtrack(start: number, current: Card[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

/**
 * Evaluate the best possible 5-card hand from any number of cards (up to 7).
 * Uses brute-force C(n,5) combination approach.
 */
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length < 2) {
    return { rank: HandRank.HIGH_CARD, score: 0, name: '等待发牌', bestCards: [] };
  }
  
  if (cards.length < 5) {
    // Pre-flop or early: evaluate what we have
    return evaluatePartialHand(cards);
  }
  
  // Get all C(n, 5) combinations
  const combos = getCombinations(cards, 5);
  let bestEval: HandEvaluation | null = null;
  
  for (const combo of combos) {
    const ev = evaluate5Cards(combo);
    if (!bestEval || ev.score > bestEval.score) {
      bestEval = ev;
    }
  }
  
  return bestEval!;
}

/**
 * Evaluate partial hands (2-4 cards) for pre-flop display
 */
function evaluatePartialHand(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const counts: Record<string, number> = {};
  sorted.forEach(c => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
  
  const maxCount = Math.max(...Object.values(counts));
  
  if (maxCount >= 2) {
    const pairRank = Object.entries(counts).find(([, v]) => v >= 2)![0];
    return {
      rank: HandRank.PAIR,
      score: 100 + RANK_VALUE[pairRank as Rank],
      name: `一对 ${pairRank}`,
      bestCards: sorted
    };
  }
  
  return {
    rank: HandRank.HIGH_CARD,
    score: RANK_VALUE[sorted[0].rank],
    name: `高牌 ${sorted[0].rank}`,
    bestCards: sorted
  };
}

/**
 * Core 5-card hand evaluator with precise scoring for tie-breaking.
 * Score format: HandRank * 10^10 + kicker scores
 */
function evaluate5Cards(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  
  // Count ranks and suits
  const rankCounts: Record<string, number> = {};
  const suitCounts: Record<string, number> = {};
  const suitCards: Record<string, Card[]> = {};
  
  sorted.forEach(c => {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    if (!suitCards[c.suit]) suitCards[c.suit] = [];
    suitCards[c.suit].push(c);
  });
  
  // Check flush (all 5 cards same suit)
  const isFlush = Object.values(suitCounts).some(c => c === 5);
  
  // Check straight
  const values = sorted.map(c => RANK_VALUE[c.rank]);
  let isStraight = false;
  let straightHigh = 0;
  
  // Normal straight check
  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Wheel (A-2-3-4-5)
  if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5; // Ace plays low
  }
  
  // Group by count for pattern detection
  const groups = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank: rank as Rank, count, value: RANK_VALUE[rank as Rank] }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  
  // Calculate kicker score (for tie-breaking)
  const kickerScore = (vals: number[]): number => {
    let score = 0;
    for (let i = 0; i < vals.length && i < 5; i++) {
      score += vals[i] * Math.pow(15, 4 - i);
    }
    return score;
  };
  
  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return {
      rank: HandRank.ROYAL_FLUSH,
      score: 9e10 + straightHigh,
      name: '皇家同花顺',
      bestCards: sorted
    };
  }
  
  // Straight Flush
  if (isFlush && isStraight) {
    return {
      rank: HandRank.STRAIGHT_FLUSH,
      score: 8e10 + straightHigh,
      name: `同花顺 (${straightHigh}高)`,
      bestCards: sorted
    };
  }
  
  // Four of a Kind
  if (groups[0].count === 4) {
    const quadVal = groups[0].value;
    const kicker = groups[1].value;
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      score: 7e10 + quadVal * 15 + kicker,
      name: `四条 ${groups[0].rank}`,
      bestCards: sorted
    };
  }
  
  // Full House
  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      rank: HandRank.FULL_HOUSE,
      score: 6e10 + groups[0].value * 15 + groups[1].value,
      name: `葫芦 (${groups[0].rank}满${groups[1].rank})`,
      bestCards: sorted
    };
  }
  
  // Flush
  if (isFlush) {
    return {
      rank: HandRank.FLUSH,
      score: 5e10 + kickerScore(values),
      name: `同花 (${sorted[0].rank}高)`,
      bestCards: sorted
    };
  }
  
  // Straight
  if (isStraight) {
    return {
      rank: HandRank.STRAIGHT,
      score: 4e10 + straightHigh,
      name: `顺子 (${straightHigh === 5 ? '5' : sorted[0].rank}高)`,
      bestCards: sorted
    };
  }
  
  // Three of a Kind
  if (groups[0].count === 3) {
    const kickers = groups.filter(g => g.count !== 3).map(g => g.value);
    return {
      rank: HandRank.THREE_OF_A_KIND,
      score: 3e10 + groups[0].value * 225 + kickerScore(kickers),
      name: `三条 ${groups[0].rank}`,
      bestCards: sorted
    };
  }
  
  // Two Pair
  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].value, groups[1].value);
    const lowPair = Math.min(groups[0].value, groups[1].value);
    const kicker = groups[2].value;
    return {
      rank: HandRank.TWO_PAIR,
      score: 2e10 + highPair * 225 + lowPair * 15 + kicker,
      name: `两对 (${RANKS[highPair - 2]}和${RANKS[lowPair - 2]})`,
      bestCards: sorted
    };
  }
  
  // One Pair
  if (groups[0].count === 2) {
    const kickers = groups.filter(g => g.count !== 2).map(g => g.value);
    return {
      rank: HandRank.PAIR,
      score: 1e10 + groups[0].value * 3375 + kickerScore(kickers),
      name: `一对 ${groups[0].rank}`,
      bestCards: sorted
    };
  }
  
  // High Card
  return {
    rank: HandRank.HIGH_CARD,
    score: kickerScore(values),
    name: `高牌 ${sorted[0].rank}`,
    bestCards: sorted
  };
}

// ============================================================
// Outs Calculation
// ============================================================

export interface OutsInfo {
  flushOuts: number;
  straightOuts: number;
  totalOuts: number;
  turnOdds: number;   // probability to hit on turn
  riverOdds: number;  // probability to hit on river
  turnAndRiver: number; // probability to hit by river (from flop)
  description: string;
}

export function calculateOuts(holeCards: Card[], communityCards: Card[]): OutsInfo {
  const allCards = [...holeCards, ...communityCards];
  if (communityCards.length < 3) {
    return { flushOuts: 0, straightOuts: 0, totalOuts: 0, turnOdds: 0, riverOdds: 0, turnAndRiver: 0, description: '翻牌前无需计算Outs' };
  }
  
  const currentEval = evaluateHand(allCards);
  const usedCards = new Set(allCards.map(c => `${c.suit}-${c.rank}`));
  const remainingDeck: Card[] = [];
  
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      if (!usedCards.has(`${suit}-${rank}`)) {
        remainingDeck.push({ suit, rank });
      }
    }
  }
  
  // Count how many remaining cards improve the hand
  let improvingCards = 0;
  let flushOuts = 0;
  let straightOuts = 0;
  const outsSet = new Set<string>();
  
  for (const card of remainingDeck) {
    const newHand = [...allCards, card];
    const newEval = evaluateHand(newHand);
    if (newEval.score > currentEval.score && newEval.rank > currentEval.rank) {
      const key = `${card.suit}-${card.rank}`;
      if (!outsSet.has(key)) {
        outsSet.add(key);
        improvingCards++;
        
        // Categorize
        if (newEval.rank === HandRank.FLUSH || newEval.rank === HandRank.STRAIGHT_FLUSH) {
          flushOuts++;
        }
        if (newEval.rank === HandRank.STRAIGHT) {
          straightOuts++;
        }
      }
    }
  }
  
  const remaining = remainingDeck.length;
  const turnOdds = remaining > 0 ? (improvingCards / remaining) * 100 : 0;
  const riverOdds = remaining > 1 ? (improvingCards / (remaining - 1)) * 100 : 0;
  const turnAndRiver = remaining > 1 ? (1 - ((remaining - improvingCards) / remaining) * ((remaining - 1 - improvingCards) / (remaining - 1))) * 100 : 0;
  
  let description = '';
  if (flushOuts > 0 && straightOuts > 0) description = `同花听牌(${flushOuts}张) + 顺子听牌(${straightOuts}张)`;
  else if (flushOuts > 0) description = `同花听牌 (${flushOuts}张outs)`;
  else if (straightOuts > 0) description = `顺子听牌 (${straightOuts}张outs)`;
  else if (improvingCards > 0) description = `${improvingCards}张outs可改善牌力`;
  else description = '当前无明显听牌';
  
  return {
    flushOuts,
    straightOuts,
    totalOuts: improvingCards,
    turnOdds: Math.round(turnOdds * 10) / 10,
    riverOdds: Math.round(riverOdds * 10) / 10,
    turnAndRiver: Math.round(turnAndRiver * 10) / 10,
    description
  };
}

// ============================================================
// Pre-flop Hand Strength (simplified Chen formula approximation)
// ============================================================

export function getPreFlopStrength(card1: Card, card2: Card): { tier: string; strength: number; description: string } {
  const v1 = RANK_VALUE[card1.rank];
  const v2 = RANK_VALUE[card2.rank];
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  const isPair = v1 === v2;
  const isSuited = card1.suit === card2.suit;
  const gap = high - low;
  
  let score = 0;
  
  // Base score from high card
  if (high === 14) score = 10;
  else if (high === 13) score = 8;
  else if (high === 12) score = 7;
  else if (high === 11) score = 6;
  else score = high / 2;
  
  // Pair bonus
  if (isPair) {
    score = Math.max(score * 2, 5);
  }
  
  // Suited bonus
  if (isSuited) score += 2;
  
  // Gap penalty
  if (gap === 1 || gap === 0) score += 1;
  else if (gap === 2) score -= 1;
  else if (gap === 3) score -= 2;
  else if (gap === 4) score -= 4;
  else score -= 5;
  
  // Round
  score = Math.max(0, Math.round(score * 10) / 10);
  
  let tier: string;
  let description: string;
  
  if (score >= 16) { tier = 'S级 (超强)'; description = '任何位置都应加注'; }
  else if (score >= 12) { tier = 'A级 (强牌)'; description = '大部分位置可加注入池'; }
  else if (score >= 9) { tier = 'B级 (中等)'; description = '中后位可入池，前位谨慎'; }
  else if (score >= 6) { tier = 'C级 (投机)'; description = '后位多人底池可入池'; }
  else { tier = 'D级 (弱牌)'; description = '除非在大盲位免费看牌，否则弃牌'; }
  
  return { tier, strength: score, description };
}

// ============================================================
// Pot Odds Calculation
// ============================================================

export function calculatePotOdds(potSize: number, callAmount: number): {
  potOdds: number;
  breakEvenEquity: number;
  description: string;
} {
  if (callAmount <= 0) {
    return { potOdds: 0, breakEvenEquity: 0, description: '无需跟注，免费看牌' };
  }
  
  const potOdds = callAmount / (potSize + callAmount);
  const breakEvenEquity = potOdds * 100;
  
  return {
    potOdds: Math.round(potOdds * 1000) / 10,
    breakEvenEquity: Math.round(breakEvenEquity * 10) / 10,
    description: `需要 ${Math.round(breakEvenEquity)}% 胜率才能盈利跟注`
  };
}

// ============================================================
// Draw Analysis — 听牌分析
// ============================================================

export interface DrawInfo {
  type: 'flush-draw' | 'oesd' | 'gutshot' | 'backdoor-flush' | 'backdoor-straight' | 'set-draw';
  name: string;
  outs: number;
  description: string;
}

/**
 * Analyze what draws a player currently has.
 * Works on flop (3 community) and turn (4 community).
 */
export function analyzeDraws(holeCards: Card[], communityCards: Card[]): DrawInfo[] {
  if (communityCards.length < 3) return [];
  const allCards = [...holeCards, ...communityCards];
  const draws: DrawInfo[] = [];

  // --- Flush draw analysis ---
  const suitCounts: Record<string, number> = {};
  allCards.forEach(c => { suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
  
  for (const [suit, count] of Object.entries(suitCounts)) {
    const heroInSuit = holeCards.filter(c => c.suit === suit).length;
    if (heroInSuit === 0) continue; // only count draws involving hero cards
    
    if (count === 4) {
      // Flush draw: need 1 more of this suit
      const remaining = 13 - count;
      const suitName = SUIT_NAMES_CN[suit as Suit];
      draws.push({
        type: 'flush-draw',
        name: `${suitName}同花听牌`,
        outs: remaining > 0 ? 9 : 0, // standard 9 outs for flush draw
        description: `还差1张${suitName}就成同花`
      });
    } else if (count === 3 && communityCards.length === 3) {
      // Backdoor flush draw (only meaningful on flop)
      const suitName = SUIT_NAMES_CN[suit as Suit];
      draws.push({
        type: 'backdoor-flush',
        name: `后门${suitName}同花`,
        outs: 0,
        description: `转牌河牌都来${suitName}才能成同花`
      });
    }
  }

  // --- Straight draw analysis ---
  const uniqueValues = [...new Set(allCards.map(c => RANK_VALUE[c.rank]))].sort((a, b) => a - b);
  // Add low ace (1) if ace exists
  if (uniqueValues.includes(14)) {
    uniqueValues.unshift(1);
  }

  // Check for OESD (open-ended straight draw) and gutshot
  let hasOESD = false;
  let hasGutshot = false;

  // Slide a window of 5 across all possible straight ranges
  for (let bottom = 1; bottom <= 10; bottom++) {
    const top = bottom + 4;
    const needed: number[] = [];
    for (let v = bottom; v <= top; v++) {
      if (!uniqueValues.includes(v)) needed.push(v);
    }
    
    if (needed.length === 1) {
      // One card missing — could be OESD or gutshot
      const missing = needed[0];
      // OESD: missing card is at either end
      if (missing === bottom || missing === top) {
        if (!hasOESD) {
          hasOESD = true;
          const rankName = RANKS[missing - 2] || 'A';
          draws.push({
            type: 'oesd',
            name: '两头顺子听牌',
            outs: 8,
            description: `两头听顺，${rankName}或另一端来都成顺`
          });
        }
      } else {
        if (!hasGutshot && !hasOESD) {
          hasGutshot = true;
          const rankName = missing <= 1 ? 'A' : RANKS[missing - 2];
          draws.push({
            type: 'gutshot',
            name: '卡顺听牌',
            outs: 4,
            description: `卡顺听牌，需要${rankName}来成顺`
          });
        }
      }
    }
  }

  return draws;
}

// ============================================================
// Hand Contributing Cards — 找出组成最佳牌型的牌
// ============================================================

export interface HandContribution {
  holeUsed: [boolean, boolean];   // which hole cards are part of best hand
  communityUsed: boolean[];       // which community cards are part of best hand
  bestCards: Card[];
  rank: HandRank;
  name: string;
}

/**
 * Determine which hole cards and community cards contribute to the best 5-card hand.
 */
export function getHandContribution(holeCards: Card[], communityCards: Card[]): HandContribution {
  const allCards = [...holeCards, ...communityCards];
  
  if (allCards.length < 5) {
    return {
      holeUsed: [true, true],
      communityUsed: communityCards.map(() => false),
      bestCards: allCards,
      rank: HandRank.HIGH_CARD,
      name: '等待更多牌'
    };
  }

  const eval_ = evaluateHand(allCards);
  const bestSet = new Set(eval_.bestCards.map(c => `${c.suit}-${c.rank}`));
  
  const holeUsed: [boolean, boolean] = [
    holeCards.length > 0 ? bestSet.has(`${holeCards[0].suit}-${holeCards[0].rank}`) : false,
    holeCards.length > 1 ? bestSet.has(`${holeCards[1].suit}-${holeCards[1].rank}`) : false,
  ];
  
  const communityUsed = communityCards.map(c => bestSet.has(`${c.suit}-${c.rank}`));

  return {
    holeUsed,
    communityUsed,
    bestCards: eval_.bestCards,
    rank: eval_.rank,
    name: eval_.name,
  };
}

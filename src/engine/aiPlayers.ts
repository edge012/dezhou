/**
 * AI Player Personalities — 四种经典AI对手策略系统
 * 每种AI具有独特的决策风格和下注模式
 */

import { type Card, evaluateHand, HandRank, RANK_VALUE, getPreFlopStrength } from './poker';
import { type GameState, type ActionType, getCallAmount } from './gameEngine';

export interface AIDecision {
  action: ActionType;
  raiseAmount?: number;
  reasoning: string;
}

// ============================================================
// 起手牌评估 (Pre-flop hand strength 0-1)
// ============================================================

function preFlopHandStrength(cards: Card[]): number {
  if (cards.length < 2) return 0;
  const s = getPreFlopStrength(cards[0], cards[1]);
  return Math.min(1, s.strength / 20);
}

// ============================================================
// 翻后牌力评估 (Post-flop relative strength 0-1)
// ============================================================

function postFlopStrength(holeCards: Card[], communityCards: Card[]): number {
  const allCards = [...holeCards, ...communityCards];
  const eval_ = evaluateHand(allCards);
  const rankMap: Record<number, [number, number]> = {
    [HandRank.HIGH_CARD]: [0, 0.1],
    [HandRank.PAIR]: [0.1, 0.28],
    [HandRank.TWO_PAIR]: [0.28, 0.42],
    [HandRank.THREE_OF_A_KIND]: [0.42, 0.58],
    [HandRank.STRAIGHT]: [0.58, 0.68],
    [HandRank.FLUSH]: [0.68, 0.78],
    [HandRank.FULL_HOUSE]: [0.78, 0.88],
    [HandRank.FOUR_OF_A_KIND]: [0.88, 0.95],
    [HandRank.STRAIGHT_FLUSH]: [0.95, 0.99],
    [HandRank.ROYAL_FLUSH]: [0.99, 1.0],
  };
  const [low, high] = rankMap[eval_.rank] || [0, 0.1];
  const kickerFactor = Math.min(1, (eval_.score % 1e10) / 1e9);
  return low + (high - low) * kickerFactor;
}

// ============================================================
// Helper: Calculate a raise amount relative to pot
// ============================================================

function calcRaise(pot: number, currentBet: number, minRaise: number, stack: number, fraction: number): number {
  const target = Math.max(currentBet + minRaise, currentBet + Math.floor(pot * fraction));
  return Math.min(target, stack + currentBet); // can't raise more than stack
}

// ============================================================
// AI Decision Engine
// ============================================================

export function getAIDecision(state: GameState, playerIdx: number): AIDecision {
  const player = state.players[playerIdx];
  const personality = player.personality || 'balanced';
  const callCost = getCallAmount(state, playerIdx);
  const potSize = state.pot;
  const stack = player.stack;
  const isPreFlop = state.phase === 'pre-flop';
  const currentBet = state.currentBet;
  const minRaise = state.minRaise;

  // Calculate hand strength
  const strength = isPreFlop
    ? preFlopHandStrength(player.cards)
    : postFlopStrength(player.cards, state.communityCards);

  // Pot odds
  const potOdds = callCost > 0 ? callCost / (potSize + callCost) : 0;

  // Effective stack ratio
  const mRatio = stack / (state.smallBlind + state.bigBlind);

  const rng = Math.random();

  switch (personality) {
    case 'rock':       return rockStrategy(strength, callCost, potSize, stack, potOdds, isPreFlop, mRatio, rng, currentBet, minRaise);
    case 'calling':    return callingStationStrategy(strength, callCost, potSize, stack, potOdds, isPreFlop, mRatio, rng, currentBet, minRaise);
    case 'aggressive': return aggressiveStrategy(strength, callCost, potSize, stack, potOdds, isPreFlop, mRatio, rng, currentBet, minRaise);
    case 'pro':        return proStrategy(strength, callCost, potSize, stack, potOdds, isPreFlop, mRatio, rng, currentBet, minRaise);
    default:           return proStrategy(strength, callCost, potSize, stack, potOdds, isPreFlop, mRatio, rng, currentBet, minRaise);
  }
}

// ============================================================
// 1. 岩石玩家 (Nit/Rock) — 极其保守
// ============================================================

function rockStrategy(str: number, call: number, pot: number, stack: number, potOdds: number, preFlop: boolean, m: number, rng: number, currentBet: number, minRaise: number): AIDecision {
  if (preFlop) {
    if (str < 0.4) {
      if (call > 0) return { action: 'fold', reasoning: '牌力不足，保守弃牌' };
      return { action: 'check', reasoning: '免费看牌' };
    }
    if (str >= 0.7 && rng < 0.7) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.6);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '强牌，建立底池' };
    }
    if (call <= stack * 0.1) return { action: 'call', reasoning: '跟注看翻牌' };
    return { action: 'fold', reasoning: '面对大注弃牌保全筹码' };
  }

  // Post-flop
  if (str < 0.15) {
    if (call > 0) return { action: 'fold', reasoning: '牌力极弱，果断弃牌' };
    return { action: 'check', reasoning: '牌力弱，过牌观望' };
  }
  if (str >= 0.5) {
    if (rng < 0.5) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.5);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '强牌价值下注' };
    }
    if (call > 0) return { action: 'call', reasoning: '强牌跟注' };
    return { action: 'check', reasoning: '过牌' };
  }
  if (str >= 0.25 && call === 0) return { action: 'check', reasoning: '过牌等待' };
  if (call > pot * 0.5) return { action: 'fold', reasoning: '面对半池以上下注弃牌' };
  if (call > 0 && str >= 0.2) return { action: 'call', reasoning: '跟注看牌' };
  if (call > 0) return { action: 'fold', reasoning: '牌力不够弃牌' };
  return { action: 'check', reasoning: '过牌' };
}

// ============================================================
// 2. 跟注站 (Calling Station) — 极少弃牌和加注
// ============================================================

function callingStationStrategy(str: number, call: number, pot: number, stack: number, potOdds: number, preFlop: boolean, m: number, rng: number, currentBet: number, minRaise: number): AIDecision {
  if (preFlop) {
    if (call > stack * 0.4 && str < 0.3) return { action: 'fold', reasoning: '下注量太大了' };
    if (str >= 0.8 && rng < 0.3) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.4);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '偶尔加注' };
    }
    if (call > 0) return { action: 'call', reasoning: '想看看翻牌' };
    return { action: 'check', reasoning: '过牌' };
  }

  // Post-flop: almost never fold, rarely raise
  if (str >= 0.6 && rng < 0.25) {
    const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.4);
    return { action: 'raise', raiseAmount: raiseAmt, reasoning: '难得加注' };
  }
  if (call > stack * 0.6 && str < 0.1) {
    return { action: 'fold', reasoning: '实在跟不起了' };
  }
  if (call > 0) return { action: 'call', reasoning: '继续跟注看看' };
  if (str >= 0.3 && rng < 0.3) {
    const betAmt = calcRaise(pot, currentBet, minRaise, stack, 0.35);
    return { action: 'raise', raiseAmount: betAmt, reasoning: '偶尔主动下注' };
  }
  return { action: 'check', reasoning: '过牌' };
}

// ============================================================
// 3. 激进派 (LAG - Loose Aggressive)
// ============================================================

function aggressiveStrategy(str: number, call: number, pot: number, stack: number, potOdds: number, preFlop: boolean, m: number, rng: number, currentBet: number, minRaise: number): AIDecision {
  if (preFlop) {
    if (str >= 0.25 && rng < 0.6) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.8);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '激进加注施压' };
    }
    if (str < 0.25 && rng < 0.2) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.5);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '诈唬加注' };
    }
    if (call > stack * 0.5 && str < 0.3) return { action: 'fold', reasoning: '被反加注太大，退出' };
    if (call > 0) return { action: 'call', reasoning: '跟注入池' };
    return { action: 'check', reasoning: '过牌' };
  }

  // Post-flop
  if (call === 0) {
    if (rng < 0.65) {
      const betAmt = calcRaise(pot, currentBet, minRaise, stack, 0.5 + rng * 0.4);
      return { action: 'raise', raiseAmount: betAmt, reasoning: str > 0.3 ? '价值下注' : '诈唬下注' };
    }
    return { action: 'check', reasoning: '偶尔过牌陷阱' };
  }

  // Facing a bet
  if (str >= 0.4) {
    if (rng < 0.5) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.7);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '反加注施压' };
    }
    return { action: 'call', reasoning: '跟注' };
  }
  if (rng < 0.15 && call < stack * 0.3) {
    const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.8);
    return { action: 'raise', raiseAmount: raiseAmt, reasoning: '诈唬反加注' };
  }
  if (str >= 0.15 && call < stack * 0.25) return { action: 'call', reasoning: '小注跟注' };
  if (str < 0.12) return { action: 'fold', reasoning: '牌太弱弃牌' };
  if (call < stack * 0.2) return { action: 'call', reasoning: '跟注观察' };
  return { action: 'fold', reasoning: '下注太大弃牌' };
}

// ============================================================
// 4. 职业玩家 (TAG - Tight Aggressive / GTO-ish)
// ============================================================

function proStrategy(str: number, call: number, pot: number, stack: number, potOdds: number, preFlop: boolean, m: number, rng: number, currentBet: number, minRaise: number): AIDecision {
  if (preFlop) {
    if (str >= 0.55) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.5);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '强牌标准加注' };
    }
    if (str >= 0.3 && call <= currentBet * 1.5) {
      if (rng < 0.4) {
        const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.45);
        return { action: 'raise', raiseAmount: raiseAmt, reasoning: '位置加注' };
      }
      if (call > 0) return { action: 'call', reasoning: '合理入池' };
      return { action: 'check', reasoning: '过牌' };
    }
    if (call > currentBet && str < 0.4) return { action: 'fold', reasoning: '面对大注牌力不足弃牌' };
    if (call > 0 && str < 0.2) return { action: 'fold', reasoning: '弱牌弃牌' };
    if (call > 0) return { action: 'call', reasoning: '跟注观察' };
    return { action: 'check', reasoning: '过牌' };
  }

  // Post-flop GTO-ish play
  const evPositive = str > potOdds + 0.05;

  if (call === 0) {
    if (str >= 0.4) {
      const betSize = calcRaise(pot, currentBet, minRaise, stack, 0.5 + str * 0.3);
      return { action: 'raise', raiseAmount: betSize, reasoning: '价值下注' };
    }
    if (rng < 0.12) {
      const betSize = calcRaise(pot, currentBet, minRaise, stack, 0.45);
      return { action: 'raise', raiseAmount: betSize, reasoning: '平衡性诈唬' };
    }
    return { action: 'check', reasoning: '过牌等待信息' };
  }

  // Facing a bet
  if (str >= 0.6) {
    if (rng < 0.45) {
      const raiseAmt = calcRaise(pot, currentBet, minRaise, stack, 0.65);
      return { action: 'raise', raiseAmount: raiseAmt, reasoning: '强牌反加注' };
    }
    return { action: 'call', reasoning: '强牌跟注（慢打）' };
  }

  if (evPositive) {
    return { action: 'call', reasoning: `赔率合适(需${Math.round(potOdds * 100)}%胜率)，跟注` };
  }

  if (str >= 0.25 && call < pot * 0.3) {
    return { action: 'call', reasoning: '小注跟注看牌' };
  }

  return { action: 'fold', reasoning: '赔率不合适，纪律性弃牌' };
}

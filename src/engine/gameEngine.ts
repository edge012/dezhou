/**
 * Game Engine — 完整的德州扑克状态机
 * 管理下注轮、边池、盲注轮转、结算
 */

import { type Card, type HandEvaluation, type DrawInfo, type HandContribution, HandRank, createDeck, evaluateHand, cardToString, analyzeDraws, getHandContribution } from './poker';

export type GamePhase = 'idle' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PlayerType = 'human' | 'ai';
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  stack: number;
  bet: number;          // current round bet
  totalBet: number;     // total bet this hand (for side pot calc)
  cards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  seatIndex: number;
  personality?: string;
  hasActed: boolean;
  isEliminated?: boolean;
}

export interface SidePot {
  amount: number;
  eligible: string[];   // player ids eligible for this pot
}

export interface LogEntry {
  msg: string;
  phase: GamePhase;
  type: 'system' | 'action' | 'result' | 'hand-update';
}

export interface PlayerHandInfo {
  playerId: string;
  rank: HandRank;
  name: string;
  bestCards: Card[];
  holeUsed: [boolean, boolean];
  communityUsed: boolean[];
  draws: DrawInfo[];
}

export interface GameState {
  players: Player[];
  deck: Card[];
  communityCards: Card[];
  phase: GamePhase;
  pot: number;
  sidePots: SidePot[];
  currentBet: number;       // highest bet this round
  minRaise: number;          // minimum raise increment
  dealerIdx: number;         // BTN position index
  currentTurnIdx: number;
  lastRaiserIdx: number;
  handLog: LogEntry[];
  roundNum: number;
  smallBlind: number;
  bigBlind: number;
  winners: { playerId: string; amount: number; handName: string }[];
  isHandComplete: boolean;
  tableMode: 'cash' | 'tournament';
  buyIn: number;
  allowRebuy: boolean;
  blindLevel: number;
  handsPerLevel: number;
  isSessionComplete: boolean;
  // Runout mode (all-in board reveal)
  isRunout: boolean;
  showAllCards: boolean;     // whether to reveal all players' hole cards
  playerHandInfos: PlayerHandInfo[];
}

const POSITIONS_5P = ['BTN', 'SB', 'BB', 'UTG', 'CO'];

function getPositionLabel(seatIdx: number, dealerIdx: number, totalPlayers: number): string {
  const offset = (seatIdx - dealerIdx + totalPlayers) % totalPlayers;
  return POSITIONS_5P[offset] || `P${offset}`;
}

// ============================================================
// Create initial game state
// ============================================================

export interface GameOptions {
  tableMode?: 'cash' | 'tournament';
  buyIn?: number;
  smallBlind?: number;
  bigBlind?: number;
  allowRebuy?: boolean;
  handsPerLevel?: number;
}

export function createInitialState(
  playerNames: { name: string; type: PlayerType; personality?: string }[],
  startStack = 1000,
  options: GameOptions = {}
): GameState {
  const players: Player[] = playerNames.map((p, i) => ({
    id: `p${i}`,
    name: p.name,
    type: p.type,
    stack: startStack,
    bet: 0,
    totalBet: 0,
    cards: [],
    isFolded: false,
    isAllIn: false,
    seatIndex: i,
    personality: p.personality,
    hasActed: false,
    isEliminated: false,
  }));

  return {
    players,
    deck: [],
    communityCards: [],
    phase: 'idle',
    pot: 0,
    sidePots: [],
    currentBet: 0,
    minRaise: options.bigBlind ?? 20,
    dealerIdx: 0,
    currentTurnIdx: 0,
    lastRaiserIdx: -1,
    handLog: [],
    roundNum: 0,
    smallBlind: options.smallBlind ?? 10,
    bigBlind: options.bigBlind ?? 20,
    winners: [],
    isHandComplete: false,
    tableMode: options.tableMode ?? 'cash',
    buyIn: options.buyIn ?? startStack,
    allowRebuy: options.allowRebuy ?? true,
    blindLevel: 1,
    handsPerLevel: options.handsPerLevel ?? 6,
    isSessionComplete: false,
    isRunout: false,
    showAllCards: false,
    playerHandInfos: [],
  };
}

// ============================================================
// Deal a new hand
// ============================================================

export function dealNewHand(state: GameState): GameState {
  const s = deepCopy(state);
  s.roundNum++;
  s.isHandComplete = false;
  s.isSessionComplete = false;
  s.winners = [];
  s.communityCards = [];
  s.pot = 0;
  s.isRunout = false;
  s.showAllCards = false;
  s.playerHandInfos = [];
  s.sidePots = [];
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastRaiserIdx = -1;
  s.handLog = [{ msg: `══════ 第 ${s.roundNum} 局 ══════`, phase: 'pre-flop', type: 'system' }];

  if (s.tableMode === 'tournament' && s.roundNum > 1 && (s.roundNum - 1) % s.handsPerLevel === 0) {
    s.blindLevel += 1;
    s.smallBlind *= 2;
    s.bigBlind *= 2;
    s.minRaise = s.bigBlind;
    s.handLog.push({ msg: `盲注升级：Level ${s.blindLevel}，${s.smallBlind}/${s.bigBlind}`, phase: 'pre-flop', type: 'system' });
  }

  // Rebuy cash players or eliminate tournament players.
  for (const p of s.players) {
    if (!p.isEliminated && p.stack <= 0) {
      if (s.allowRebuy) {
        p.stack = s.buyIn;
        s.handLog.push({ msg: `${p.name} 筹码耗尽，自动买入 $${s.buyIn}`, phase: 'pre-flop', type: 'system' });
      } else {
        p.isEliminated = true;
        s.handLog.push({ msg: `${p.name} 筹码清零，锦标赛出局`, phase: 'pre-flop', type: 'system' });
      }
    }
    p.bet = 0;
    p.totalBet = 0;
    p.isFolded = !!p.isEliminated;
    p.isAllIn = false;
    p.cards = [];
    p.hasActed = false;
  }

  const seatedCount = countSeatedPlayers(s);
  if (seatedCount <= 1) {
    const champion = s.players.find(p => !p.isEliminated);
    s.phase = 'showdown';
    s.isHandComplete = true;
    s.isSessionComplete = true;
    if (champion) {
      s.winners = [{ playerId: champion.id, amount: champion.stack, handName: '锦标赛冠军' }];
      s.handLog.push({ msg: `🏆 ${champion.name} 拿下整场锦标赛`, phase: 'showdown', type: 'result' });
    }
    return s;
  }

  // Rotate dealer among players who still have chips.
  if (s.roundNum > 1 || s.players[s.dealerIdx]?.isEliminated) {
    const nextDealer = findNextSeatedPlayer(s, s.dealerIdx);
    if (nextDealer !== -1) s.dealerIdx = nextDealer;
  }

  // Create and shuffle deck
  s.deck = createDeck();

  // Deal 2 cards to each player
  for (const p of s.players) {
    if (!p.isEliminated) {
      p.cards = [s.deck.pop()!, s.deck.pop()!];
    }
  }

  // Post blinds
  const sbIdx = seatedCount === 2 ? s.dealerIdx : findNextSeatedPlayer(s, s.dealerIdx);
  const bbIdx = findNextSeatedPlayer(s, sbIdx);

  const sbPlayer = s.players[sbIdx];
  const sbAmount = Math.min(s.smallBlind, sbPlayer.stack);
  sbPlayer.stack -= sbAmount;
  sbPlayer.bet = sbAmount;
  sbPlayer.totalBet = sbAmount;
  if (sbPlayer.stack === 0) sbPlayer.isAllIn = true;
  s.pot += sbAmount;

  const bbPlayer = s.players[bbIdx];
  const bbAmount = Math.min(s.bigBlind, bbPlayer.stack);
  bbPlayer.stack -= bbAmount;
  bbPlayer.bet = bbAmount;
  bbPlayer.totalBet = bbAmount;
  if (bbPlayer.stack === 0) bbPlayer.isAllIn = true;
  s.pot += bbAmount;

  s.currentBet = bbAmount;
  s.minRaise = s.bigBlind;

  s.handLog.push({ msg: `${sbPlayer.name}(SB) 小盲 $${sbAmount}`, phase: 'pre-flop', type: 'action' });
  s.handLog.push({ msg: `${bbPlayer.name}(BB) 大盲 $${bbAmount}`, phase: 'pre-flop', type: 'action' });

  // Pre-flop: heads-up starts at SB/button; otherwise first player after BB.
  s.phase = 'pre-flop';
  const firstToAct = seatedCount === 2 ? sbIdx : findNextSeatedPlayer(s, bbIdx);
  s.currentTurnIdx = firstToAct;
  // BB has not acted yet
  s.lastRaiserIdx = -1;

  // Skip if all-in
  const nextActive = findNextActivePlayer(s, s.currentTurnIdx, true);
  if (nextActive === -1) {
    // Everyone is all-in from blinds somehow
    return advancePhase(s);
  }
  s.currentTurnIdx = nextActive;

  return s;
}

// ============================================================
// Find next active player (not folded, not all-in)
// ============================================================

function findNextActivePlayer(state: GameState, fromIdx: number, includeCurrent = false): number {
  const n = state.players.length;
  const start = includeCurrent ? 0 : 1;
  for (let i = start; i < n; i++) {
    const idx = (fromIdx + i) % n;
    const p = state.players[idx];
    if (!p.isEliminated && !p.isFolded && !p.isAllIn) {
      return idx;
    }
  }
  return -1; // no active player
}

function findNextSeatedPlayer(state: GameState, fromIdx: number, includeCurrent = false): number {
  const n = state.players.length;
  const start = includeCurrent ? 0 : 1;
  for (let i = start; i < n; i++) {
    const idx = (fromIdx + i) % n;
    if (!state.players[idx].isEliminated) {
      return idx;
    }
  }
  return -1;
}

function countSeatedPlayers(state: GameState): number {
  return state.players.filter(p => !p.isEliminated).length;
}

function countActivePlayers(state: GameState): number {
  return state.players.filter(p => !p.isEliminated && !p.isFolded).length;
}

function countNonAllInActive(state: GameState): number {
  return state.players.filter(p => !p.isEliminated && !p.isFolded && !p.isAllIn).length;
}

// ============================================================
// Process player action
// ============================================================

export function processAction(state: GameState, action: ActionType, raiseAmount?: number): GameState {
  const s = deepCopy(state);
  if (s.isHandComplete || s.phase === 'showdown' || s.phase === 'idle') return s;

  const player = s.players[s.currentTurnIdx];
  if (!player || player.isEliminated || player.isFolded || player.isAllIn) return s;

  const costToCall = Math.max(0, s.currentBet - player.bet);
  const pos = getPositionLabel(player.seatIndex, s.dealerIdx, s.players.length);

  switch (action) {
    case 'fold': {
      player.isFolded = true;
      player.hasActed = true;
      s.handLog.push({ msg: `${player.name}(${pos}) 弃牌`, phase: s.phase, type: 'action' });
      break;
    }

    case 'check': {
      if (costToCall > 0) return s; // can't check when facing a bet
      player.hasActed = true;
      s.handLog.push({ msg: `${player.name}(${pos}) 过牌`, phase: s.phase, type: 'action' });
      break;
    }

    case 'call': {
      const callAmt = Math.min(costToCall, player.stack);
      if (callAmt <= 0) {
        // Nothing to call, treat as check
        player.hasActed = true;
        s.handLog.push({ msg: `${player.name}(${pos}) 过牌`, phase: s.phase, type: 'action' });
        break;
      }
      player.stack -= callAmt;
      player.bet += callAmt;
      player.totalBet += callAmt;
      s.pot += callAmt;
      player.hasActed = true;
      if (player.stack === 0) {
        player.isAllIn = true;
        s.handLog.push({ msg: `${player.name}(${pos}) 全下跟注 $${player.totalBet}`, phase: s.phase, type: 'action' });
      } else {
        s.handLog.push({ msg: `${player.name}(${pos}) 跟注 $${callAmt}`, phase: s.phase, type: 'action' });
      }
      break;
    }

    case 'raise': {
      let totalRaise = raiseAmount || (s.currentBet + s.minRaise);
      // Ensure minimum raise
      const minAllowed = s.currentBet + s.minRaise;
      if (totalRaise < minAllowed) {
        totalRaise = minAllowed;
      }
      // Cap at player's stack + current bet
      if (totalRaise > player.stack + player.bet) {
        totalRaise = player.stack + player.bet;
      }
      const needed = totalRaise - player.bet;
      if (needed <= 0) return s;
      const actual = Math.min(needed, player.stack);
      player.stack -= actual;
      player.bet += actual;
      player.totalBet += actual;
      s.pot += actual;
      player.hasActed = true;

      const newBet = player.bet;
      if (newBet > s.currentBet) {
        const raiseBy = newBet - s.currentBet;
        s.minRaise = Math.max(s.minRaise, raiseBy);
        s.currentBet = newBet;
        s.lastRaiserIdx = s.currentTurnIdx;
        // CRITICAL: when someone raises, reset hasActed for everyone else
        for (const p of s.players) {
          if (p.id !== player.id && !p.isEliminated && !p.isFolded && !p.isAllIn) {
            p.hasActed = false;
          }
        }
      }

      if (player.stack === 0) {
        player.isAllIn = true;
        s.handLog.push({ msg: `${player.name}(${pos}) 全下加注 $${player.totalBet}`, phase: s.phase, type: 'action' });
      } else {
        s.handLog.push({ msg: `${player.name}(${pos}) 加注到 $${newBet}`, phase: s.phase, type: 'action' });
      }
      break;
    }

    case 'allin': {
      const allInAmt = player.stack;
      if (allInAmt <= 0) return s;
      player.bet += allInAmt;
      player.totalBet += allInAmt;
      s.pot += allInAmt;
      player.stack = 0;
      player.isAllIn = true;
      player.hasActed = true;

      if (player.bet > s.currentBet) {
        const raiseBy = player.bet - s.currentBet;
        if (raiseBy >= s.minRaise) {
          s.minRaise = raiseBy;
        }
        s.currentBet = player.bet;
        s.lastRaiserIdx = s.currentTurnIdx;
        // Reset hasActed for others
        for (const p of s.players) {
          if (p.id !== player.id && !p.isEliminated && !p.isFolded && !p.isAllIn) {
            p.hasActed = false;
          }
        }
      }

      s.handLog.push({ msg: `${player.name}(${pos}) ALL-IN $${player.totalBet}`, phase: s.phase, type: 'action' });
      break;
    }
  }

  // Check if hand is over (only one non-folded player remaining)
  const activePlayers = s.players.filter(p => !p.isEliminated && !p.isFolded);
  if (activePlayers.length <= 1) {
    return resolveHand(s);
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(s)) {
    return advancePhase(s);
  }

  // Move to next active player
  const nextIdx = findNextActivePlayer(s, s.currentTurnIdx);
  if (nextIdx === -1) {
    // No more active players — everyone all-in or folded
    return advancePhase(s);
  }
  s.currentTurnIdx = nextIdx;

  return s;
}

// ============================================================
// Check if betting round is complete
// ============================================================

function isBettingRoundComplete(state: GameState): boolean {
  const active = state.players.filter(p => !p.isEliminated && !p.isFolded && !p.isAllIn);

  // If 0 or 1 active (non-allin) players, round is done
  if (active.length <= 1) {
    // But check: if the 1 remaining hasn't acted yet (and there's a bet to call), they need to act
    if (active.length === 1 && !active[0].hasActed) {
      return false;
    }
    return true;
  }

  // All active players must have acted AND matched current bet
  return active.every(p => p.hasActed && p.bet === state.currentBet);
}

// ============================================================
// Advance to next phase
// ============================================================

function advancePhase(state: GameState): GameState {
  const s = deepCopy(state);

  // Reset round bets and hasActed
  for (const p of s.players) {
    if (!p.isEliminated) {
      p.bet = 0;
      p.hasActed = false;
    }
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastRaiserIdx = -1;

  const activeNotAllIn = countNonAllInActive(s);
  const activePlayers = countActivePlayers(s);

  // If only one non-folded player, resolve immediately
  if (activePlayers <= 1) {
    return resolveHand(s);
  }

  // If all active players are all-in or only 1 can still bet, run out the board
  const shouldRunOut = activeNotAllIn <= 1;

  switch (s.phase) {
    case 'pre-flop': {
      s.phase = 'flop';
      s.deck.pop(); // burn
      s.communityCards = [s.deck.pop()!, s.deck.pop()!, s.deck.pop()!];
      s.handLog.push({ msg: `─── 翻牌: ${s.communityCards.map(cardToString).join(' ')} ───`, phase: 'flop', type: 'system' });
      if (shouldRunOut) {
        // Enter runout mode: show cards, evaluate hands, but DON'T recurse
        s.isRunout = true;
        s.showAllCards = true;
        s.playerHandInfos = computePlayerHandInfos(s);
        // Log initial hand evaluations
        for (const info of s.playerHandInfos) {
          const player = s.players.find(p => p.id === info.playerId);
          if (player) {
            const drawStr = info.draws.length > 0
              ? ` | 听: ${info.draws.map(d => d.name).join(', ')}`
              : '';
            s.handLog.push({
              msg: `📊 ${player.name}: ${info.name}${drawStr}`,
              phase: 'flop',
              type: 'hand-update'
            });
          }
        }
        return s; // UI timer will call advanceRunout()
      }
      break;
    }
    case 'flop': {
      s.phase = 'turn';
      s.deck.pop(); // burn
      const turnCard = s.deck.pop()!;
      s.communityCards.push(turnCard);
      s.handLog.push({ msg: `─── 转牌: ${cardToString(turnCard)} ───`, phase: 'turn', type: 'system' });
      if (shouldRunOut) {
        s.isRunout = true;
        s.showAllCards = true;
        s.playerHandInfos = computePlayerHandInfos(s);
        for (const info of s.playerHandInfos) {
          const player = s.players.find(p => p.id === info.playerId);
          if (player) {
            const drawStr = info.draws.length > 0 ? ` | 听: ${info.draws.map(d => d.name).join(', ')}` : '';
            s.handLog.push({ msg: `📊 ${player.name}: ${info.name}${drawStr}`, phase: 'turn', type: 'hand-update' });
          }
        }
        return s;
      }
      break;
    }
    case 'turn': {
      s.phase = 'river';
      s.deck.pop(); // burn
      const riverCard = s.deck.pop()!;
      s.communityCards.push(riverCard);
      s.handLog.push({ msg: `─── 河牌: ${cardToString(riverCard)} ───`, phase: 'river', type: 'system' });
      if (shouldRunOut) {
        s.isRunout = true;
        s.showAllCards = true;
        s.playerHandInfos = computePlayerHandInfos(s);
        for (const info of s.playerHandInfos) {
          const player = s.players.find(p => p.id === info.playerId);
          if (player) {
            s.handLog.push({ msg: `📊 ${player.name}: ${info.name}`, phase: 'river', type: 'hand-update' });
          }
        }
        return s;
      }
      break;
    }
    case 'river': {
      return resolveHand(s);
    }
  }

  // Set first player to act (post-flop: first active player after dealer)
  const sbIdx = findNextSeatedPlayer(s, s.dealerIdx);
  const nextActive = findNextActivePlayer(s, sbIdx, true);
  if (nextActive === -1) {
    return resolveHand(s);
  }
  s.currentTurnIdx = nextActive;

  return s;
}

// ============================================================
// Calculate side pots
// ============================================================

function calculateSidePots(players: Player[]): SidePot[] {
  const contributors = players.filter(p => p.totalBet > 0);
  if (contributors.length === 0) return [];

  // Collect all unique bet levels from all-in players (non-folded)
  const allInLevels = [...new Set(
    players.filter(p => p.isAllIn && !p.isFolded && p.totalBet > 0).map(p => p.totalBet)
  )].sort((a, b) => a - b);

  const maxBet = Math.max(...contributors.map(p => p.totalBet));

  // If no all-in, single pot
  if (allInLevels.length === 0) {
    const total = contributors.reduce((sum, p) => sum + p.totalBet, 0);
    const eligible = players.filter(p => !p.isEliminated && !p.isFolded).map(p => p.id);
    return [{ amount: total, eligible }];
  }

  // Add max bet level if not already there
  if (!allInLevels.includes(maxBet)) {
    allInLevels.push(maxBet);
  }

  const pots: SidePot[] = [];
  let previousBet = 0;

  for (const level of allInLevels) {
    const contribution = level - previousBet;
    if (contribution <= 0) continue;

    let potAmount = 0;
    const eligible: string[] = [];

    for (const p of players) {
      if (p.totalBet > previousBet) {
        potAmount += Math.min(contribution, p.totalBet - previousBet);
      }
      // Only non-folded players who bet at least this level can win this pot
      if (!p.isEliminated && !p.isFolded && p.totalBet >= level) {
        eligible.push(p.id);
      }
    }

    if (potAmount > 0 && eligible.length > 0) {
      pots.push({ amount: potAmount, eligible });
    }
    previousBet = level;
  }

  return pots;
}

// ============================================================
// Resolve hand (showdown or last player standing)
// ============================================================

function resolveHand(state: GameState): GameState {
  const s = deepCopy(state);
  s.phase = 'showdown';
  s.isHandComplete = true;

  const activePlayers = s.players.filter(p => !p.isEliminated && !p.isFolded);

  // Only one player left — wins without showdown
  if (activePlayers.length <= 1) {
    const winner = activePlayers[0] || s.players.find(p => !p.isEliminated) || s.players[0];
    const totalPot = s.players.reduce((sum, p) => sum + p.totalBet, 0);
    winner.stack += totalPot;
    s.winners = [{ playerId: winner.id, amount: totalPot, handName: '其他玩家弃牌' }];
    s.handLog.push({ msg: `🏆 ${winner.name} 赢得 $${totalPot}（其他玩家弃牌）`, phase: 'showdown', type: 'result' });
    s.pot = 0;
    return s;
  }

  // Ensure board is complete for showdown
  while (s.communityCards.length < 5 && s.deck.length > 1) {
    s.deck.pop(); // burn
    if (s.deck.length > 0) {
      s.communityCards.push(s.deck.pop()!);
    }
  }

  // Evaluate all active hands
  const evaluations = activePlayers.map(p => ({
    player: p,
    eval: evaluateHand([...p.cards, ...s.communityCards])
  }));

  // Calculate side pots
  const sidePots = calculateSidePots(s.players);
  s.sidePots = sidePots;
  s.winners = [];

  if (sidePots.length === 0) {
    // Fallback: simple case
    const totalPot = s.players.reduce((sum, p) => sum + p.totalBet, 0);
    evaluations.sort((a, b) => b.eval.score - a.eval.score);
    const winner = evaluations[0];
    winner.player.stack += totalPot;
    s.winners.push({ playerId: winner.player.id, amount: totalPot, handName: winner.eval.name });
    s.handLog.push({ msg: `🏆 ${winner.player.name} [${winner.eval.name}] 赢得 $${totalPot}`, phase: 'showdown', type: 'result' });
  } else {
    // Distribute each side pot
    for (let i = 0; i < sidePots.length; i++) {
      const sp = sidePots[i];
      const eligible = evaluations.filter(e => sp.eligible.includes(e.player.id));
      eligible.sort((a, b) => b.eval.score - a.eval.score);

      if (eligible.length > 0) {
        const bestScore = eligible[0].eval.score;
        const tiedWinners = eligible.filter(e => e.eval.score === bestScore);
        const share = Math.floor(sp.amount / tiedWinners.length);
        const remainder = sp.amount - share * tiedWinners.length;

        tiedWinners.forEach((w, idx) => {
          const amt = share + (idx === 0 ? remainder : 0);
          w.player.stack += amt;
          const potLabel = sidePots.length > 1 ? `(${i === 0 ? '主池' : `边池${i}`})` : '';
          // Merge into existing winner entry if same player
          const existing = s.winners.find(x => x.playerId === w.player.id);
          if (existing) {
            existing.amount += amt;
          } else {
            s.winners.push({ playerId: w.player.id, amount: amt, handName: w.eval.name });
          }
          s.handLog.push({ msg: `🏆 ${w.player.name} [${w.eval.name}] 赢得${potLabel} $${amt}`, phase: 'showdown', type: 'result' });
        });
      }
    }
  }

  s.pot = 0;

  // Log all showdown hands
  for (const e of evaluations) {
    s.handLog.push({ msg: `📋 ${e.player.name}: ${e.player.cards.map(cardToString).join(' ')} → ${e.eval.name}`, phase: 'showdown', type: 'system' });
  }

  return s;
}

// ============================================================
// Utility
// ============================================================

function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getPlayerPosition(state: GameState, playerIdx: number): string {
  return getPositionLabel(state.players[playerIdx].seatIndex, state.dealerIdx, state.players.length);
}

export function getHumanPlayer(state: GameState): Player | undefined {
  return state.players.find(p => p.type === 'human');
}

export function getHumanPlayerIdx(state: GameState): number {
  return state.players.findIndex(p => p.type === 'human');
}

export function isHumanTurn(state: GameState): boolean {
  const p = state.players[state.currentTurnIdx];
  return p?.type === 'human' && !p.isEliminated && !p.isFolded && !p.isAllIn && !state.isHandComplete;
}

export function getCallAmount(state: GameState, playerIdx: number): number {
  const p = state.players[playerIdx];
  if (!p || p.isEliminated) return 0;
  return Math.min(Math.max(0, state.currentBet - p.bet), p.stack);
}

// ============================================================
// Runout — compute hand infos for all active players
// ============================================================

function computePlayerHandInfos(state: GameState): PlayerHandInfo[] {
  const activePlayers = state.players.filter(p => !p.isEliminated && !p.isFolded);
  return activePlayers.map(p => {
    const contribution = getHandContribution(p.cards, state.communityCards);
    const draws = state.communityCards.length < 5
      ? analyzeDraws(p.cards, state.communityCards)
      : [];
    
    return {
      playerId: p.id,
      rank: contribution.rank,
      name: contribution.name,
      bestCards: contribution.bestCards,
      holeUsed: contribution.holeUsed,
      communityUsed: contribution.communityUsed,
      draws,
    };
  });
}

/**
 * Advance the runout by one step.
 * Called by the UI timer during all-in runout mode.
 * flop → turn → river → showdown
 */
export function advanceRunout(state: GameState): GameState {
  const s = deepCopy(state);
  if (!s.isRunout) return s;

  switch (s.phase) {
    case 'flop': {
      // Deal turn card
      s.phase = 'turn';
      s.deck.pop(); // burn
      const turnCard = s.deck.pop()!;
      s.communityCards.push(turnCard);
      s.handLog.push({ msg: `─── 转牌: ${cardToString(turnCard)} ───`, phase: 'turn', type: 'system' });
      s.playerHandInfos = computePlayerHandInfos(s);
      // Log hand updates
      for (const info of s.playerHandInfos) {
        const player = s.players.find(p => p.id === info.playerId);
        if (player) {
          const drawStr = info.draws.length > 0
            ? ` | 听: ${info.draws.map(d => d.name).join(', ')}`
            : '';
          s.handLog.push({
            msg: `📊 ${player.name}: ${info.name}${drawStr}`,
            phase: 'turn',
            type: 'hand-update'
          });
        }
      }
      return s;
    }
    case 'turn': {
      // Deal river card
      s.phase = 'river';
      s.deck.pop(); // burn
      const riverCard = s.deck.pop()!;
      s.communityCards.push(riverCard);
      s.handLog.push({ msg: `─── 河牌: ${cardToString(riverCard)} ───`, phase: 'river', type: 'system' });
      s.playerHandInfos = computePlayerHandInfos(s);
      // Log hand updates
      for (const info of s.playerHandInfos) {
        const player = s.players.find(p => p.id === info.playerId);
        if (player) {
          s.handLog.push({
            msg: `📊 ${player.name}: ${info.name}`,
            phase: 'river',
            type: 'hand-update'
          });
        }
      }
      return s;
    }
    case 'river': {
      // Move to showdown
      s.isRunout = false;
      return resolveHand(s);
    }
    default: {
      // Shouldn't happen, but resolve anyway
      s.isRunout = false;
      return resolveHand(s);
    }
  }
}

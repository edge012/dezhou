/**
 * usePokerGame — 核心游戏循环 + 桌子账户层
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  type GameState, type ActionType, type PlayerHandInfo,
  createInitialState, dealNewHand, processAction, advanceRunout,
  isHumanTurn, getHumanPlayer, getCallAmount, getHumanPlayerIdx, getPlayerPosition
} from '../engine/gameEngine';
import { getAIDecision } from '../engine/aiPlayers';
import { getCoachingInsight, getReview, type CoachingInsight } from '../engine/coachingService';
import { evaluateHand, cardsToString, calculateOuts, calculatePotOdds, getPreFlopStrength, getHandContribution } from '../engine/poker';

const PLAYERS_CONFIG = [
  { name: '玩家', type: 'human' as const },
  { name: '王大炮', type: 'ai' as const, personality: 'aggressive' },
  { name: '赵跟风', type: 'ai' as const, personality: 'calling' },
  { name: '陈算师', type: 'ai' as const, personality: 'pro' },
  { name: '李稳妥', type: 'ai' as const, personality: 'rock' },
];

export type TableMode = 'cash' | 'tournament';
export type PanelTab = 'coach' | 'review' | 'stats' | 'history' | 'log';

export interface SessionConfig {
  mode: TableMode;
  buyIn: number;
  smallBlind: number;
  bigBlind: number;
  tournamentEntry: number;
  tournamentStack: number;
  handsPerLevel: number;
}

export interface SessionStats {
  handsPlayed: number;
  winCount: number;
  startStack: number;
  vpipCount: number;
  showdownCount: number;
  foldCount: number;
  callCount: number;
  raiseCount: number;
  allInCount: number;
  biggestPot: number;
  totalNet: number;
  lastHandNet: number;
  bestHand: string;
}

export interface AccountLedgerEntry {
  id: string;
  time: string;
  amount: number;
  type: 'buyin' | 'cashout' | 'entry' | 'topup';
  note: string;
}

export interface PokerAccount {
  balance: number;
  totalBuyIns: number;
  totalCashouts: number;
  ledger: AccountLedgerEntry[];
}

export interface HandHistoryRecord {
  id: string;
  time: string;
  roundNum: number;
  mode: TableMode;
  blindLevel: number;
  blinds: string;
  heroHand: string;
  board: string;
  heroResult: 'win' | 'loss';
  net: number;
  stackAfter: number;
  potSize: number;
  handName: string;
  winners: string;
  log: string[];
  review?: string | null;
}

const DEFAULT_CONFIG: SessionConfig = {
  mode: 'cash',
  buyIn: 1000,
  smallBlind: 10,
  bigBlind: 20,
  tournamentEntry: 300,
  tournamentStack: 1500,
  handsPerLevel: 4,
};

const DEFAULT_ACCOUNT: PokerAccount = {
  balance: 10000,
  totalBuyIns: 0,
  totalCashouts: 0,
  ledger: [],
};

const DEFAULT_STATS: SessionStats = {
  handsPlayed: 0,
  winCount: 0,
  startStack: 1000,
  vpipCount: 0,
  showdownCount: 0,
  foldCount: 0,
  callCount: 0,
  raiseCount: 0,
  allInCount: 0,
  biggestPot: 0,
  totalNet: 0,
  lastHandNet: 0,
  bestHand: '等待第一手牌',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    if (fallback && typeof fallback === 'object' && parsed && typeof parsed === 'object') {
      return { ...fallback, ...parsed };
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable in private browsing; the game should still run.
  }
}

function makeLedgerEntry(type: AccountLedgerEntry['type'], amount: number, note: string): AccountLedgerEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toISOString(),
    amount,
    type,
    note,
  };
}

function countHeroActions(log: string[]) {
  const heroLines = log.filter(line => line.includes('玩家(') || line.includes('玩家 '));
  return {
    folded: heroLines.some(line => line.includes('弃牌')),
    called: heroLines.some(line => line.includes('跟注')),
    raised: heroLines.some(line => line.includes('加注')),
    allIn: heroLines.some(line => line.includes('ALL-IN') || line.includes('全下')),
  };
}

function toCsvValue(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function usePokerGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [appMode, setAppMode] = useState<'intro' | 'playing'>('intro');
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>(() => readStorage('holdem-session-config', DEFAULT_CONFIG));
  const [activeSessionConfig, setActiveSessionConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [account, setAccount] = useState<PokerAccount>(() => readStorage('holdem-account', DEFAULT_ACCOUNT));
  const [handHistory, setHandHistory] = useState<HandHistoryRecord[]>(() => readStorage('holdem-hand-history', [] as HandHistoryRecord[]));
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ ...DEFAULT_STATS });
  const [raiseAmount, setRaiseAmount] = useState(40);
  const [insight, setInsight] = useState<CoachingInsight | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isHeroFolding, setIsHeroFolding] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('coach');

  const aiTimerRef = useRef<number | null>(null);
  const foldTimerRef = useRef<number | null>(null);
  const runoutTimerRef = useRef<number | null>(null);
  const coachCalledRef = useRef(false);
  const reviewCalledRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const handStartStackRef = useRef(DEFAULT_CONFIG.buyIn);
  const tournamentPrizeAwardedRef = useRef(false);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => writeStorage('holdem-session-config', sessionConfig), [sessionConfig]);
  useEffect(() => writeStorage('holdem-account', account), [account]);
  useEffect(() => writeStorage('holdem-hand-history', handHistory), [handHistory]);

  const applyAccountDelta = useCallback((amount: number, type: AccountLedgerEntry['type'], note: string) => {
    setAccount(prev => ({
      balance: prev.balance + amount,
      totalBuyIns: type === 'buyin' || type === 'entry' ? prev.totalBuyIns + Math.abs(amount) : prev.totalBuyIns,
      totalCashouts: type === 'cashout' ? prev.totalCashouts + Math.max(0, amount) : prev.totalCashouts,
      ledger: [makeLedgerEntry(type, amount, note), ...prev.ledger].slice(0, 60),
    }));
  }, []);

  const resetAccount = useCallback(() => {
    setAccount(DEFAULT_ACCOUNT);
  }, []);

  const addPracticeCredits = useCallback((amount = 5000) => {
    applyAccountDelta(amount, 'topup', `补充练习积分 +${amount}`);
  }, [applyAccountDelta]);

  const cancelFoldThinking = useCallback(() => {
    if (foldTimerRef.current) {
      window.clearTimeout(foldTimerRef.current);
      foldTimerRef.current = null;
    }
    setIsHeroFolding(false);
  }, []);

  const startSession = useCallback((scenario?: string) => {
    const config = sessionConfig;
    const isCash = config.mode === 'cash';
    const startStack = isCash ? config.buyIn : config.tournamentStack;
    const entryCost = isCash ? config.buyIn : config.tournamentEntry;

    if (account.balance < entryCost) return false;

    applyAccountDelta(
      -entryCost,
      isCash ? 'buyin' : 'entry',
      isCash ? `现金局买入 ${config.buyIn}` : `锦标赛报名费 ${config.tournamentEntry}`
    );

    const initial = createInitialState(PLAYERS_CONFIG, startStack, {
      tableMode: config.mode,
      buyIn: config.buyIn,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      allowRebuy: isCash,
      handsPerLevel: config.handsPerLevel,
    });
    let state = dealNewHand(initial);

    if (scenario === 'sunk-cost') {
      const hero = state.players.find(p => p.type === 'human');
      if (hero) hero.cards = [{ suit: 'hearts', rank: '7' }, { suit: 'clubs', rank: '2' }];
    } else if (scenario === 'info-gap') {
      const hero = state.players.find(p => p.type === 'human');
      if (hero) hero.cards = [{ suit: 'spades', rank: 'A' }, { suit: 'hearts', rank: 'A' }];
    } else if (scenario === 'ev') {
      const hero = state.players.find(p => p.type === 'human');
      if (hero) hero.cards = [{ suit: 'diamonds', rank: 'K' }, { suit: 'diamonds', rank: '9' }];
    }

    handStartStackRef.current = startStack;
    tournamentPrizeAwardedRef.current = false;
    setActiveSessionConfig(config);
    setGameState(state);
    setAppMode('playing');
    setSessionStats({ ...DEFAULT_STATS, startStack });
    setInsight(null);
    setReviewResult(null);
    setSelectedHistoryId(null);
    setPanelTab('coach');
    coachCalledRef.current = false;
    reviewCalledRef.current = false;
    cancelFoldThinking();
    return true;
  }, [account.balance, applyAccountDelta, cancelFoldThinking, sessionConfig]);

  const nextHand = useCallback(() => {
    if (!gameState) return;
    const heroBefore = getHumanPlayer(gameState);
    const rebuyingHero = activeSessionConfig.mode === 'cash' && !!heroBefore && heroBefore.stack <= 0;

    if (rebuyingHero) {
      applyAccountDelta(-activeSessionConfig.buyIn, 'buyin', `现金局自动补码 ${activeSessionConfig.buyIn}`);
    }

    handStartStackRef.current = rebuyingHero ? activeSessionConfig.buyIn : Math.max(0, heroBefore?.stack ?? sessionStats.startStack);
    const state = dealNewHand(gameState);
    if (
      activeSessionConfig.mode === 'tournament' &&
      state.isSessionComplete &&
      !tournamentPrizeAwardedRef.current &&
      state.winners.some(w => state.players.find(p => p.id === w.playerId)?.type === 'human')
    ) {
      tournamentPrizeAwardedRef.current = true;
      applyAccountDelta(activeSessionConfig.tournamentEntry * PLAYERS_CONFIG.length, 'cashout', '锦标赛奖金入账');
    }
    setGameState(state);
    setInsight(null);
    setReviewResult(null);
    setSelectedHistoryId(null);
    setPanelTab('coach');
    coachCalledRef.current = false;
    reviewCalledRef.current = false;
    cancelFoldThinking();
  }, [activeSessionConfig, applyAccountDelta, cancelFoldThinking, gameState, sessionStats.startStack]);

  const leaveTable = useCallback(() => {
    const hero = gameState ? getHumanPlayer(gameState) : null;
    if (hero && activeSessionConfig.mode === 'cash' && hero.stack > 0) {
      applyAccountDelta(hero.stack, 'cashout', `离桌结算 ${hero.stack}`);
    }
    setGameState(null);
    setAppMode('intro');
    setInsight(null);
    setReviewResult(null);
    setPanelTab('coach');
    cancelFoldThinking();
  }, [activeSessionConfig.mode, applyAccountDelta, cancelFoldThinking, gameState]);

  const doAction = useCallback((action: ActionType, amount?: number) => {
    if (!gameState || gameState.isHandComplete || isHeroFolding) return;
    const newState = processAction(gameState, action, amount);
    setGameState(newState);
    coachCalledRef.current = false;
  }, [gameState, isHeroFolding]);

  const heroFold = useCallback(() => {
    if (!gameState || gameState.isHandComplete || isHeroFolding || !isHumanTurn(gameState)) return;
    setIsHeroFolding(true);
    if (foldTimerRef.current) window.clearTimeout(foldTimerRef.current);
    foldTimerRef.current = window.setTimeout(() => {
      const currentState = gameStateRef.current;
      if (currentState && !currentState.isHandComplete && isHumanTurn(currentState)) {
        const newState = processAction(currentState, 'fold');
        setGameState(newState);
        coachCalledRef.current = false;
      }
      setIsHeroFolding(false);
      foldTimerRef.current = null;
    }, 1250);
  }, [gameState, isHeroFolding]);
  const heroCheck = useCallback(() => doAction('check'), [doAction]);
  const heroCall = useCallback(() => doAction('call'), [doAction]);
  const heroRaise = useCallback(() => {
    if (!gameState) return;
    const totalRaise = Math.max(gameState.currentBet + gameState.minRaise, raiseAmount);
    doAction('raise', totalRaise);
  }, [doAction, gameState, raiseAmount]);
  const heroAllIn = useCallback(() => doAction('allin'), [doAction]);

  useEffect(() => {
    if (!gameState || gameState.isHandComplete || gameState.phase === 'showdown' || gameState.isRunout) return;
    const current = gameState.players[gameState.currentTurnIdx];
    if (!current || current.type !== 'ai' || current.isFolded || current.isAllIn || current.isEliminated) return;

    const delay = 600 + Math.random() * 600;
    aiTimerRef.current = window.setTimeout(() => {
      const currentState = gameStateRef.current;
      if (!currentState || currentState.isHandComplete) return;
      const p = currentState.players[currentState.currentTurnIdx];
      if (!p || p.type !== 'ai' || p.isFolded || p.isAllIn || p.isEliminated) return;

      const decision = getAIDecision(currentState, currentState.currentTurnIdx);
      const newState = processAction(currentState, decision.action, decision.raiseAmount);
      setGameState(newState);
      coachCalledRef.current = false;
    }, delay);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (foldTimerRef.current) window.clearTimeout(foldTimerRef.current);
    };
  }, []);

  // ── Runout auto-advance timer ──
  useEffect(() => {
    if (!gameState || !gameState.isRunout || gameState.isHandComplete) {
      if (runoutTimerRef.current) {
        clearTimeout(runoutTimerRef.current);
        runoutTimerRef.current = null;
      }
      return;
    }

    const delay = 2000; // 2 seconds between each street reveal
    runoutTimerRef.current = window.setTimeout(() => {
      const currentState = gameStateRef.current;
      if (!currentState || !currentState.isRunout) return;
      const newState = advanceRunout(currentState);
      setGameState(newState);
    }, delay);

    return () => {
      if (runoutTimerRef.current) {
        clearTimeout(runoutTimerRef.current);
        runoutTimerRef.current = null;
      }
    };
  }, [gameState]);

  useEffect(() => {
    if (!gameState || gameState.isHandComplete || coachCalledRef.current) return;
    if (!isHumanTurn(gameState)) return;

    coachCalledRef.current = true;
    const hero = getHumanPlayer(gameState);
    if (!hero) return;

    setIsInsightLoading(true);
    const activePlayers = gameState.players.filter(p => !p.isEliminated && !p.isFolded).length;
    const callCost = getCallAmount(gameState, getHumanPlayerIdx(gameState));
    const heroIdx = getHumanPlayerIdx(gameState);
    const position = getPlayerPosition(gameState, heroIdx);

    getCoachingInsight(
      hero.cards,
      gameState.communityCards,
      gameState.pot,
      callCost,
      hero.stack,
      position,
      gameState.phase,
      activePlayers - 1
    ).then(res => {
      setInsight(res);
      setIsInsightLoading(false);
    }).catch(() => {
      setIsInsightLoading(false);
    });
  }, [gameState]);

  useEffect(() => {
    if (!gameState?.isHandComplete || reviewCalledRef.current) return;
    reviewCalledRef.current = true;

    const hero = getHumanPlayer(gameState);
    const heroWon = gameState.winners.some(w => w.playerId === hero?.id);
    const finalPot = gameState.winners.reduce((sum, w) => sum + w.amount, 0);
    const heroHand = hero ? cardsToString(hero.cards) : '';
    const board = cardsToString(gameState.communityCards);
    const heroEval = hero ? evaluateHand([...hero.cards, ...gameState.communityCards]) : null;
    const handName = heroEval?.name || '未亮牌';
    const net = (hero?.stack ?? 0) - handStartStackRef.current;
    const logText = gameState.handLog.map(l => l.msg);
    const heroActions = countHeroActions(logText);
    const didShowdown = gameState.communityCards.length >= 5 && !hero?.isFolded;

    const result = gameState.winners.map(w => {
      const p = gameState.players.find(pl => pl.id === w.playerId);
      return `${p?.name || w.playerId}: ${w.handName} ($${w.amount})`;
    }).join('; ');

    const recordId = `${Date.now()}-${gameState.roundNum}`;
    const record: HandHistoryRecord = {
      id: recordId,
      time: new Date().toISOString(),
      roundNum: gameState.roundNum,
      mode: activeSessionConfig.mode,
      blindLevel: gameState.blindLevel,
      blinds: `${gameState.smallBlind}/${gameState.bigBlind}`,
      heroHand,
      board,
      heroResult: heroWon ? 'win' : 'loss',
      net,
      stackAfter: hero?.stack ?? 0,
      potSize: finalPot,
      handName,
      winners: result,
      log: logText,
      review: null,
    };

    setSessionStats(prev => ({
      ...prev,
      handsPlayed: prev.handsPlayed + 1,
      winCount: heroWon ? prev.winCount + 1 : prev.winCount,
      vpipCount: heroActions.called || heroActions.raised || heroActions.allIn ? prev.vpipCount + 1 : prev.vpipCount,
      showdownCount: didShowdown ? prev.showdownCount + 1 : prev.showdownCount,
      foldCount: heroActions.folded ? prev.foldCount + 1 : prev.foldCount,
      callCount: heroActions.called ? prev.callCount + 1 : prev.callCount,
      raiseCount: heroActions.raised ? prev.raiseCount + 1 : prev.raiseCount,
      allInCount: heroActions.allIn ? prev.allInCount + 1 : prev.allInCount,
      biggestPot: Math.max(prev.biggestPot, finalPot),
      totalNet: prev.totalNet + net,
      lastHandNet: net,
      bestHand: heroEval && heroEval.score > 0 ? handName : prev.bestHand,
    }));

    setHandHistory(prev => [record, ...prev].slice(0, 120));
    setSelectedHistoryId(recordId);
    setIsReviewing(true);

    getReview(logText, heroHand, board, finalPot, result).then(r => {
      setReviewResult(r);
      setIsReviewing(false);
      setHandHistory(prev => prev.map(item => item.id === recordId ? { ...item, review: r } : item));
    }).catch(() => {
      const fallback = '复盘生成失败，请检查网络连接。';
      setReviewResult(fallback);
      setIsReviewing(false);
      setHandHistory(prev => prev.map(item => item.id === recordId ? { ...item, review: fallback } : item));
    });
  }, [activeSessionConfig.mode, gameState?.isHandComplete]);

  const clearHistory = useCallback(() => {
    setHandHistory([]);
    setSelectedHistoryId(null);
  }, []);

  const exportHistory = useCallback((format: 'json' | 'csv' = 'json') => {
    if (typeof window === 'undefined') return;
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = handHistory;
    const content = format === 'json'
      ? JSON.stringify(rows, null, 2)
      : [
          ['time', 'mode', 'round', 'blinds', 'heroHand', 'board', 'result', 'net', 'pot', 'handName', 'winners'].map(toCsvValue).join(','),
          ...rows.map(r => [r.time, r.mode, r.roundNum, r.blinds, r.heroHand, r.board, r.heroResult, r.net, r.potSize, r.handName, r.winners].map(toCsvValue).join(',')),
        ].join('\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holdem-history-${stamp}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [handHistory]);

  const hero = gameState ? getHumanPlayer(gameState) : null;
  const heroIdx = gameState ? getHumanPlayerIdx(gameState) : -1;
  const heroEval = hero ? evaluateHand([...hero.cards, ...(gameState?.communityCards || [])]) : null;
  const callCost = gameState && heroIdx >= 0 ? getCallAmount(gameState, heroIdx) : 0;
  const canAct = gameState ? isHumanTurn(gameState) && !isHeroFolding && !gameState.isRunout : false;
  const heroPreFlop = hero && hero.cards.length === 2 ? getPreFlopStrength(hero.cards[0], hero.cards[1]) : null;
  const outsInfo = hero && gameState && gameState.communityCards.length >= 3
    ? calculateOuts(hero.cards, gameState.communityCards) : null;
  const potOddsInfo = gameState ? calculatePotOdds(gameState.pot, callCost) : null;
  const selectedHistory = (selectedHistoryId && handHistory.find(h => h.id === selectedHistoryId)) || handHistory[0] || null;
  const heroContribution = hero && gameState && gameState.communityCards.length >= 3
    ? getHandContribution(hero.cards, gameState.communityCards) : null;
  const playerHandInfos = gameState?.playerHandInfos || [];

  const minRaiseTotal = gameState ? gameState.currentBet + gameState.minRaise : 40;
  const maxRaiseTotal = hero ? hero.stack + (hero.bet || 0) : 1000;
  const bankrollAtRisk = sessionConfig.mode === 'cash'
    ? Math.round((sessionConfig.buyIn / Math.max(1, account.balance + sessionConfig.buyIn)) * 100)
    : Math.round((sessionConfig.tournamentEntry / Math.max(1, account.balance + sessionConfig.tournamentEntry)) * 100);
  const canStartSession = account.balance >= (sessionConfig.mode === 'cash' ? sessionConfig.buyIn : sessionConfig.tournamentEntry);

  useEffect(() => {
    setRaiseAmount(prev => Math.max(minRaiseTotal, Math.min(prev, maxRaiseTotal)));
  }, [minRaiseTotal, maxRaiseTotal]);

  return {
    gameState, appMode, sessionConfig, activeSessionConfig, account, sessionStats,
    handHistory, selectedHistory, selectedHistoryId,
    raiseAmount, insight, isInsightLoading, reviewResult, isReviewing, isHeroFolding, showKnowledge, panelTab,
    hero, heroEval, heroPreFlop, callCost, canAct, outsInfo, potOddsInfo,
    heroContribution, playerHandInfos,
    minRaiseTotal, maxRaiseTotal, bankrollAtRisk, canStartSession,
    setRaiseAmount, setShowKnowledge, setPanelTab, setAppMode, setSessionConfig, setSelectedHistoryId,
    startSession, nextHand, leaveTable, resetAccount, addPracticeCredits, clearHistory, exportHistory,
    heroFold, heroCheck, heroCall, heroRaise, heroAllIn,
  };
}

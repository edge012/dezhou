import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';
import {
  Trophy, Brain, ChevronRight, BookOpen, Briefcase, Target, Coins,
  TrendingUp, BarChart3, Sparkles, Wallet, Download, RotateCcw,
  History, Gauge, ClipboardList, Landmark
} from 'lucide-react';
import { usePokerGame } from './hooks/usePokerGame';
import CardComponent from './components/CardComponent';
import PlayerSeat from './components/PlayerSeat';
import KnowledgeModal from './components/KnowledgeModal';

type PokerGameHook = ReturnType<typeof usePokerGame>;

const ACTION_META: Record<string, { label: string; tone: string; note: string }> = {
  Fold: { label: '弃牌', tone: 'text-slate-300 bg-slate-800/80 border-slate-700', note: '控制损失' },
  Check: { label: '过牌', tone: 'text-blue-300 bg-blue-950/30 border-blue-800/50', note: '免费看信息' },
  Call: { label: '跟注', tone: 'text-amber-300 bg-amber-950/30 border-amber-800/50', note: '赔率够再买票' },
  Raise: { label: '加注', tone: 'text-emerald-300 bg-emerald-950/30 border-emerald-800/50', note: '施压或榨价值' },
};

function getActionMeta(action?: string) {
  return ACTION_META[action || ''] || { label: action || '--', tone: 'text-slate-300 bg-slate-800/80 border-slate-700', note: '等待判断' };
}

function insightPoints(text?: string, limit = 4) {
  if (!text) return [];
  return text
    .replace(/\s*\d+[)）.、]\s*/g, '|')
    .replace(/[。；;]\s*/g, '|')
    .split('|')
    .map(item => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean)
    .slice(0, limit);
}

function InsightList({ text, limit = 4 }: { text?: string; limit?: number }) {
  const points = insightPoints(text, limit);
  if (!points.length) return <p className="text-[11px] text-slate-400 leading-relaxed">等教练给出清晰计划。</p>;
  return (
    <ul className="coach-point-list">
      {points.map((point, idx) => <li key={idx}>{point}</li>)}
    </ul>
  );
}

// ─── Intro Screen ───────────────────────────────────────────
function IntroScreen({ g }: { g: PokerGameHook }) {
  const cfg = g.sessionConfig;
  const startCost = cfg.mode === 'cash' ? cfg.buyIn : cfg.tournamentEntry;
  const startLabel = cfg.mode === 'cash' ? `买入 $${cfg.buyIn}` : `报名 $${cfg.tournamentEntry}`;
  const updateConfig = (patch: Partial<typeof cfg>) => g.setSessionConfig(prev => ({ ...prev, ...patch }));

  return (
    <div className="w-full h-screen intro-gradient text-slate-100 flex items-center justify-center overflow-hidden relative px-6">
      <div className="z-10 w-full max-w-6xl grid grid-cols-[1fr_400px] gap-8 items-center">
        <div>
          <div className="w-20 h-20 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 glow-blue">
          <Brain className="w-10 h-10" />
        </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
          决策沙盘 <span className="shimmer-text">Pro</span>
        </h1>
          <p className="text-base text-slate-400 mb-8 leading-relaxed max-w-xl">
            一边打牌，一边把胜率、底池赔率、位置、筹码深度讲明白。
            术语保留，但会翻译成人话，不把你扔进公式池里游泳。
        </p>

          <div className="grid grid-cols-3 gap-4 mb-8 max-w-2xl">
          <div className="feature-card">
              <div className="text-xl mb-1">EV</div>
              <div className="text-[10px] font-bold text-white">技术含量</div>
              <div className="text-[9px] text-slate-500">赢面、Outs、赔率都说清</div>
          </div>
          <div className="feature-card">
              <div className="text-xl mb-1">💼</div>
              <div className="text-[10px] font-bold text-white">现金局账户</div>
              <div className="text-[9px] text-slate-500">买入、离桌、账本都保留</div>
          </div>
          <div className="feature-card">
              <div className="text-xl mb-1">🏆</div>
              <div className="text-[10px] font-bold text-white">锦标赛</div>
              <div className="text-[9px] text-slate-500">报名费、起始码、盲注升级</div>
          </div>
        </div>

          <div className="flex gap-3 text-[10px] flex-wrap">
          <div className="intro-character">🔥 王大炮 <span className="text-slate-600">· 激进派</span></div>
          <div className="intro-character">🛡️ 李稳妥 <span className="text-slate-600">· 稳如泰山</span></div>
          <div className="intro-character">👀 赵跟风 <span className="text-slate-600">· 爱跟注</span></div>
          <div className="intro-character">⚡ 陈算师 <span className="text-slate-600">· 算牌高手</span></div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">开局设置</div>
              <div className="text-lg font-black text-white">选一张桌子坐下</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">积分账户</div>
              <div className="text-xl font-mono font-black text-emerald-400">${g.account.balance}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {([
              ['cash', '现金局', '每次买入上桌，离桌按桌上筹码结算'],
              ['tournament', '锦标赛', '付报名费，固定起始码，盲注会升级'],
            ] as const).map(([mode, title, desc]) => (
              <button key={mode} onClick={() => updateConfig({ mode })}
                className={`text-left p-3 rounded-xl border transition-colors ${cfg.mode === mode ? 'bg-blue-950/40 border-blue-500/50' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}>
                <div className="text-sm font-bold text-white">{title}</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {cfg.mode === 'cash' ? (
              <label className="intro-field">
                <span>买入额</span>
                <input type="number" min={200} step={100} value={cfg.buyIn}
                  onChange={e => updateConfig({ buyIn: Math.max(200, Number(e.target.value) || 200) })} />
              </label>
            ) : (
              <>
                <label className="intro-field">
                  <span>报名费</span>
                  <input type="number" min={50} step={50} value={cfg.tournamentEntry}
                    onChange={e => updateConfig({ tournamentEntry: Math.max(50, Number(e.target.value) || 50) })} />
                </label>
                <label className="intro-field">
                  <span>起始筹码</span>
                  <input type="number" min={500} step={100} value={cfg.tournamentStack}
                    onChange={e => updateConfig({ tournamentStack: Math.max(500, Number(e.target.value) || 500) })} />
                </label>
              </>
            )}
            <div className="grid grid-cols-3 gap-2">
              <label className="intro-field">
                <span>小盲</span>
                <input type="number" min={5} step={5} value={cfg.smallBlind}
                  onChange={e => updateConfig({ smallBlind: Math.max(5, Number(e.target.value) || 5) })} />
              </label>
              <label className="intro-field">
                <span>大盲</span>
                <input type="number" min={10} step={10} value={cfg.bigBlind}
                  onChange={e => updateConfig({ bigBlind: Math.max(10, Number(e.target.value) || 10) })} />
              </label>
              <label className="intro-field">
                <span>升级/手</span>
                <input type="number" min={2} step={1} value={cfg.handsPerLevel}
                  onChange={e => updateConfig({ handsPerLevel: Math.max(2, Number(e.target.value) || 2) })} />
              </label>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
            <div className="intro-metric"><span>本次成本</span><b>${startCost}</b></div>
            <div className="intro-metric"><span>账户风险</span><b>{g.bankrollAtRisk}%</b></div>
            <div className="intro-metric"><span>历史手数</span><b>{g.handHistory.length}</b></div>
          </div>

          <button disabled={!g.canStartSession} onClick={() => g.startSession()}
            className="action-btn mt-5 w-full h-12 inline-flex items-center justify-center font-black text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-all glow-blue active:scale-95 text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed">
            {g.canStartSession ? `开始：${startLabel}` : '账户余额不够'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>

          <div className="mt-3 flex gap-2">
            <button onClick={() => g.addPracticeCredits()} className="quick-bet-btn flex-1">补充练习积分</button>
            <button onClick={g.resetAccount} className="quick-bet-btn flex-1">重置账户</button>
            <button onClick={() => g.exportHistory('json')} className="quick-bet-btn flex-1">导出历史</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────
export default function App() {
  const g = usePokerGame();

  if (g.appMode === 'intro') {
    return <IntroScreen g={g} />;
  }

  if (!g.gameState) return null;
  const gs = g.gameState;
  const hero = g.hero;

  const seatPositions = [
    'absolute bottom-[-10px] left-1/2 -translate-x-1/2 scale-110 z-10',
    'absolute top-1/2 right-[-20px] -translate-y-1/2',
    'absolute top-1/2 left-[-20px] -translate-y-1/2',
    'absolute top-[-10px] left-[28%] -translate-x-1/2',
    'absolute top-[-10px] right-[28%] translate-x-1/2',
  ];

  const phaseLabels: Record<string, [string, string]> = {
    'pre-flop': ['翻前', '看看手里的牌值不值得上'],
    'flop': ['翻牌', '三张公共牌来了'],
    'turn': ['转牌', '第四张牌亮了'],
    'river': ['河牌', '最后一张牌，决定胜负'],
    'showdown': ['摊牌', '亮牌见真章'],
  };
  const [phaseTitle, phaseDesc] = phaseLabels[gs.phase] || ['等待中', ''];
  const winRate = g.sessionStats.handsPlayed ? Math.round((g.sessionStats.winCount / g.sessionStats.handsPlayed) * 100) : 0;
  const vpipRate = g.sessionStats.handsPlayed ? Math.round((g.sessionStats.vpipCount / g.sessionStats.handsPlayed) * 100) : 0;
  const showdownRate = g.sessionStats.handsPlayed ? Math.round((g.sessionStats.showdownCount / g.sessionStats.handsPlayed) * 100) : 0;
  const heroTournamentOut = g.activeSessionConfig.mode === 'tournament' && gs.isHandComplete && (hero?.stack ?? 0) <= 0;
  const actionMeta = getActionMeta(g.insight?.action);
  const activeOpponents = gs.players.filter(p => p.type === 'ai' && !p.isEliminated && !p.isFolded).length;
  const evLabel = g.insight
    ? (g.insight.action === 'Fold' ? '负EV · 控制损失' : 'EV可打 · 继续')
    : '--';
  const outsLabel = g.outsInfo?.totalOuts ? `${g.outsInfo.totalOuts} outs` : '无明显 outs';

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* ─── Header ─── */}
      <header className="h-12 border-b border-slate-800/80 bg-slate-900/95 flex items-center justify-between px-5 shrink-0 z-50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-black tracking-wider text-white uppercase">决策沙盘</span>
          </div>
          <div className="h-4 w-px bg-slate-700/60" />
          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            教练在线
          </div>
          <div className="h-4 w-px bg-slate-700/60" />
          <div className="text-[10px] text-amber-400 font-mono font-bold">第 {gs.roundNum} 局</div>
          <div className="text-[10px] text-slate-500 font-mono font-bold">
            {g.activeSessionConfig.mode === 'cash' ? '现金局' : `锦标赛 L${gs.blindLevel}`} · {gs.smallBlind}/{gs.bigBlind}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50 flex items-center gap-4 text-[10px] font-mono">
            <span className="text-slate-500">打了 <span className="text-blue-400 font-bold">{g.sessionStats.handsPlayed}</span> 局</span>
            <span className="text-slate-500">赢了 <span className="text-emerald-400 font-bold">{g.sessionStats.winCount}</span> 局</span>
            <span className="text-slate-500">本桌 <span className={hero && hero.stack >= g.sessionStats.startStack ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
              {hero ? (hero.stack - g.sessionStats.startStack > 0 ? '+' : '') + (hero.stack - g.sessionStats.startStack) : 0}
            </span></span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <Wallet className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-mono font-bold">${g.account.balance}</span>
          </div>
          <button onClick={() => g.setShowKnowledge(true)}
            className="flex items-center gap-1.5 text-[10px] bg-indigo-600/80 hover:bg-indigo-500 px-3 py-1.5 rounded-lg border border-indigo-500/50 transition-colors font-bold">
            <BookOpen className="w-3 h-3" /> 知识库
          </button>
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <Coins className="w-3 h-3 text-yellow-500" />
            <span className="text-xs font-mono font-bold">${hero?.stack ?? 0}</span>
          </div>
          <button onClick={g.leaveTable}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors">
            离桌
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 relative poker-table-bg overflow-hidden flex flex-col items-center justify-center">

          <div className="relative w-[740px] h-[340px] rounded-[170px] felt-surface flex flex-col items-center justify-center mt-6">
            {/* Pot */}
            <div className="text-center z-10 mb-6 relative">
              <div className="text-[9px] text-emerald-400/50 uppercase font-black tracking-[0.2em]">底池</div>
              <div className="text-3xl font-mono font-bold tracking-tighter text-white pot-value">${gs.pot}</div>
              {gs.sidePots.length > 1 && (
                <div className="text-[9px] text-amber-400/60 mt-0.5 font-mono">{gs.sidePots.length} 个边池</div>
              )}
            </div>

            {/* Community Cards */}
            <div className="flex gap-1.5 z-10">
              <AnimatePresence>
                {gs.communityCards.map((card, idx) => {
                  // Highlight community cards that are part of hero's best hand
                  const highlight = g.heroContribution?.communityUsed[idx] ? 'gold' as const : 'none' as const;
                  return (
                    <CardComponent key={`cc-${idx}-${card.rank}-${card.suit}`} card={card} highlight={highlight} />
                  );
                })}
              </AnimatePresence>
              {Array.from({ length: 5 - gs.communityCards.length }).map((_, i) => (
                <div key={`slot-${i}`} className="w-[52px] h-[74px] rounded-lg border border-dashed border-emerald-800/30 bg-black/15" />
              ))}
            </div>

            {/* Phase indicator + Runout banner */}
            <div className="mt-4 z-10 text-center">
              {gs.isRunout ? (
                <div className="runout-banner">
                  <span className="runout-banner-dot" />
                  <span>ALL-IN · {phaseTitle} ─ 正在发牌…</span>
                </div>
              ) : (
                <span className="phase-badge-table text-slate-300 font-mono">{phaseTitle}</span>
              )}
              <div className="text-[8px] text-slate-500 mt-1 font-medium">{phaseDesc}</div>
            </div>

            {/* Player Seats */}
            <div className="absolute inset-[-70px] pointer-events-none z-20">
              {gs.players.map((player, idx) => {
                const handInfo = g.playerHandInfos.find(h => h.playerId === player.id);
                return (
                  <div key={player.id} className={`pointer-events-auto ${seatPositions[idx]}`}>
                    <PlayerSeat
                      player={player}
                      isCurrent={gs.currentTurnIdx === idx && !gs.isHandComplete}
                      isDealer={idx === gs.dealerIdx}
                      isThinkingFold={player.type === 'human' && g.isHeroFolding}
                      gameState={gs}
                      handInfo={handInfo}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Right Panel ─── */}
        <aside className="w-[360px] bg-slate-900/95 border-l border-slate-800/80 flex flex-col shrink-0 overflow-hidden z-10 backdrop-blur-sm min-h-0">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-800 bg-slate-950/60">
            {([
              ['coach', '🎯 AI教练', 'text-blue-400 border-blue-500 bg-blue-950/30'],
              ['review', '📊 复盘', 'text-amber-400 border-amber-500 bg-amber-950/30'],
              ['stats', '📈 统计', 'text-emerald-400 border-emerald-500 bg-emerald-950/30'],
              ['history', '🗂 历史', 'text-indigo-400 border-indigo-500 bg-indigo-950/30'],
              ['log', '📝 日志', 'text-emerald-400 border-emerald-500 bg-emerald-950/30'],
            ] as const).map(([key, label, activeClass]) => (
              <button key={key} onClick={() => g.setPanelTab(key)}
                className={`flex-1 py-2.5 text-[10px] font-bold tracking-wide transition-colors
                  ${g.panelTab === key ? `${activeClass} border-b-2` : 'text-slate-600 hover:text-slate-400'}`}>
                {label}
                {key === 'review' && g.isReviewing && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1" />}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar scroll-fade-container p-4 flex flex-col gap-3">
            {/* ── Coach Tab ── */}
            {g.panelTab === 'coach' && (
              <>
                {/* Header: 阶段 + 建议行动 */}
                <div className="coach-compact-header">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center ring-1 ring-blue-500/20">
                      <Brain className="w-3 h-3 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-[11px] text-white leading-tight">实时决策教练</h2>
                      <span className="phase-badge mt-0.5">{gs.phase === 'pre-flop' ? '翻牌前' : gs.phase === 'flop' ? '翻牌' : gs.phase === 'turn' ? '转牌' : gs.phase === 'river' ? '河牌' : '等待'}</span>
                    </div>
                  </div>
                  <div className={`coach-action-pill ${actionMeta.tone}`}>
                    <span>{actionMeta.label}</span>
                    <small>{actionMeta.note}</small>
                  </div>
                </div>

                {/* AI Opponent Roster */}
                <details className="ai-roster ai-roster-compact">
                  <summary className="ai-roster-summary">
                    <span>对手情报</span>
                    <b>{activeOpponents} 人活跃</b>
                  </summary>
                  <div className="ai-roster-scroll">
                    {gs.players.filter(p => p.type === 'ai').map(p => {
                      const emoji = p.personality === 'aggressive' ? '🔥' : p.personality === 'rock' ? '🛡️' : p.personality === 'calling' ? '👀' : '⚡';
                      const styleLabel = p.personality === 'aggressive' ? '激进派' : p.personality === 'rock' ? '稳如泰山' : p.personality === 'calling' ? '爱跟注' : '算牌高手';
                      const statusClass = p.isEliminated || p.isFolded ? 'ai-card-folded' : p.isAllIn ? 'ai-card-allin' : 'ai-card-active';
                      const statusText = p.isEliminated ? '出局' : p.isFolded ? '已弃牌' : p.isAllIn ? 'ALL-IN' : '活跃';
                      return (
                        <div key={p.id} className={`ai-card ${statusClass}`}>
                          <div className="text-base leading-none">{emoji}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-slate-200 truncate">{p.name}</div>
                            <div className="text-[8px] text-slate-500">{styleLabel}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-mono font-bold text-slate-300">${p.stack}</div>
                            <div className={`text-[7px] font-bold uppercase ${p.isEliminated || p.isFolded ? 'text-slate-600' : p.isAllIn ? 'text-red-400' : 'text-emerald-500'}`}>{statusText}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>

                {/* Metrics Bar */}
                {hero && !hero.isFolded && (() => {
                  const spr = gs.pot > 0 ? (hero.stack / gs.pot).toFixed(1) : '∞';
                  const preFlopTier = g.heroPreFlop?.tier;
                  // 从preFlopTier提取等级字母
                  const tierLetter = preFlopTier ? preFlopTier.charAt(0) : null;
                  const hasCommunity = gs.communityCards.length > 0;
                  const handName = g.heroEval?.name || '--';
                  const outsLabel = g.outsInfo?.totalOuts
                    ? `${g.outsInfo.totalOuts}张(${g.outsInfo.turnOdds}%)`
                    : (g.outsInfo?.description || '--');
                  return (
                    <>
                      {/* 翻牌前：显示底牌等级 */}
                      {!hasCommunity && tierLetter && (
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[9px] text-slate-500 font-bold">底牌等级</span>
                          <span className={`tier-badge tier-${tierLetter}`}>{preFlopTier}</span>
                          <span className="text-[9px] text-slate-600 truncate">{g.heroPreFlop?.description}</span>
                        </div>
                      )}
                      {/* 翻牌后：显示当前牌型 */}
                      {hasCommunity && (
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[9px] text-slate-500 font-bold">当前牌型</span>
                          <span className="text-[10px] font-bold text-emerald-400">{handName}</span>
                          {g.outsInfo?.totalOuts ? (
                            <>
                              <span className="text-[9px] text-slate-600">·</span>
                              <span className="text-[9px] text-blue-400">{g.outsInfo.description}</span>
                            </>
                          ) : null}
                        </div>
                      )}
                      <div className="coach-metrics-bar">
                        <div className="coach-metric-card">
                          <span className="metric-label">牌力</span>
                          <span className="metric-value">{hasCommunity ? handName : (preFlopTier || '--')}</span>
                        </div>
                        <div className="coach-metric-card">
                          <span className="metric-label">SPR</span>
                          <span className="metric-value">{spr}</span>
                        </div>
                        <div className="coach-metric-card">
                          <span className="metric-label">赔率</span>
                          <span className="metric-value">{g.callCost > 0 ? g.potOddsInfo?.description.replace('才能盈利跟注', '') : '免费'}</span>
                        </div>
                        <div className="coach-metric-card">
                          <span className="metric-label">Outs</span>
                          <span className="metric-value">{outsLabel}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* AI Insight */}
                <div className="coach-insight-panel custom-scrollbar">
                  <div className="coach-insight-title">
                    <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> 教练分析
                    </span>
                    {g.isInsightLoading && <span className="text-[9px] text-blue-400 animate-pulse font-mono">琢磨中...</span>}
                  </div>
                  <div className="p-3">
                    {g.insight ? (
                      <div className="space-y-2">
                        {/* 核心结论条：行动 + 赢面 */}
                        <div className="coach-verdict-bar">
                          <div className="coach-verdict-action">
                            <span className={`coach-verdict-pill ${actionMeta.tone}`}>{actionMeta.label}</span>
                            <span className="text-[9px] text-slate-500 truncate">{actionMeta.note}</span>
                          </div>
                          <div className="coach-verdict-equity">
                            <span className="text-[9px] text-slate-500 shrink-0">赢面</span>
                            <span className="text-[11px] font-mono font-black text-blue-400 line-clamp-2">{g.insight.equity}</span>
                          </div>
                        </div>

                        {/* 打法计划 */}
                        <div className="coach-primary-card">
                          <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">打法计划</div>
                          <InsightList text={g.insight.advice} limit={4} />
                        </div>

                        {/* 盘面拆解 */}
                        <div className="insight-block insight-block-poker">
                          <div className="text-[9px] font-bold text-amber-400 mb-1">盘面拆解</div>
                          <InsightList text={g.insight.reasoning} limit={4} />
                        </div>

                        {/* Outs */}
                        {g.insight.outsInfo && g.insight.outsInfo.length > 0 && (
                          <div className="insight-block insight-block-outs">
                            <div className="text-[9px] font-bold text-emerald-400 mb-1">补牌信息</div>
                            <InsightList text={g.insight.outsInfo} limit={3} />
                          </div>
                        )}

                        {/* 商业洞察 */}
                        <div className="insight-block insight-block-business">
                          <div className="text-[9px] font-bold text-indigo-400 mb-1">商业洞察</div>
                          <InsightList text={g.insight.businessAnalogy} limit={5} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 py-8">
                        <Target className="w-6 h-6 mb-2 opacity-40" />
                        <span className="text-[10px] text-center px-4">等轮到你出手时，教练会过来支招</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Review Tab ── */}
            {g.panelTab === 'review' && (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/20">
                    <Trophy className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-xs text-white">聊聊这局打得怎么样</h2>
                    <div className="text-[9px] text-slate-500 font-mono">赛后复盘 · 帮你总结经验</div>
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex-1 overflow-y-auto custom-scrollbar min-h-[200px]">
                  {g.isReviewing ? (
                    <div className="flex flex-col items-center justify-center h-full text-amber-500/50 text-xs font-mono gap-2">
                      <span className="spinner" />
                      教练正在回顾这局...
                    </div>
                  ) : g.reviewResult ? (
                    <div className="review-prose"><Markdown>{g.reviewResult}</Markdown></div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs text-center px-4 gap-2">
                      <BarChart3 className="w-6 h-6 opacity-30" />
                      打完一局后，教练会自动帮你复盘总结
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Stats Tab ── */}
            {g.panelTab === 'stats' && (
              <div className="flex flex-col gap-3 min-h-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/20">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-xs text-white">本桌细分统计</h2>
                    <div className="text-[9px] text-slate-500 font-mono">不是玄学，先看账和频率</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['胜率', `${winRate}%`, 'text-emerald-400'],
                    ['VPIP', `${vpipRate}%`, 'text-blue-400'],
                    ['摊牌率', `${showdownRate}%`, 'text-amber-400'],
                    ['最大底池', `$${g.sessionStats.biggestPot}`, 'text-purple-400'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="stat-tile">
                      <span>{label}</span>
                      <b className={color}>{value}</b>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <ClipboardList className="w-3 h-3" /> 行动频率
                  </div>
                  {[
                    ['弃牌', g.sessionStats.foldCount],
                    ['跟注', g.sessionStats.callCount],
                    ['加注', g.sessionStats.raiseCount],
                    ['All-in', g.sessionStats.allInCount],
                  ].map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono font-bold text-slate-200">{count}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Landmark className="w-3 h-3" /> 账户与桌子
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    当前是 <span className="text-white font-bold">{g.activeSessionConfig.mode === 'cash' ? '现金局' : '锦标赛'}</span>。
                    现金局的核心不是“每把都赢”，而是让买入额占总账户比例别太夸张；
                    锦标赛则要盯住盲注升级，因为 M 值会被时间吃掉。
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="intro-metric"><span>账户余额</span><b>${g.account.balance}</b></div>
                    <div className="intro-metric"><span>本桌盈亏</span><b className={hero && hero.stack >= g.sessionStats.startStack ? 'text-emerald-400' : 'text-red-400'}>{hero ? hero.stack - g.sessionStats.startStack : 0}</b></div>
                    <div className="intro-metric"><span>累计买入</span><b>${g.account.totalBuyIns}</b></div>
                    <div className="intro-metric"><span>累计结算</span><b>${g.account.totalCashouts}</b></div>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">最近账本</div>
                  <div className="space-y-1.5">
                    {g.account.ledger.slice(0, 6).map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-slate-400 truncate">{item.note}</span>
                        <span className={`font-mono font-bold ${item.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.amount >= 0 ? '+' : ''}{item.amount}
                        </span>
                      </div>
                    ))}
                    {g.account.ledger.length === 0 && <div className="text-[11px] text-slate-600">还没有账本记录。</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── History Tab ── */}
            {g.panelTab === 'history' && (
              <div className="flex flex-col h-full min-h-0 gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center ring-1 ring-indigo-500/20">
                      <History className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-xs text-white">历史复盘</h2>
                      <div className="text-[9px] text-slate-500 font-mono">倒序查看 · 支持导出</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => g.exportHistory('json')} className="icon-tool-btn" title="导出 JSON"><Download className="w-3 h-3" /></button>
                    <button onClick={() => g.exportHistory('csv')} className="icon-tool-btn" title="导出 CSV"><ClipboardList className="w-3 h-3" /></button>
                    <button onClick={g.clearHistory} className="icon-tool-btn" title="清空历史"><RotateCcw className="w-3 h-3" /></button>
                  </div>
                </div>

                <div className="history-list custom-scrollbar">
                  {g.handHistory.map(record => (
                    <button key={record.id} onClick={() => g.setSelectedHistoryId(record.id)}
                      className={`history-item ${g.selectedHistoryId === record.id ? 'history-item-active' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-200">第 {record.roundNum} 局 · {record.heroHand || '未亮牌'}</span>
                        <span className={`font-mono font-bold ${record.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {record.net >= 0 ? '+' : ''}{record.net}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1 truncate">{record.board || '翻前结束'} · {record.handName}</div>
                    </button>
                  ))}
                  {g.handHistory.length === 0 && (
                    <div className="h-28 flex items-center justify-center text-[11px] text-slate-600 border border-dashed border-slate-800 rounded-xl">
                      打完一手牌后，这里会自动存档。
                    </div>
                  )}
                </div>

                {g.selectedHistory && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 overflow-y-auto custom-scrollbar min-h-[180px]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold text-indigo-400">第 {g.selectedHistory.roundNum} 局复盘</div>
                      <div className="text-[9px] text-slate-500">{g.selectedHistory.mode === 'cash' ? '现金局' : '锦标赛'} · {g.selectedHistory.blinds}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                      <div className="intro-metric"><span>手牌</span><b>{g.selectedHistory.heroHand || '--'}</b></div>
                      <div className="intro-metric"><span>底池</span><b>${g.selectedHistory.potSize}</b></div>
                      <div className="intro-metric"><span>牌型</span><b>{g.selectedHistory.handName}</b></div>
                      <div className="intro-metric"><span>净值</span><b className={g.selectedHistory.net >= 0 ? 'text-emerald-400' : 'text-red-400'}>{g.selectedHistory.net >= 0 ? '+' : ''}{g.selectedHistory.net}</b></div>
                    </div>
                    {g.selectedHistory.review ? (
                      <div className="review-prose"><Markdown>{g.selectedHistory.review}</Markdown></div>
                    ) : (
                      <div className="text-[11px] text-slate-600">复盘正在生成，稍等它把这手牌嚼完。</div>
                    )}
                    <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
                      {g.selectedHistory.log.slice(-8).map((line, idx) => (
                        <div key={idx} className="text-[9px] text-slate-500 font-mono leading-relaxed">{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Log Tab ── */}
            {g.panelTab === 'log' && (
              <div className="flex flex-col h-full min-h-0">
                <div className="text-[9px] uppercase font-bold text-slate-500 mb-2 tracking-widest">牌局日志</div>
                <div className="flex-1 bg-slate-950/80 rounded-xl p-3 font-mono text-[9px] border border-slate-800 overflow-y-auto custom-scrollbar space-y-1.5">
                  {gs.handLog.map((log, i) => (
                    <div key={i} className={`flex gap-2 ${
                      log.type === 'result' ? 'text-yellow-400 font-bold' :
                      log.type === 'hand-update' ? 'text-cyan-400/80' :
                      log.type === 'system' ? 'text-emerald-500/60' : 'text-slate-400'
                    }`}>
                      <span className="shrink-0">{log.type === 'result' ? '🏆' : log.type === 'hand-update' ? '📊' : log.type === 'system' ? '▸' : '•'}</span>
                      <span className="leading-relaxed">{log.msg}</span>
                    </div>
                  ))}
                  {g.canAct && <div className="text-amber-400 animate-pulse mt-1 pt-1 border-t border-slate-800/50">⏳ 等待您的行动...</div>}
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* ─── Data Strip (compact metrics bar) ─── */}
      {hero && !hero.isFolded && gs.phase !== 'idle' && (
        <div className="data-strip shrink-0 z-40">
          <div className="data-strip-item">
            <span className="data-strip-icon">📊</span>
            <span className="data-strip-label">赢面</span>
            <span className="data-strip-value text-blue-400">{g.insight?.equity || '--'}</span>
          </div>
          <div className="data-strip-divider" />
          <div className="data-strip-item">
            <span className="data-strip-icon">💰</span>
            <span className="data-strip-label">赔率</span>
            <span className="data-strip-value text-amber-400">{g.potOddsInfo?.description || '免费看牌'}</span>
          </div>
          <div className="data-strip-divider" />
          <div className="data-strip-item">
            <span className="data-strip-icon">📈</span>
            <span className="data-strip-label">EV判断</span>
            <span className="data-strip-value text-emerald-400">{evLabel}</span>
          </div>
          <div className="data-strip-divider" />
          <div className="data-strip-item">
            <span className="data-strip-icon">🎯</span>
            <span className="data-strip-label">Outs</span>
            <span className="data-strip-value text-purple-400">{outsLabel}</span>
            <span className="data-strip-desc">{g.outsInfo?.description || '暂无补牌信息'}</span>
          </div>
        </div>
      )}

      {/* ─── Footer Controls ─── */}
      <footer className="h-[72px] bg-slate-900/95 border-t border-slate-800/80 flex items-center px-5 gap-4 shrink-0 z-50 backdrop-blur-sm">
        <div className="flex-1 flex gap-3">
          <button disabled={!g.canAct} onClick={g.heroFold}
            className="action-btn flex-1 max-w-[140px] bg-slate-800 hover:bg-slate-700 h-12 rounded-xl text-sm uppercase text-slate-300 border border-slate-700/50 flex flex-col items-center justify-center leading-none">
            <span>{g.isHeroFolding ? '思考弃牌' : '弃牌'}</span><span className="text-[8px] text-slate-500 mt-0.5">{g.isHeroFolding ? 'Thinking' : 'Fold'}</span>
          </button>
          <button disabled={!g.canAct} onClick={g.callCost === 0 ? g.heroCheck : g.heroCall}
            className="action-btn flex-1 max-w-[180px] bg-blue-600 hover:bg-blue-500 h-12 rounded-xl text-sm uppercase text-white border border-blue-500/50 glow-blue flex flex-col items-center justify-center leading-none">
            <span>{g.callCost === 0 ? '过牌' : (hero && hero.stack <= g.callCost ? '全下' : `跟注 $${g.callCost}`)}</span>
            <span className="text-[8px] text-blue-200 mt-0.5">{g.callCost === 0 ? 'Check' : (hero && hero.stack <= g.callCost ? 'All-In' : 'Call')}</span>
          </button>
          <button disabled={!g.canAct || (hero?.stack || 0) <= g.callCost} onClick={g.heroRaise}
            className="action-btn flex-1 max-w-[180px] bg-emerald-600 hover:bg-emerald-500 h-12 rounded-xl text-sm uppercase text-white border border-emerald-500/50 glow-green flex flex-col items-center justify-center leading-none">
            <span>加注 ${g.raiseAmount}</span><span className="text-[8px] text-emerald-200 mt-0.5">Raise</span>
          </button>
          <button disabled={!g.canAct} onClick={g.heroAllIn}
            className="action-btn w-24 bg-red-700 hover:bg-red-600 h-12 rounded-xl text-xs uppercase text-white border border-red-600/50 glow-red flex flex-col items-center justify-center leading-none">
            <span className="font-black">ALL IN</span>
          </button>
        </div>

        {/* Raise Slider */}
        <div className="w-64 bg-slate-950/80 rounded-xl h-12 flex items-center px-3 border border-slate-800 gap-2">
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">加注额</span>
          <input type="range"
            min={g.minRaiseTotal} max={g.maxRaiseTotal} step={10}
            value={g.raiseAmount}
            onChange={e => g.setRaiseAmount(Number(e.target.value))}
            className="flex-1 cursor-pointer" />
          <span className="text-[10px] font-mono font-bold text-blue-400 w-14 text-right">${g.raiseAmount}</span>
        </div>

        {/* Quick bet buttons */}
        <div className="flex gap-1.5">
          {[
            { label: '½底池', fraction: 0.5 },
            { label: '¾底池', fraction: 0.75 },
            { label: '满池', fraction: 1 },
          ].map(qb => {
            const amt = Math.max(g.minRaiseTotal, Math.floor(gs.pot * qb.fraction + gs.currentBet));
            return (
              <button key={qb.label} onClick={() => g.setRaiseAmount(Math.min(amt, g.maxRaiseTotal))}
                className="quick-bet-btn">{qb.label}</button>
            );
          })}
        </div>
      </footer>

      {/* ─── Showdown Overlay ─── */}
      <AnimatePresence>
        {gs.isHandComplete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}
              className="bg-slate-900/95 border border-yellow-500/20 p-8 rounded-2xl glow-gold text-center flex flex-col items-center w-full max-w-md result-panel"
            >
              <div className="w-14 h-14 bg-yellow-500/15 text-yellow-400 rounded-xl flex items-center justify-center mb-5 border border-yellow-500/30">
                <Trophy className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-widest">本局结束</h2>
              <div className="text-[10px] text-slate-500 mb-4">{gs.winners.some(w => gs.players.find(p => p.id === w.playerId)?.type === 'human') ? '🎉 漂亮！这把打得不错' : '💪 没关系，下局再来'}</div>
              <div className="space-y-2 mb-6 w-full">
                {gs.winners.map((w, i) => {
                  const p = gs.players.find(p => p.id === w.playerId);
                  const isHero = p?.type === 'human';
                  return (
                    <div key={i} className={`text-sm py-2 px-4 rounded-lg ${isHero ? 'bg-emerald-950/30 border border-emerald-800/30' : 'bg-slate-800/50'}`}>
                      <span className={isHero ? 'text-emerald-400 font-bold' : 'text-yellow-400 font-bold'}>{p?.name}</span>
                      {' '}以 <span className="text-white font-mono">{w.handName}</span> 赢得{' '}
                      <span className="text-white font-bold font-mono">${w.amount}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => { g.setPanelTab('review'); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-sm border border-slate-700 transition-colors">
                  看看教练怎么说
                </button>
                <button onClick={heroTournamentOut || gs.isSessionComplete ? g.leaveTable : g.nextHand}
                  className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-slate-900 font-black py-3 rounded-xl text-sm tracking-wider uppercase transition-all active:scale-95">
                  {heroTournamentOut || gs.isSessionComplete ? '回大厅' : '再来一局 →'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Knowledge Modal ─── */}
      <AnimatePresence>
        {g.showKnowledge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <KnowledgeModal
              onClose={() => g.setShowKnowledge(false)}
              onStartScenario={(s) => { g.startSession(s); g.setShowKnowledge(false); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

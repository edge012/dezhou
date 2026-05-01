import { Coins, Shield, Flame, Eye, Zap } from 'lucide-react';
import { type Player, type GameState, type PlayerHandInfo, getPlayerPosition } from '../engine/gameEngine';
import { HandRank } from '../engine/poker';
import CardComponent from './CardComponent';

interface Props {
  player: Player;
  isCurrent: boolean;
  isThinkingFold?: boolean;
  isDealer?: boolean;
  gameState: GameState;
  handInfo?: PlayerHandInfo;
}

const PERSONALITY_ICONS: Record<string, { icon: typeof Shield; color: string; label: string; desc: string }> = {
  rock: { icon: Shield, color: 'text-slate-400', label: '岩石', desc: '老谋深算，不见兔子不撒鹰' },
  calling: { icon: Eye, color: 'text-purple-400', label: '跟注站', desc: '优柔寡断，总想再看一张牌' },
  aggressive: { icon: Flame, color: 'text-orange-400', label: '激进派', desc: '雷厉风行，信奉进攻就是最好的防守' },
  pro: { icon: Zap, color: 'text-cyan-400', label: '职业', desc: '冷静理性，每一步都有数学支撑' },
};

function getHandRankColor(rank: HandRank): string {
  if (rank >= HandRank.STRAIGHT_FLUSH) return 'text-yellow-300 bg-yellow-500/20 border-yellow-500/40';
  if (rank >= HandRank.FULL_HOUSE) return 'text-amber-300 bg-amber-500/20 border-amber-500/40';
  if (rank >= HandRank.STRAIGHT) return 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
  if (rank >= HandRank.TWO_PAIR) return 'text-blue-300 bg-blue-500/20 border-blue-500/40';
  if (rank >= HandRank.PAIR) return 'text-slate-300 bg-slate-500/20 border-slate-500/40';
  return 'text-slate-400 bg-slate-700/30 border-slate-600/30';
}

export default function PlayerSeat({ player, isCurrent, isThinkingFold, gameState, handInfo }: Props) {
  const isHuman = player.type === 'human';
  // Show cards if: human player, OR showdown, OR runout mode (all-in reveal)
  const showCards = isHuman || (gameState.phase === 'showdown' && !player.isFolded) || (gameState.showAllCards && !player.isFolded);
  const pos = getPlayerPosition(gameState, player.seatIndex);
  const personality = player.personality ? PERSONALITY_ICONS[player.personality] : null;
  const PersonalityIcon = personality?.icon;

  // Determine card highlights
  const getCardHighlight = (cardIdx: number): 'gold' | 'blue' | 'none' => {
    if (!handInfo) return 'none';
    if (handInfo.holeUsed[cardIdx]) return 'gold';
    return 'none';
  };

  return (
    <div className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${player.isFolded || player.isEliminated ? 'seat-folded' : ''} ${isThinkingFold ? 'seat-thinking-fold' : ''} ${isHuman ? 'hero-seat-glow' : ''}`}>
      {/* Player Info Box */}
      <div className={`relative rounded-xl p-2.5 w-[124px] transition-all duration-300 border
        ${isCurrent
          ? 'glass-panel border-yellow-500/60 active-turn-ring'
          : isHuman
            ? 'glass-panel border-blue-500/30'
            : 'glass-panel border-slate-700/50'
        }
        ${player.isAllIn && !player.isFolded ? 'border-red-500/50' : ''}
      `}>
        {isThinkingFold && (
          <div className="fold-thinking-badge">
            <span className="fold-thinking-dot" />
            控制损失
          </div>
        )}
        {/* Name & Position */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 min-w-0 group/name relative cursor-help">
            {PersonalityIcon && (
              <>
                <PersonalityIcon className={`w-3 h-3 shrink-0 ${personality?.color}`} />
                {/* Personality Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[120px] bg-slate-800 text-slate-200 text-[9px] px-2 py-1 rounded opacity-0 group-hover/name:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700 whitespace-pre-wrap text-center">
                  <div className={`font-bold mb-0.5 ${personality.color}`}>{personality.label}</div>
                  <div>{personality.desc}</div>
                </div>
              </>
            )}
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight truncate">
              {isHuman ? '你' : player.name}
            </span>
          </div>
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold shrink-0
            ${pos === 'BTN' ? 'bg-yellow-600/90 text-yellow-100 border border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.4)]' :
              pos === 'SB' ? 'bg-slate-600/80 text-slate-200' :
              pos === 'BB' ? 'bg-blue-600/60 text-blue-200' :
              'bg-slate-700/60 text-slate-400'}`
          }>
            {pos === 'BTN' ? '庄家(BTN)' : pos === 'SB' ? '小盲(SB)' : pos === 'BB' ? '大盲(BB)' : pos === 'UTG' ? '枪口(UTG)' : '关煞(CO)'}
          </span>
        </div>
        {/* Stack */}
        <div className={`text-sm font-mono font-bold leading-none ${player.stack <= 0 ? 'text-red-400' : 'text-white'}`}>
          ${player.stack}
        </div>
        {isThinkingFold && (
          <div className="text-[8px] font-bold text-amber-300 mt-0.5 uppercase tracking-wider">思考弃牌中</div>
        )}
        {player.isAllIn && !player.isFolded && (
          <div className="text-[8px] font-black text-red-400 mt-0.5 uppercase tracking-widest animate-pulse">ALL-IN</div>
        )}
        {player.isEliminated && (
          <div className="text-[8px] font-bold text-slate-600 mt-0.5 uppercase tracking-wider">已出局</div>
        )}
        {!player.isEliminated && player.isFolded && (
          <div className="text-[8px] font-bold text-slate-600 mt-0.5 uppercase tracking-wider">已弃牌</div>
        )}

        {/* Hand info display during runout/showdown */}
        {handInfo && showCards && !player.isFolded && !player.isEliminated && gameState.communityCards.length >= 3 && (
          <div className="mt-1.5 space-y-0.5">
            <div className={`hand-rank-badge ${getHandRankColor(handInfo.rank)}`}>
              {handInfo.name}
            </div>
            {handInfo.draws.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {handInfo.draws.slice(0, 2).map((draw, i) => (
                  <div key={i} className="draw-info-badge">
                    {draw.name}{draw.outs > 0 ? ` ${draw.outs}张` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex gap-0.5 h-[54px] items-center">
        {!player.isEliminated && !player.isFolded && player.cards.length > 0 && (
          player.cards.map((card, idx) => (
            <CardComponent
              key={`${card.suit}-${card.rank}-${idx}`}
              card={card}
              hidden={!showCards}
              small={!isHuman}
              highlight={showCards && handInfo ? getCardHighlight(idx) : 'none'}
            />
          ))
        )}
      </div>

      {/* Current Round Bet */}
      {player.bet > 0 && (
        <div className="chip-animate flex items-center gap-1 bg-slate-950/90 px-2 py-0.5 rounded-full border border-slate-700/50 text-[10px] font-mono font-bold text-yellow-400">
          <Coins className="w-2.5 h-2.5" />${player.bet}
        </div>
      )}
    </div>
  );
}

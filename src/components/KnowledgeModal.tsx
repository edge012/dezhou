import { Target, Briefcase, TrendingUp } from 'lucide-react';
import { STARTING_HANDS, CLASSIC_SCENARIOS, BUSINESS_CONCEPTS, ODDS_TABLE, POSITION_GUIDE } from '../engine/knowledgeBase';
import { useState } from 'react';

interface Props {
  onClose: () => void;
  onStartScenario: (scenario: string) => void;
}

export default function KnowledgeModal({ onClose, onStartScenario }: Props) {
  const [tab, setTab] = useState<'hands' | 'scenarios' | 'business' | 'odds'>('hands');

  const tabBtn = (key: typeof tab, label: string, color: string) => (
    <button
      onClick={() => setTab(key)}
      className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors ${
        tab === key ? `${color} text-white` : 'text-slate-400 hover:bg-slate-800'
      }`}
    >{label}</button>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex gap-2">
            {tabBtn('hands', '起手牌表', 'bg-emerald-600')}
            {tabBtn('scenarios', '经典局型', 'bg-indigo-600')}
            {tabBtn('business', '商业决策论', 'bg-amber-600')}
            {tabBtn('odds', '概率 & 位置', 'bg-blue-600')}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 text-lg">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">

          {/* ======== 起手牌 ======== */}
          {tab === 'hands' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="text-emerald-400 w-5 h-5" /> 起手底牌分级与胜率
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {STARTING_HANDS.map((h, i) => (
                  <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start gap-3">
                    <div className={`text-lg font-mono font-black w-14 text-center py-1 rounded-lg
                      ${h.tier === 'S' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        h.tier === 'A' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        h.tier === 'B' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-slate-700/30 text-slate-400 border border-slate-600/30'}`}
                    >{h.hand}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-slate-500">{h.tier}级</span>
                        <span className="text-[10px] font-mono text-emerald-400">胜率 {h.winRate}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{h.note}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 训练场景 */}
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-8">
                <Target className="text-indigo-400 w-5 h-5" /> 专属训练场景
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'sunk-cost', title: '沉没成本陷阱', desc: '手持72o，已投入大量筹码，如何果断止损？' },
                  { id: 'info-gap', title: '信息不对称 (AA)', desc: '手持AA，如何最大化提取价值？' },
                  { id: 'ev', title: 'EV期望值 (同花听牌)', desc: 'K♦9♦ 面对下注，赔率是否足够？' },
                ].map(s => (
                  <button key={s.id} onClick={() => onStartScenario(s.id)}
                    className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-indigo-500 transition-all text-left group">
                    <div className="font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">{s.title}</div>
                    <div className="text-xs text-slate-400">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ======== 经典局型 ======== */}
          {tab === 'scenarios' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">经典局型与高级策略</h3>
              {CLASSIC_SCENARIOS.map(s => (
                <div key={s.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase
                      ${s.difficulty === '核心' ? 'bg-yellow-500/20 text-yellow-400' :
                        s.difficulty === '入门' ? 'bg-emerald-500/20 text-emerald-400' :
                        s.difficulty === '中级' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-red-500/20 text-red-400'}`}
                    >{s.difficulty}</span>
                    <span className="text-[9px] text-slate-500 font-mono">{s.category}</span>
                  </div>
                  <h4 className="font-bold text-white mb-1">{s.title}</h4>
                  <p className="text-xs text-slate-400 mb-2 leading-relaxed">{s.description}</p>
                  <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-lg p-3 mb-2">
                    <div className="text-[10px] font-bold text-emerald-400 mb-1">📌 策略指引</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{s.strategy}</p>
                  </div>
                  <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-amber-400 mb-1">💼 商业投射</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{s.businessMapping}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ======== 商业决策 ======== */}
          {tab === 'business' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <Briefcase className="w-5 h-5" /> 扑克与商业的底层逻辑
              </h3>
              {BUSINESS_CONCEPTS.map(b => (
                <div key={b.id} className="bg-amber-950/15 border border-amber-900/30 p-5 rounded-xl">
                  <h4 className="text-base font-bold text-white mb-1">{b.title}</h4>
                  <div className="text-[10px] text-amber-500 font-mono mb-2">扑克类比: {b.pokerAnalogy}</div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-2">{b.description}</p>
                  <div className="bg-slate-950/50 rounded-lg p-3 mb-2">
                    <div className="text-[10px] font-bold text-emerald-400 mb-1">实战应用</div>
                    <p className="text-xs text-slate-400 leading-relaxed">{b.application}</p>
                  </div>
                  {b.caseStudy && (
                    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                      <div className="text-[10px] font-bold text-amber-400 mb-1">📖 商业案例</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{b.caseStudy}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ======== 概率 & 位置 ======== */}
          {tab === 'odds' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                  <TrendingUp className="text-blue-400 w-5 h-5" /> Outs 与概率速查表
                </h3>
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 text-[10px] uppercase tracking-widest">
                        <th className="p-2 text-left">Outs</th>
                        <th className="p-2 text-left">转牌命中</th>
                        <th className="p-2 text-left">河牌命中</th>
                        <th className="p-2 text-left">翻牌→河牌</th>
                        <th className="p-2 text-left">典型听牌</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ODDS_TABLE.map((r, i) => (
                        <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                          <td className="p-2 font-mono font-bold text-blue-400">{r.outs}</td>
                          <td className="p-2 font-mono text-slate-300">{r.turn}</td>
                          <td className="p-2 font-mono text-slate-300">{r.river}</td>
                          <td className="p-2 font-mono text-emerald-400">{r.both}</td>
                          <td className="p-2 text-slate-400">{r.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">位置入池范围指南</h3>
                <div className="space-y-3">
                  {POSITION_GUIDE.map((p, i) => (
                    <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded font-bold text-xs">{p.position}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">入池范围: {p.range}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mb-1">推荐手牌: {p.hands}</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{p.strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

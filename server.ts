import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

let poeClient: OpenAI | null = null;

function getAI(): OpenAI | null {
  if (!poeClient) {
    const key = process.env.POE_API_KEY;
    if (!key) return null;
    poeClient = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return poeClient;
}

const MODEL = process.env.POE_MODEL || 'gpt5.1';

type CoachPayload = {
  action: string;
  reasoning: string;
  businessAnalogy: string;
  equity: string;
  advice: string;
  outsInfo: string;
};

function extractJsonBlock(text: string): string {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

function tryParseCoachPayload(text: string): Partial<CoachPayload> | null {
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

function stripJsonNoise(text: string): string {
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
  if (raw.includes('raise') || raw.includes('bet')) return 'Raise';
  if (raw.includes('call')) return 'Call';
  if (raw.includes('all')) return 'Raise';
  return 'Check';
}

function normalizeCoachPayload(raw: Partial<CoachPayload> | null, originalText = ''): CoachPayload {
  let payload = raw || {};
  if (typeof payload.reasoning === 'string' && payload.reasoning.trim().startsWith('{')) {
    payload = { ...payload, ...(tryParseCoachPayload(payload.reasoning) || {}) };
  }

  const fallbackReasoning = stripJsonNoise(originalText).slice(0, 420) || '这手牌需要看位置、赔率和对手范围，先别只盯着自己两张牌。';
  return {
    action: canonicalAction(payload.action),
    reasoning: stripJsonNoise(String(payload.reasoning || fallbackReasoning)),
    businessAnalogy: stripJsonNoise(String(payload.businessAnalogy || '像做生意一样，关键不是“有没有机会”，而是这笔投入能不能榨出足够回报。')),
    equity: stripJsonNoise(String(payload.equity || '粗估不明')),
    advice: stripJsonNoise(String(payload.advice || '先用小成本拿信息；如果对手下注尺度突然变重，就重新按赔率和范围算账。')),
    outsInfo: stripJsonNoise(String(payload.outsInfo || '')),
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ============ Coach API ============
  app.post("/api/coach", async (req, res) => {
    try {
      const { playerHand, communityCards, potSize, currentBet, playerStack, position, handStrength, phase, opponents } = req.body;

      const ai = getAI();
      if (!ai) {
        return res.json({
          action: 'Check', reasoning: '教练暂时没上线，你先自己看着打',
          businessAnalogy: '等教练来了再给你讲故事', equity: '不确定',
          advice: '先稳着，别冲动', outsInfo: ''
        });
      }

      // 计算关键参考指标
      const spr = potSize > 0 ? (playerStack / potSize).toFixed(1) : '∞';
      const potOddsPct = currentBet > 0 ? ((currentBet / (potSize + currentBet)) * 100).toFixed(0) : '0';
      const stackToBetRatio = currentBet > 0 ? (playerStack / currentBet).toFixed(1) : '∞';

      // 底牌6级分级表
      const handTierTable = `
底牌6级分级（只列代表性的，其余按类似原则判断）：
S级·顶级强牌 → AA, KK, QQ, AKs | 任何位置都加注/3bet，深筹码可以慢打设陷阱
A级·强牌     → JJ, TT, AKo, AQs, AJs, KQs | 大部分位置主动open raise，前位也打得开
B级·中上     → 99, 88, AQo, A10s, KQo, KJs, QJs, JTs | 后位加注，中位可平跟，前位看对手
C级·中等     → 77, 66, AJo, A10o, KJo, T9s, 98s, 87s | 靠位置打，后位多人底池可入
D级·投机     → 55-22小对子, 同花连牌76s-54s, A9s-A2s, K10s, Q10s | 便宜看翻牌碰暗三/顺/花，不中就跑
F级·弱牌     → 其他杂牌 72o, 83o, J4o 等 | 基本弃牌，大盲免费看除外

按等级给建议：
- S/A级 → 建议激进：加注尺度、如何榨价值、是否慢打
- B/C级 → 客观分析：看SPR/位置/对手数，给打或不打两种方案
- D级   → 投机逻辑：算要花多少看翻牌，碰中赚多少倍
- F级   → 建议弃牌，但大盲防守或后位偷盲例外也提一下`;

      // 阶段专属提示
      const phaseTips: Record<string, string> = {
        'pre-flop': `翻牌前没有公共牌，只能看底牌和位置做判断。
步骤：
1. 先判定底牌等级（对照分级表）
2. 再看位置：BTN（庄家位，最后行动信息最多）和CO可宽松；UTG（枪口位第一个说话）要收紧；SB/BB已投盲注要算防守值不值
3. 看SPR（${spr}）和对手数量：SPR>10深筹码投机牌有空间；SPR<5浅筹码投机牌价值大降
4. 看对手类型：对手紧→偷盲机会多；对手松→价值下注多吃
5. 给打法风格：TAG（紧凶，打得少但入池就狠）或LAG（松凶，大量入池持续施压），说清原因`,

        'flop': `翻牌出了，三张公共牌定了方向。
步骤：
1. 这三张”打中”了谁？我们有没有成对/顺/花？对手呢？
2. 牌面干湿：湿面（有顺/花可能）要积极保护或半诈唬；干面（K-7-2彩虹面）可以c-bet偷池
3. 中了强牌：下注让更差的牌愿意付钱，别把人吓跑
4. 没中但有听牌：算outs数和命中率，决定跟注还是加注施压
5. 完全没中：看位置和对手，有机会小注偷池，没机会控损失`,

        'turn': `转牌第四张，牌局轮廓清楚了。
步骤：
1. 这张牌帮了谁？完成同花/顺子要警惕对手成牌
2. 白板牌（没改变听牌）：之前领先的继续领先，可以继续施压
3. 底池变大了，弃牌成本高，更精确算赔率
4. 之前一直在下注就别突然停，不然对手读出你在诈唬
5. 想好河牌好/坏分别怎么打`,

        'river': `河牌最后一张，最终决策。
步骤：
1. 回顾整手牌：对手每轮怎么打的？像强牌还是弱牌？
2. 觉得领先：下注！下对手”能咬牙跟”的最大金额
3. 想诈唬：说清你代表什么强牌，对手能不能被吓住
4. 不确定：看底池赔率，跟注所需胜率是否合理，不值就弃
5. 没有”等下一张”了，只有”打”或”不打”`
      };

      const phaseTip = phaseTips[phase] || '';

      const prompt = `你是我的德州扑克教练朋友，坐旁边看我打牌。专业但说人话，客观不偏不倚。

【沟通规则】
1. 每个专业术语后必须跟一句白话解释。例如：”SPR是5.2（就是手里钱是底池5倍，算深筹码，可以冒险看翻牌）”
2. 客观分析：有机会讲机会，该弃说弃，但要说清为什么
3. 语气像朋友聊天，可以吐槽可以幽默，但信息密度要够
4. 不要无脑劝退弱牌。先定等级再按等级逻辑给建议

${handTierTable}

【${phase} 阶段分析】
${phaseTip}

【当前牌面】
- 底牌: ${playerHand}
- 公共牌: ${communityCards || '还没翻'}
- 牌力: ${handStrength}
- 阶段: ${phase}
- 底池: $${potSize}  |  跟注: $${currentBet}  |  剩余: $${playerStack}
- SPR: ${spr}（${Number(spr) > 10 ? '深筹码，投机空间大' : Number(spr) > 5 ? '中等，看牌力和位置' : '浅筹码，决策要精确'}）
- 底池赔率: ${potOddsPct}%  |  筹码/跟注比: ${stackToBetRatio}x
- 位置: ${position}  |  对手: ${opponents}人

请以JSON返回（不要markdown代码块，不要额外文字）：
{
  “action”: “Fold/Check/Call/Raise”,
  “reasoning”: “3-5句技术分析：①先判定底牌等级并说一句话解释为什么是这个等级 ②SPR和赔率（附白话）③位置和对手范围 ④一句心理博弈”,
  “businessAnalogy”: “商业类比故事，用真实公司案例讲这手牌的决策逻辑，可以延伸到风险管理、投入产出、沉没成本等商业洞察”,
  “equity”: “粗估赢面百分比，附一句话白话解释（例如：'大概三分之一的机会，就是三把能赢一把'）”,
  “advice”: “打法计划：具体行动+下注尺度+适合TAG还是LAG（为什么）+如果下一张好/坏分别怎么走”,
  “outsInfo”: “有听牌写outs数和命中率（白话：'大概X分之一'）；没听牌说靠什么赢或为什么该跑”
}`;

      const response = await ai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: '你是一个德州扑克教练。你必须只返回合法的JSON对象，不要markdown代码块，不要注释，不要额外文字。直接输出{...}格式。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const text = response.choices[0]?.message?.content || '{}';
      res.json(normalizeCoachPayload(tryParseCoachPayload(text), text));
    } catch (error: any) {
      console.error('Coach API Error:', error);
      res.status(500).json(normalizeCoachPayload({
        action: 'Check',
        reasoning: '网不太好，教练断线了。先按赔率和位置打：花小钱能看牌就看，对手突然大注就别硬扛。',
        businessAnalogy: '像临时断了财务报表的项目会，先别拍脑袋追加预算，等信息回来再加码。',
        equity: '不确定',
        advice: '先控制底池，少给对手机会用大注把你拖进高成本局面。',
        outsInfo: ''
      }));
    }
  });

  // ============ Review API ============
  app.post("/api/review", async (req, res) => {
    try {
      const { handLog, heroHand, communityCards, pot, result } = req.body;

      const ai = getAI();
      if (!ai) {
        return res.json({ review: 'AI教练未配置，无法生成复盘。请配置POE_API_KEY。' });
      }

      const prompt = `你是一个跟我一起打牌的德州扑克教练，刚看完我这一局的全过程，现在帮我复盘。要求是“听起来像朋友聊天，但判断像职业玩家”，别写成鸡汤。

说话要求：
- 用聊天语气，但保留技术点：位置、下注尺度、底池赔率、范围、价值下注/诈唬，至少讲到2个。
- 每个术语都顺手解释成人话，比如“底池赔率，就是你花这笔钱买这张票值不值”。
- 不要只劝“保守一点”。要给方法：下次同类牌面该怎么定尺度、控池、偷盲、或者放弃。
- 复盘时要评估“有没有机会剥削对手”：如果对手爱跟，怎么用价值下注吃更多；如果对手怕压力，什么牌面可以诈唬；如果对手会反击，哪些诈唬要收手。
- 要讲心理博弈：我们这条下注线代表什么牌？对手会不会相信？他拿中等牌、听牌、空气牌时分别可能怎么做？
- 250-450字，信息密度高一点，可以幽默，但不要水。

【这局的情况】
- 我手里的牌: ${heroHand}
- 桌上翻出来的: ${communityCards}
- 最后桌上总共多少钱: $${pot}
- 最终谁赢了: ${result}
- 这局发生了什么:
${handLog}

请用Markdown格式回复，包含：
1. **整体印象** — 一两句话说说我这把打得怎么样，别客气也别太严厉
2. **关键时刻** — 挑1-2个关键决定，说下注尺度、底池赔率、范围判断或心理博弈哪里好/哪里亏
3. **商业故事线** — 用一个有趣的公司真实故事（要有公司名、具体发生了什么、最后怎么样了）来打比方，说说这局的核心教训
4. **下次打法** — 用一两句可执行策略收尾：同类局面怎么诈唬、怎么吃价值、怎么计划翻牌/转牌/河牌

直接输出Markdown文本就行。`;

      const response = await ai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      res.json({ review: response.choices[0]?.message?.content || '复盘生成失败' });
    } catch (error: any) {
      console.error('Review API Error:', error?.message || error);
      res.json({ review: `复盘生成失败: ${error?.message || '未知错误'}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🃏 决策沙盘 Pro 已启动: http://localhost:${PORT}`);
    console.log(`📡 AI引擎: ${getAI() ? '已连接 (Poe API → ' + MODEL + ')' : '未配置'}\n`);
  });
}

startServer();

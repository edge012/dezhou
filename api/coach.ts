import { getAI, MODEL, normalizeCoachPayload, tryParseCoachPayload } from '../shared/ai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    const spr = potSize > 0 ? (playerStack / potSize).toFixed(1) : '∞';
    const potOddsPct = currentBet > 0 ? ((currentBet / (potSize + currentBet)) * 100).toFixed(0) : '0';
    const stackToBetRatio = currentBet > 0 ? (playerStack / currentBet).toFixed(1) : '∞';

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
1. 这三张"打中"了谁？我们有没有成对/顺/花？对手呢？
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
2. 觉得领先：下注！下对手"能咬牙跟"的最大金额
3. 想诈唬：说清你代表什么强牌，对手能不能被吓住
4. 不确定：看底池赔率，跟注所需胜率是否合理，不值就弃
5. 没有"等下一张"了，只有"打"或"不打"`
    };

    const phaseTip = phaseTips[phase] || '';

    const prompt = `你是我的德州扑克教练朋友，坐旁边看我打牌。专业但说人话，客观不偏不倚。

【沟通规则】
1. 每个专业术语后必须跟一句白话解释。例如："SPR是5.2（就是手里钱是底池5倍，算深筹码，可以冒险看翻牌）"
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
  "action": "Fold/Check/Call/Raise",
  "reasoning": "3-5句技术分析：①先判定底牌等级并说一句话解释为什么是这个等级 ②SPR和赔率（附白话）③位置和对手范围 ④一句心理博弈",
  "businessAnalogy": "用一个具体的真实公司案例打比方，说清公司名、发生了什么、跟这手牌的决策逻辑有什么关系。【重要】每次必须选一个不同的公司/行业，绝对不要重复用诺基亚、柯达等老掉牙的案例。从这些公司中随机选或自己想新的：Stripe支付赌注、Shopify从论坛转型、Zoom疫情前布局、Costco会员制、ALDI极简零售、海底捞服务溢价、瑞幸咖啡补贴战、巴菲特打卡决策法、桥水全天候策略、莱斯特城5000:1夺冠、Netflix放弃DVD、迪士尼收购漫威、丰田精益生产、SHEIN柔性供应链、拼多多下沉市场、Airbnb房东策略、SpaceX火箭回收、任天堂Switch双模式、星巴克第三空间、Dyson无叶风扇研发、优衣库基本款策略、比亚迪垂直整合",
  "equity": "粗估赢面百分比，附一句话白话解释（例如：'大概三分之一的机会，就是三把能赢一把'）",
  "advice": "打法计划：具体行动+下注尺度+如果下一张好/坏分别怎么走",
  "lagPlay": "松凶视角（LAG）：如果是激进派玩家，这里会怎么打？找什么理由诈唬或施压？（如果不适合激进操作，也说明原因）",
  "outsInfo": "有听牌写outs数和命中率（白话：'大概X分之一'）；没听牌说靠什么赢或为什么该跑"
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
}

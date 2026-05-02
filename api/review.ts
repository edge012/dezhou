import { getAI, MODEL } from '../shared/ai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { handLog, heroHand, communityCards, pot, result } = req.body;

    const ai = getAI();
    if (!ai) {
      return res.json({ review: 'AI教练未配置，无法生成复盘。请配置POE_API_KEY。' });
    }

    const prompt = `你是一个跟我一起打牌的德州扑克教练，刚看完我这一局的全过程，现在帮我复盘。要求是"听起来像朋友聊天，但判断像职业玩家"，别写成鸡汤。

说话要求：
- 用聊天语气，但保留技术点：位置、下注尺度、底池赔率、范围、价值下注/诈唬，至少讲到2个。
- 每个术语都顺手解释成人话，比如"底池赔率，就是你花这笔钱买这张票值不值"。
- 不要只劝"保守一点"。要给方法：下次同类牌面该怎么定尺度、控池、偷盲、或者放弃。
- 复盘时要评估"有没有机会剥削对手"：如果对手爱跟，怎么用价值下注吃更多；如果对手怕压力，什么牌面可以诈唬；如果对手会反击，哪些诈唬要收手。
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
3. **商业故事线** — 用一个有趣的公司真实故事来打比方（要有公司名、具体发生了什么、最后怎么样了）。【重要】不要用诺基亚、柯达这些老掉牙的案例！从以下公司随机选或自己想新的：Stripe、Shopify、Zoom、Costco、ALDI、海底捞、瑞幸、巴菲特、莱斯特城、Netflix、迪士尼漫威收购、丰田、SHEIN、拼多多、Airbnb、SpaceX、任天堂Switch、星巴克第三空间、Dyson、优衣库、比亚迪、Spotify、Notion等
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
}

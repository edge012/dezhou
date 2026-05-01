/**
 * Knowledge Base — 德州扑克 + 商业决策知识库
 */

// ============================================================
// 起手牌分级表 (Top tiers)
// ============================================================

export interface StartingHand {
  hand: string;
  tier: string;
  winRate: string;
  note: string;
}

export const STARTING_HANDS: StartingHand[] = [
  // S级
  { hand: 'AA', tier: 'S', winRate: '85%', note: '最强起手牌，任何位置加注' },
  { hand: 'KK', tier: 'S', winRate: '82%', note: '第二强牌，警惕翻牌出A' },
  { hand: 'QQ', tier: 'S', winRate: '80%', note: '强牌但翻牌后常面临over-card（比你大的牌）' },
  { hand: 'JJ', tier: 'S', winRate: '77%', note: '翻前强但翻后需谨慎' },
  { hand: 'AKs', tier: 'S', winRate: '67%', note: '最强非对子牌，同花加成' },
  // A级
  { hand: 'AKo', tier: 'A', winRate: '65%', note: '大帽子，未中牌时需控制底池' },
  { hand: 'AQs', tier: 'A', winRate: '66%', note: '强牌但被AK压制' },
  { hand: 'TT', tier: 'A', winRate: '75%', note: '中等口袋对子，后位价值高' },
  { hand: '99', tier: 'A', winRate: '72%', note: '翻牌前合理入池，目标暗三（三张一样的牌）' },
  { hand: 'AJs', tier: 'A', winRate: '65%', note: '同花潜力牌' },
  { hand: 'KQs', tier: 'A', winRate: '63%', note: '强连牌，同花潜力' },
  // B级
  { hand: '88', tier: 'B', winRate: '69%', note: '中等对子，set mining（专挖暗三条，没中就弃牌）' },
  { hand: 'ATs', tier: 'B', winRate: '64%', note: '同花潜力，位置敏感' },
  { hand: 'AQo', tier: 'B', winRate: '64%', note: '强但不同花，需位置优势' },
  { hand: 'KJs', tier: 'B', winRate: '62%', note: '好的投机牌' },
  { hand: 'QJs', tier: 'B', winRate: '61%', note: '同花连牌潜力' },
  { hand: 'JTs', tier: 'B', winRate: '60%', note: '最佳同花连牌之一' },
  { hand: '77', tier: 'B', winRate: '66%', note: '小对子，目标暗三条' },
  // C级
  { hand: '66-22', tier: 'C', winRate: '54-63%', note: '小对子群，纯set mining（专挖暗三条）' },
  { hand: 'T9s', tier: 'C', winRate: '58%', note: '中等同花连牌' },
  { hand: '98s', tier: 'C', winRate: '57%', note: '投机同花连牌' },
  { hand: 'A9s-A2s', tier: 'C', winRate: '56-60%', note: '同花A+小牌，后位入池' },
  { hand: 'KTs', tier: 'C', winRate: '60%', note: '边缘强牌' },
  { hand: 'QTs', tier: 'C', winRate: '59%', note: '投机入池' },
];

// ============================================================
// 经典局型与策略
// ============================================================

export interface ClassicScenario {
  id: string;
  title: string;
  category: string;
  description: string;
  strategy: string;
  businessMapping: string;
  difficulty: string;
}

export const CLASSIC_SCENARIOS: ClassicScenario[] = [
  {
    id: 'cbet',
    title: 'C-Bet (持续下注)',
    category: '翻牌策略',
    description: 'C-Bet（翻前加注的人翻牌继续下注），无论是否击中。利用翻前的主动权和代表范围优势。',
    strategy: '在干燥牌面(如K-7-2 rainbow，花色不同且不连贯)高频C-bet(65-75%)。在湿润牌面(如J♥T♥8♣，容易成顺成花)降低频率(40-50%)。下注量通常为底池的1/3到2/3。',
    businessMapping: '类似商业中的"先发优势"。率先进入市场并持续投入（C-bet），即使产品尚未完善，也能通过品牌认知和客户黏性建立壁垒。',
    difficulty: '入门'
  },
  {
    id: 'slow-play',
    title: '慢打 (Slow Play)',
    category: '高级策略',
    description: '拿到超强牌时故意示弱（过牌或小注跟注），引诱对手下注或诈唬。',
    strategy: '适合在对手激进、牌面干燥且你持有坚果牌时使用。风险：免费牌可能让对手反超。不要在湿润牌面慢打。',
    businessMapping: '类比商业谈判中的"以退为进"。当你掌握绝对优势时，不急于亮出底牌，让对方加大投入后再收网，实现利益最大化。',
    difficulty: '高级'
  },
  {
    id: 'bluff-catch',
    title: '抓诈唬 (Bluff Catching)',
    category: '河牌策略',
    description: '在河牌用中等牌力跟注对手的大注，判断对手是价值下注还是诈唬。',
    strategy: '关键因素：对手的范围中诈唬牌占比、底池赔率、历史诈唬频率。底池赔率给你33%的odds时，对手需要诈唬超过33%你才能盈利跟注。',
    businessMapping: '如同在商业竞争中识别对手的虚张声势。竞争对手声称的市场份额或技术优势可能是诈唬，用数据验证后决定是否跟进。',
    difficulty: '高级'
  },
  {
    id: 'squeeze',
    title: '挤压 (Squeeze Play)',
    category: '翻前策略',
    description: '有人加注并有多人跟注后，你用大幅3-bet挤压，利用跟注者的弱范围。',
    strategy: '最佳时机：前面有一个加注和2+跟注者。3-bet到4-5倍原始加注。跟注者通常有宽且弱的范围，大概率弃牌。',
    businessMapping: '类似商业中的"颠覆式定价"。当市场已有玩家和跟随者时，用激进的价格策略或创新方案一次性挤出弱竞争者。',
    difficulty: '高级'
  },
  {
    id: 'pot-control',
    title: '底池控制 (Pot Control)',
    category: '中级策略',
    description: '用中等牌力控制底池大小，避免在不利局面建立过大的底池。',
    strategy: '持有中等牌(如顶对弱踢脚)时，选择过牌或小注而非大注。在不利位置尤其重要。目标：用最小的代价到达摊牌。',
    businessMapping: '对应商业中的"精益运营"。在市场不确定时，控制投入规模，用最小的可行产品(MVP)验证假设，而非全仓投入。',
    difficulty: '中级'
  },
  {
    id: 'value-bet',
    title: '价值下注 (Value Bet)',
    category: '核心概念',
    description: '当你认为自己的牌比对手强时下注，目的是从对手的弱牌中获取价值。',
    strategy: '关键：判断对手会用哪些更弱的牌跟注。薄价值下注(thin value bet)是高手与普通玩家的分水岭。下注量要让对手"刚好能跟"。',
    businessMapping: '如同产品定价策略。定价太高无人购买(对手弃牌)，定价太低损失利润。找到客户支付意愿的甜蜜点，最大化每笔交易的价值。',
    difficulty: '核心'
  },
  {
    id: 'position',
    title: '位置优势利用',
    category: '核心概念',
    description: 'BTN(庄家)是最有利的位置，因为你最后行动，拥有最多信息。',
    strategy: 'BTN可以打50%+的手牌，UTG只打前10-15%。位置越靠后，入池范围越宽。位置优势在翻后更加放大——你能看到对手先行动。',
    businessMapping: '商业中的"后发优势"。观察竞争对手的产品反馈和市场反应后再行动，可以避免先行者的试错成本，精准打击市场痛点。',
    difficulty: '核心'
  },
  {
    id: 'sunk-cost',
    title: '沉没成本陷阱',
    category: '心理博弈',
    description: '已经投入大量筹码后不舍得弃牌，即使胜率极低。这是最常见的心理陷阱。',
    strategy: '每次决策只看当前赔率和胜率，忽略已投入的筹码。过去的投入不应影响未来的决策。纪律性弃牌是长期盈利的关键。',
    businessMapping: '企业在失败项目上持续投入，因为"已经花了这么多钱"。正确做法：定期评估项目的未来预期回报，果断砍掉负EV项目。',
    difficulty: '核心'
  },
  {
    id: 'bankroll',
    title: '资金管理 (Bankroll Management)',
    category: '元策略',
    description: '确保你的总资金足以承受正常的波动，避免因短期运气不佳而破产。',
    strategy: '现金局：至少20-30个买入。锦标赛：至少50-100个买入。永远不要在单局中冒整个bankroll的风险。',
    businessMapping: 'Kelly公式在投资中的应用。永远不要把全部资金投入单一项目。保持现金储备应对市场波动，分散风险是生存的前提。',
    difficulty: '核心'
  },
  {
    id: 'three-bet',
    title: '3-Bet 与 4-Bet 战争',
    category: '翻前策略',
    description: '对加注进行再加注(3-bet)，以及对3-bet再加注(4-bet)的攻防策略。',
    strategy: '3-bet范围分两部分：价值(AA-QQ,AK)和诈唬(A5s,76s等有阻断牌效应的手牌)。面对3-bet，用4-bet进一步极化范围。',
    businessMapping: '商业中的"升级竞争"。当对手发起价格战(raise)，你用更激进的策略反击(3-bet)，迫使对手要么退出要么全面交战。',
    difficulty: '高级'
  },
];

// ============================================================
// 商业决策方法论
// ============================================================

export interface BusinessConcept {
  id: string;
  title: string;
  pokerAnalogy: string;
  description: string;
  application: string;
  caseStudy: string;
}

export const BUSINESS_CONCEPTS: BusinessConcept[] = [
  {
    id: 'ev',
    title: '期望值 (Expected Value)',
    pokerAnalogy: '每次下注决策的长期数学期望',
    description: 'EV（期望值，长期来看赚还是亏） = (赢的概率 × 赢的金额) - (输的概率 × 输的金额)。正EV决策长期必然盈利，负EV决策长期必然亏损。',
    application: '投资决策、产品迭代、市场扩张——所有需要在不确定性下做决策的场景。不以单次结果论英雄，而是评估决策质量。',
    caseStudy: '【亚马逊的长期EV思维】亚马逊早期持续亏损，贝索斯顶住华尔街压力，将所有利润投入物流网络(FBA)和AWS。单季度看是负收益（弃牌/输掉小底池），但从十年周期的长远概率算，这是一个巨大的正EV决策，最终造就了电商和云服务霸权。'
  },
  {
    id: 'info-asymmetry',
    title: '信息不对称',
    pokerAnalogy: '位置优势——后行动者看到更多信息',
    description: '在商业中，信息不对称是利润的重要来源。拥有竞争对手不知道的市场数据、用户行为或技术壁垒，等于在德州中拥有位置优势。',
    application: '商业情报收集、专利保护、数据驱动决策、竞品分析。',
    caseStudy: '【字节跳动的数据优势】字节跳动通过庞大的产品矩阵收集海量用户行为数据，建立起强大的推荐算法模型。相比于竞争对手，他们拥有巨大的"位置优势"，能够比对手更早看清用户偏好，从而在广告变现和新业务拓展中获得超额收益。'
  },
  {
    id: 'risk-mgmt',
    title: '风险管理与止损',
    pokerAnalogy: '弃牌(Fold)是最被低估的武器',
    description: '会弃牌的玩家才能长期盈利。在商业中，及时止损(关停亏损项目、裁减低效部门)是保存实力的关键。',
    application: '项目评审机制、定期复盘、设置止损线、保持现金流健康。',
    caseStudy: '【通用电气的业务剥离】韦尔奇时代，GE定下了"数一数二"战略：如果一个业务在市场中不能做到第一或第二，就果断卖掉或关闭（Fold）。即使该业务仍有微利，但也占用了宝贵的筹码。果断弃牌让GE有足够的筹码投资于回报率最高的领域。'
  },
  {
    id: 'leverage',
    title: '杠杆与下注量',
    pokerAnalogy: '用下注大小传递信息和施加压力',
    description: '在德州中，下注量是你的杠杆——大注施加压力，小注吸引跟注。在商业中，杠杆是用有限资源撬动最大价值。',
    application: '融资策略、营销投入的ROI优化、谈判中的筹码运用。',
    caseStudy: '【滴滴出行的补贴大战】打车软件大战时期，滴滴通过巨额融资获得大量筹码，随后在关键城市使用"超额下注（Over-bet）"——即无底线的乘客和司机补贴。这不仅获取了用户，更重要的是给予竞争对手极大的资金压力，迫使筹码不足的对手（如快的、Uber中国）最终选择合并（弃牌）。'
  },
  {
    id: 'game-theory',
    title: '博弈论与GTO',
    pokerAnalogy: 'GTO(Game Theory Optimal)——不可被利用的策略',
    description: 'GTO（不会被针对的最优打法）基于纳什均衡（所有人都找不到更好打法的稳定状态），使得对手无论怎么调整都无法获得额外利润。在商业中，建立不可被轻易模仿或利用的竞争策略。',
    application: '定价策略、市场进入时机、竞争壁垒构建、专利和技术护城河。',
    caseStudy: '【苹果生态的纳什均衡】苹果通过iOS硬件+软件+服务的闭环，构建了一个牢不可破的生态。对于开发者来说，不在iOS开发应用会损失高净值用户；对于用户来说，离开iOS会损失已购买的App和便利体验。各方在这个博弈中都找到了自己的最佳策略，达成了一种难以被竞争对手打破的"纳什均衡"。'
  },
  {
    id: 'frequency',
    title: '频率与平衡',
    pokerAnalogy: '诈唬和价值下注的比例平衡',
    description: '如果你只在有强牌时下注，对手很快就会读透你。保持行动的不可预测性，在诈唬和价值之间维持平衡。',
    application: '产品策略的多元化、营销渠道的AB测试、避免策略单一化导致被竞争对手针对。',
    caseStudy: '【可口可乐的新品策略】可口可乐的核心利润来自经典款（价值下注），但他们不断推出各种新口味或限量版（诈唬/投机）。很多新口味注定失败（被抓诈唬），但这种高频率的尝试保持了品牌的活力和不可预测性，占据了货架空间，同时也增加了命中下一个爆款（如零度可乐）的几率。'
  },
  {
    id: 'second-order',
    title: '二阶思维与多层博弈',
    pokerAnalogy: '不要只看自己的牌，要思考对手觉得你有什么牌',
    description: '一阶思维是"我的牌有多大"，二阶思维是"对手觉得我的牌有多大"，三阶思维是"对手觉得我认为他的牌有多大"。',
    application: '制定竞争策略、反狙击战、公关危机处理。不要只看表象，要预判对手的预判。',
    caseStudy: '【腾讯的社交护城河】腾讯早年面对诸多挑战者，并没有在每一个功能上死磕（一阶思维），而是牢牢把握住关系链这个底牌。当对手觉得可以靠新功能超越时，腾讯通过社交分发降维打击。这就是看透了对方底牌后的二阶博弈。'
  },
  {
    id: 'opportunity-cost',
    title: '机会成本',
    pokerAnalogy: '每次跟注的钱，是你放弃的其他投资',
    description: '在牌桌上，投入底池的每一个筹码，都意味着这部分钱不能用来在更好的牌局里下注。放弃不仅是为了止损，更是为了保存实力去抓更大的机会。',
    application: '资源分配策略、战略收缩、放弃平庸项目。',
    caseStudy: '【Netflix放弃DVD业务】2011年，Netflix的DVD邮寄业务仍有巨大现金流，但哈斯廷斯果断决定将资源All-in流媒体。保留DVD业务虽然能赚稳健的小钱，但机会成本是可能错失流媒体爆发的历史性机遇（超级底池）。'
  },
  {
    id: 'all-in',
    title: '破局点与 All-In 时刻',
    pokerAnalogy: '什么时候该把全部资源压上',
    description: '平时要极度保守控制风险，但当胜率极高、底池极大，或者不压上就会被盲注耗死时，必须果断All-In。',
    application: '转型期决策、跨越技术鸿沟、生死存亡的竞争时刻。',
    caseStudy: '【特斯拉的Model 3豪赌】2017年，马斯克将特斯拉的所有资源和现金流都押在了Model 3的量产上。当时公司面临破产危机，常规打法只能等死，只有通过All-In彻底解决产能问题，才能赢下大众电动车市场这个史诗级底池。'
  }
];

// ============================================================
// 概率速查表
// ============================================================

export const ODDS_TABLE = [
  { outs: 1, turn: '2.1%', river: '2.2%', both: '4.3%', example: '1张特定牌（Outs:能让你赢的牌）' },
  { outs: 2, turn: '4.3%', river: '4.3%', both: '8.4%', example: '口袋对子成暗三' },
  { outs: 4, turn: '8.5%', river: '8.7%', both: '16.5%', example: '卡顺听牌' },
  { outs: 6, turn: '12.8%', river: '13.0%', both: '24.1%', example: '两端顺子(部分)' },
  { outs: 8, turn: '17.0%', river: '17.4%', both: '31.5%', example: '两端顺子听牌' },
  { outs: 9, turn: '19.1%', river: '19.6%', both: '35.0%', example: '同花听牌' },
  { outs: 12, turn: '25.5%', river: '26.1%', both: '45.0%', example: '同花+顺子听牌' },
  { outs: 15, turn: '31.9%', river: '32.6%', both: '54.1%', example: '超级听牌' },
];

// ============================================================
// 位置策略
// ============================================================

export const POSITION_GUIDE = [
  { position: 'UTG (枪口位/最早行动)', range: '前10-12%', hands: 'AA-99, AKs-ATs, AKo-AQo, KQs', strategy: '最紧的位置。只玩强牌，因为后面还有很多人可能加注。' },
  { position: 'CO (关煞位/庄家右侧)', range: '前20-25%', hands: '+ 88-66, AJs-A9s, KJs, QJs, JTs, T9s', strategy: '可以适度放宽。如果前面无人入池，可以偷盲注。' },
  { position: 'BTN (庄家位/最后行动)', range: '前35-50%', hands: '+ 55-22, 更多同花连牌和同花A', strategy: '最有利位置！翻后永远最后行动。入池范围最宽，偷盲频率最高。' },
  { position: 'SB (小盲位/已下半注)', range: '前25-30%', hands: '面对加注用紧范围防守', strategy: '最差位置(翻后第一个行动)。面对BTN偷盲要有合理的3-bet防守范围。' },
  { position: 'BB (大盲位/已下全注)', range: '防守40-50%', hands: '有位置折扣(已投入1BB)', strategy: '已投入盲注，底池赔率更好。面对小额加注应广泛防守，但不要过度。' },
];

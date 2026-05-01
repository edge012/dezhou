const fs = require('fs');
let content = fs.readFileSync('d:/德州/server.ts', 'utf8');
const oldText = `"outsInfo": "有听牌写outs数和命中率（白话：'大概X分之一'）；没听牌说靠什么赢或为什么该跑"
}\``;
const newText = `"outsInfo": "有听牌写outs数和命中率（白话：'大概X分之一'）；没听牌说靠什么赢或为什么该跑",
  "lagPlay": "松凶视角：假设你是一个LAG（松凶）玩家，这手牌你会怎么打？说清下注尺度、诈唬逻辑、代表什么范围、对手会怎么反应、什么牌面适合过牌、什么牌面适合连续开火。这是一个独立角度，不是建议你一定要这么打"
}\``;
if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  fs.writeFileSync('d:/德州/server.ts', content, 'utf8');
  console.log('DONE: lagPlay added to prompt');
} else {
  console.log('NOT FOUND');
}

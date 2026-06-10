// ============================================================================
//  量化精度检查：真实提案在"全精度"vs"便宜的 k=2 (20-bit) 量化"下，赢家是否一致。
//  纯明文计算（量化只改编码表示的明文 tally，不改密码学），秒级跑完全量。
//  运行： node quant_check.js   （读同目录 proposals.json）
// ============================================================================
const fs=require("fs");
const P=JSON.parse(fs.readFileSync("proposals.json"));
const PREC=(1n<<20n)-1n;   // k=2, B=1024 → 20-bit 精度上限

let match=0, flips=[];
for(let idx=0;idx<P.length;idx++){
  const w=P[idx].weights.map(BigInt), v=P[idx].votes.map(BigInt);
  const Wt=w.reduce((a,b)=>a+b,0n);
  const yes=w.reduce((a,b,i)=>a+b*v[i],0n);
  const fullWinner = (2n*yes>Wt)?1:0;                 // 全精度赢家（明文真值）
  // 量化到 20-bit：scale 使最大权重映射到 ~2^20-1
  const wmax=w.reduce((a,b)=>b>a?b:a,0n);
  const scale = wmax/PREC + 1n;
  const wq=w.map(x=>x/scale);
  const Wq=wq.reduce((a,b)=>a+b,0n);
  const yesq=wq.reduce((a,b,i)=>a+b*v[i],0n);
  const qWinner=(2n*yesq>Wq)?1:0;
  if(qWinner===fullWinner) match++;
  else {
    const margin=Number(2n*yes-Wt)/Number(Wt);        // 全精度的胜负差（占总票权比例）
    flips.push({idx:idx+1, N:w.length, margin:(margin*100).toFixed(4)+"%"});
  }
}
console.log(`量化到 k=2 (20-bit) 后赢家与全精度一致: ${match} / ${P.length}`);
if(flips.length) { console.log("翻转的提案（及其全精度胜负差）:"); flips.forEach(f=>console.log(`  #${f.idx} N=${f.N} margin=${f.margin}`)); }
else console.log("✅ 便宜的 k=2 量化在全部真实提案上都保住了正确赢家。");

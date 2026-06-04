// 委员会电路输入 + 标准答案（pk_j, D_jLow, D_jHigh）
const { buildBabyjub } = require("circomlibjs");
const fs = require("fs");
(async () => {
  const babyjub = await buildBabyjub();
  const F = babyjub.F, G = babyjub.Base8, q = babyjub.subOrder;
  const mul = (P,s)=>babyjub.mulPointEscalar(P,s), S=(P)=>[F.toString(P[0]),F.toString(P[1])];
  const rnd=()=>{let x=0n;for(let i=0;i<4;i++)x=(x<<64n)|BigInt(Math.floor(Math.random()*2**32));return (x%(q-1n))+1n;};

  const skj = rnd();                 // 成员私钥分片
  // 模拟聚合密文的两个 C1（实际来自链上聚合；这里随机取两个点）
  const C1Low  = mul(G, rnd());
  const C1High = mul(G, rnd());

  const pkj   = mul(G, skj);         // 标准答案
  const DjLow = mul(C1Low, skj);
  const DjHigh= mul(C1High, skj);

  console.log("=== 电路应输出（与 public.json 比对）===");
  console.log("pkj   =", S(pkj));
  console.log("DjLow =", S(DjLow));
  console.log("DjHigh=", S(DjHigh));

  const input = { skj: skj.toString(), C1Low: S(C1Low), C1High: S(C1High) };
  fs.writeFileSync("committee_input.json", JSON.stringify(input,null,2));
  console.log("\n已写出 committee_input.json");
})();

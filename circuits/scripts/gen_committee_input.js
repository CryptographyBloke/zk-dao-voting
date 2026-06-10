// 委员会电路输入 + 标准答案（Option C：公开 pk_j 与承诺 cm_j = Poseidon(D_jLow, D_jHigh)）
const { buildBabyjub, buildPoseidon } = require("circomlibjs");
const fs = require("fs");
const crypto = require("crypto");
(async () => {
  const babyjub = await buildBabyjub();
  const poseidon = await buildPoseidon();
  const Fp = poseidon.F;
  const F = babyjub.F, G = babyjub.Base8, q = babyjub.subOrder;
  const mul = (P,s)=>babyjub.mulPointEscalar(P,s), S=(P)=>[F.toString(P[0]),F.toString(P[1])];
  // CSPRNG：密码学安全随机标量 ∈ [1, q)
  const rnd=()=>{let x;do{x=BigInt("0x"+crypto.randomBytes(32).toString("hex"))%q;}while(x===0n);return x;};
  const H4=(P,Q)=>Fp.toObject(poseidon([F.toObject(P[0]),F.toObject(P[1]),F.toObject(Q[0]),F.toObject(Q[1])]));

  const skj = rnd();                 // 成员私钥分片
  // 模拟聚合密文的两个 C1（实际来自链上聚合；这里随机取两个点）
  const C1Low  = mul(G, rnd());
  const C1High = mul(G, rnd());

  const pkj   = mul(G, skj);         // 标准答案
  const DjLow = mul(C1Low, skj);     // 真 D_j（链下交聚合方，不上链）
  const DjHigh= mul(C1High, skj);
  const cm    = H4(DjLow, DjHigh);   // 上链的承诺

  console.log("=== 电路应输出（与 public.json 比对，顺序 pkj(2), cm(1)）===");
  console.log("pkj =", S(pkj));
  console.log("cm  =", cm.toString());
  console.log("(链下) DjLow =", S(DjLow), " DjHigh =", S(DjHigh));

  const input = { skj: skj.toString(), C1Low: S(C1Low), C1High: S(C1High) };
  fs.writeFileSync("committee_input.json", JSON.stringify(input,null,2));
  console.log("\n已写出 committee_input.json");
})();

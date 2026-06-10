// ============================================================================
//  Week 5：BabyJubjub 上的门限解密（3-of-5）——委员会代替单一可信方
//  路 A：每个成员的"解密正确性"由电路(Groth16)证明，所以这里不需要 Fiat-Shamir，
//        只演示门限解密机制：Shamir 建钥 → 部分解密 → Lagrange 合并 → BSGS 还原。
//  运行： node babyjub_threshold.js
// ============================================================================
const { buildBabyjub } = require("circomlibjs");
const crypto = require("crypto");

(async () => {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;
  const G = babyjub.Base8;
  const q = babyjub.subOrder;                 // 子群阶（素数）
  const mul = (P, s) => babyjub.mulPointEscalar(P, s);
  const add = (P, Q) => babyjub.addPoint(P, Q);
  const neg = (P) => [F.neg(P[0]), P[1]];
  const mod = (a, m) => ((a % m) + m) % m;
  const rnd = () => { let x; do { x = BigInt("0x"+crypto.randomBytes(32).toString("hex"))%q; } while(x===0n); return x; };
  const inv = (a) => { let [r0,r1]=[mod(a,q),q],[s0,s1]=[1n,0n]; while(r1!==0n){const t=r0/r1;[r0,r1]=[r1,r0-t*r1];[s0,s1]=[s1,s0-t*s1];} return mod(s0,q); };

  // ---- 1) 委员会建钥：Shamir 把 sk 拆成 5 份，门限 3（任意 3 个能解，2 个不行）----
  const n = 5, t = 3;
  const sk = rnd();
  const PK = mul(G, sk);                        // 委员会公钥（投票就用它加密）
  const coeffs = [sk]; for (let i=1;i<t;i++) coeffs.push(rnd());
  const f = (x)=>{let y=0n,xp=1n;for(const c of coeffs){y=mod(y+c*xp,q);xp=mod(xp*x,q);}return y;};
  const members = [];
  for (let j=1;j<=n;j++){ const share=f(BigInt(j)); members.push({id:j, share, pk:mul(G,share)}); }
  console.log("委员会 5 名成员，门限 3，已分片完成");

  // ---- 2) 用委员会公钥加密一个聚合权重（= 全部 yes 票聚合后的密文）----
  const total = 3772n;
  const r = rnd();
  const C1 = mul(G, r);
  const C2 = add(mul(G, total), mul(PK, r));

  // ---- 3) 任取 3 个成员，各自部分解密 D_j = share_j·C1 ----
  const S = [members[0], members[2], members[4]];   // 成员 1,3,5
  const parts = S.map(m => ({ id:m.id, D: mul(C1, m.share) }));

  // ---- 4) Lagrange 合并：Σ λ_j·D_j = sk·C1，得 M = C2 - 它 = total·G ----
  const ids = S.map(s=>BigInt(s.id));
  const lambda = (j)=>{ let num=1n,den=1n; for(const l of ids) if(l!==j){num=mod(num*mod(-l,q),q);den=mod(den*mod(j-l,q),q);} return mod(num*inv(den),q); };
  let comb = null;
  for (const p of parts){ const term = mul(p.D, lambda(BigInt(p.id))); comb = comb===null?term:add(comb,term); }
  const M = add(C2, neg(comb));

  // ---- 5) BSGS 还原 total ----
  function bsgs(target, bound){ const m0=BigInt(Math.ceil(Math.sqrt(Number(bound)))+1); const tb=new Map(); let b=null;
    for(let i=0n;i<m0;i++){tb.set(b===null?"O":F.toString(b[0])+","+F.toString(b[1]),i); b=b===null?G:add(b,G);}
    const st=mul(G,m0); const ns=neg(st); let c=target;
    for(let j=0n;j<=m0;j++){const k=c===null?"O":F.toString(c[0])+","+F.toString(c[1]); if(tb.has(k))return j*m0+tb.get(k); c=add(c,ns);} return null; }
  const rec = bsgs(M, 1<<20);
  console.log("3 个成员合并还原 total =", rec.toString(), rec===total ? "✅ 门限解密成功" : "❌");

  // ---- 6) 少于 t 个成员：信息论上不可能还原 ----
  const S2 = [members[0], members[1]]; const ids2=[1n,2n];
  const lam2 = (j)=>{let num=1n,den=1n;for(const l of ids2)if(l!==j){num=mod(num*mod(-l,q),q);den=mod(den*mod(j-l,q),q);}return mod(num*inv(den),q);};
  let comb2=null; for(const m of S2){const D=mul(C1,m.share); const term=mul(D,lam2(BigInt(m.id)));comb2=comb2===null?term:add(comb2,term);}
  const rec2 = bsgs(add(C2,neg(comb2)), 1<<20);
  console.log("只用 2 个成员(<t):", rec2===total ? "竟然对了(不应该)" : "无法还原 ✅（门限安全成立）");

  // 把这次的 PK / C1 打印出来，后面写「委员会证明电路」时当测试输入
  console.log("\nPK =", [F.toString(PK[0]), F.toString(PK[1])]);
})();

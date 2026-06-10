// ============================================================================
//  Feldman VSS 分布式密钥生成（DKG，5 方门限 3）—— 回应审稿意见 #3
//  目标：去掉"可信发牌人"。每方各自贡献一个秘密多项式、广播承诺、互验份额；
//        合成的私钥 sk = Σ s_i 没有任何单方知道，但产出的份额 sk_j 能直接用于
//        现有的门限解密（sk_j·G = pk_j，正是 committee 电路要证的关系）。
//  运行： node dkg.js
// ============================================================================
const { buildBabyjub } = require("circomlibjs");
(async () => {
  const babyjub = await buildBabyjub();
  const F = babyjub.F, G = babyjub.Base8, q = babyjub.subOrder;
  const mul=(P,s)=>babyjub.mulPointEscalar(P,s), add=(P,Q)=>babyjub.addPoint(P,Q);
  const neg=(P)=>[F.neg(P[0]),P[1]], eqP=(P,Q)=>F.eq(P[0],Q[0])&&F.eq(P[1],Q[1]);
  const ID=[F.e(0n),F.e(1n)];
  const mod=(a,m)=>((a%m)+m)%m;
  const rnd=()=>{let x=0n;for(let i=0;i<4;i++)x=(x<<64n)|BigInt(Math.floor(Math.random()*2**32));return (x%(q-1n))+1n;};
  const inv=(a)=>{let[r0,r1]=[mod(a,q),q],[s0,s1]=[1n,0n];while(r1!==0n){const t=r0/r1;[r0,r1]=[r1,r0-t*r1];[s0,s1]=[s1,s0-t*s1];}return mod(s0,q);};

  const n=5, t=3, ids=[1n,2n,3n,4n,5n];

  // ---- 1) 每方 i 选一个 t-1 次多项式 f_i，广播系数承诺 C_{i,k}=a_{i,k}·G ----
  const parties=[];
  for(let i=0;i<n;i++){
    const coeffs=[]; for(let k=0;k<t;k++) coeffs.push(rnd());   // a_{i,0..t-1}
    const commit=coeffs.map(a=>mul(G,a));                        // 公开承诺
    parties.push({coeffs, commit});
  }
  const polyEval=(coeffs,x)=>{let y=0n,xp=1n;for(const a of coeffs){y=mod(y+a*xp,q);xp=mod(xp*x,q);}return y;};

  // ---- 2) 每方把份额 f_i(j) 私发给 j；j 用承诺验证（Feldman 检查）----
  // 验证： f_i(j)·G  ==  Σ_k C_{i,k} · j^k
  let allValid=true;
  for(let i=0;i<n;i++){
    for(const j of ids){
      const share=polyEval(parties[i].coeffs, j);
      let rhs=ID, xp=1n;
      for(let k=0;k<t;k++){ rhs=add(rhs, mul(parties[i].commit[k], xp)); xp=mod(xp*j,q); }
      if(!eqP(mul(G,share), rhs)) allValid=false;
    }
  }
  console.log("全部 25 份额的 Feldman 验证:", allValid?"✅ 通过":"❌");

  // ---- 3) 合成：sk = Σ_i a_{i,0}（无人知道）；PK = Σ_i C_{i,0} = sk·G（公开可算）----
  let PK=ID; for(let i=0;i<n;i++) PK=add(PK, parties[i].commit[0]);
  // 每方 j 的合并份额 sk_j = Σ_i f_i(j)
  const shares={}; for(const j of ids){ let s=0n; for(let i=0;i<n;i++) s=mod(s+polyEval(parties[i].coeffs,j),q); shares[j]=s; }
  // 验证 pk_j = sk_j·G 也能从公开承诺重算（任何人可查）
  let pkOK=true;
  for(const j of ids){
    let rhs=ID; for(let i=0;i<n;i++){ let xp=1n; for(let k=0;k<t;k++){ rhs=add(rhs, mul(parties[i].commit[k],xp)); xp=mod(xp*j,q);} }
    if(!eqP(mul(G,shares[j]), rhs)) pkOK=false;
  }
  console.log("每方公钥份额 pk_j 可从公开承诺验证:", pkOK?"✅":"❌");

  // ---- 4) 关键：DKG 产出的份额能直接做门限解密（接进现有流程）----
  const total=3772n, r=rnd();
  const C1=mul(G,r), C2=add(mul(G,total), mul(PK,r));   // 用 DKG 的 PK 加密
  const S=[1n,3n,5n];                                     // 任取 3 方
  const lam=(jj)=>{let nu=1n,de=1n;for(const l of S)if(l!==jj){nu=mod(nu*l,q);de=mod(de*mod(l-jj,q),q);}return mod(nu*inv(de),q);};
  let comb=ID; for(const j of S) comb=add(comb, mul(mul(C1,shares[j]), lam(j)));
  const M=add(C2, neg(comb));
  function bsgs(T,b){const m0=BigInt(Math.ceil(Math.sqrt(b))+1);const tb=new Map();let p=ID;for(let i=0n;i<m0;i++){tb.set(F.toString(p[0])+","+F.toString(p[1]),i);p=add(p,G);}const st=mul(G,m0),ns=neg(st);let c=T;for(let j=0n;j<=m0;j++){const k=F.toString(c[0])+","+F.toString(c[1]);if(tb.has(k))return j*m0+tb.get(k);c=add(c,ns);}return null;}
  const rec=bsgs(M,1<<20);
  console.log("用 DKG 份额做门限解密，还原 total =", rec.toString(), rec===total?"✅":"❌");
  console.log("\n没有任何单方知道完整私钥 sk —— sk = a_{1,0}+...+a_{5,0}，各方只持有自己的 a_{i,0}。");
})();

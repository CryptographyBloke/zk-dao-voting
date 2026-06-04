// ============================================================================
//  Week 6：链下计票（circuit 2 的标准答案）
//  给定聚合密文 + t 个委员会部分解密 D_j + Lagrange 系数 λ_j：
//    combLimb = Σ λ_j·D_j ;  M = C2_agg − comb = total·G ;  BSGS 还原 total ;  判赢家
//  产出 tally_input.json（喂 circuit 2）。 运行： node tally.js
// ============================================================================
const { buildBabyjub } = require("circomlibjs");
const fs = require("fs");
(async () => {
  const babyjub = await buildBabyjub();
  const F = babyjub.F, G = babyjub.Base8, q = babyjub.subOrder;
  const mul=(P,s)=>babyjub.mulPointEscalar(P,s), add=(P,Q)=>babyjub.addPoint(P,Q), neg=(P)=>[F.neg(P[0]),P[1]];
  const S=(P)=>[F.toString(P[0]),F.toString(P[1])];
  const mod=(a,m)=>((a%m)+m)%m;
  const rnd=()=>{let x=0n;for(let i=0;i<4;i++)x=(x<<64n)|BigInt(Math.floor(Math.random()*2**32));return (x%(q-1n))+1n;};
  const inv=(a)=>{let[r0,r1]=[mod(a,q),q],[s0,s1]=[1n,0n];while(r1!==0n){const t=r0/r1;[r0,r1]=[r1,r0-t*r1];[s0,s1]=[s1,s0-t*s1];}return mod(s0,q);};

  // 委员会 3-of-5
  const n=5,t=3, sk=rnd(), PK=mul(G,sk);
  const coeffs=[sk];for(let i=1;i<t;i++)coeffs.push(rnd());
  const f=(x)=>{let y=0n,xp=1n;for(const c of coeffs){y=mod(y+c*xp,q);xp=mod(xp*x,q);}return y;};
  const members=[];for(let j=1;j<=n;j++)members.push({id:j,share:f(BigInt(j))});

  // 聚合明文（= 全部 yes 票之和），2 limb
  const BASE=1024n;
  const total = 5832n;                       // 演示总权重
  const totalLow = total % BASE, totalHigh = total / BASE;   // 5832 = 200 + 1024*5
  const threshold = 3000n;                   // 通过线
  // 构造聚合密文（low/high）
  const rL=rnd(), rH=rnd();
  const C1Low=mul(G,rL),  C2Low =add(mul(G,totalLow),  mul(PK,rL));
  const C1High=mul(G,rH), C2High=add(mul(G,totalHigh), mul(PK,rH));

  // 取 3 个成员，各自部分解密（对两个 limb）
  const quorum=[members[0],members[2],members[4]];           // id 1,3,5
  const ids=quorum.map(m=>BigInt(m.id));
  const lambda=(j)=>{let num=1n,den=1n;for(const l of ids)if(l!==j){num=mod(num*mod(-l,q),q);den=mod(den*mod(j-l,q),q);}return mod(num*inv(den),q);};
  const DjLow=quorum.map(m=>mul(C1Low,m.share));
  const DjHigh=quorum.map(m=>mul(C1High,m.share));
  const lam=quorum.map(m=>lambda(BigInt(m.id)));

  // 合并 comb = Σ λ_j D_j，M = C2 − comb
  const combine=(Ds)=>{let acc=null;for(let i=0;i<Ds.length;i++){const term=mul(Ds[i],lam[i]);acc=acc===null?term:add(acc,term);}return acc;};
  const combLow=combine(DjLow), combHigh=combine(DjHigh);
  const Mlow=add(C2Low,neg(combLow)), Mhigh=add(C2High,neg(combHigh));

  // BSGS 还原
  const bsgs=(target,bound)=>{const m0=BigInt(Math.ceil(Math.sqrt(Number(bound)))+1);const tb=new Map();let b=null;
    for(let i=0n;i<m0;i++){tb.set(b===null?"O":F.toString(b[0])+","+F.toString(b[1]),i);b=b===null?G:add(b,G);}
    const st=mul(G,m0),ns=neg(st);let c=target;
    for(let j=0n;j<=m0;j++){const k=c===null?"O":F.toString(c[0])+","+F.toString(c[1]);if(tb.has(k))return j*m0+tb.get(k);c=add(c,ns);}return null;};
  const recLow=bsgs(Mlow,1<<20), recHigh=bsgs(Mhigh,1<<20);
  const recTotal=recLow+BASE*recHigh;
  const winner = recTotal>threshold ? 1n : 0n;

  console.log("totalLow/High 应为", totalLow.toString(), totalHigh.toString());
  console.log("还原    low/high =", recLow.toString(), recHigh.toString(), (recLow===totalLow&&recHigh===totalHigh)?"✅":"❌");
  console.log("total =", recTotal.toString(), " threshold =", threshold.toString(), " winner =", winner.toString(),
              winner===(total>threshold?1n:0n)?"✅":"❌");

  // 写 circuit 2 输入（public: C2*, Dj*, lambda, threshold, winner; private: totalLow/High）
  const input={
    C2Low:S(C2Low), C2High:S(C2High),
    DjLow:DjLow.map(S), DjHigh:DjHigh.map(S),
    lambda:lam.map(x=>x.toString()),
    threshold:threshold.toString(),
    winner:winner.toString(),
    totalLow:recLow.toString(), totalHigh:recHigh.toString(),
  };
  fs.writeFileSync("tally_input.json",JSON.stringify(input,null,2));
  console.log("\n已写出 tally_input.json");
})();

// ============================================================================
//  Week 7 端到端编排：用同一套委员会密钥，把"投票→聚合→门限解密→计票"串起来。
//  产出三类证明输入（每个投票者一个 vote、3 个委员会成员、1 个 tally），
//  并自检：链下聚合 + 门限解密能还原出正确 total / winner。
//  —— 这保证你拿去 snarkjs 生成的三种证明、以及链上调用，输入是连贯一致的。
//  运行： node orchestrate.js
// ============================================================================
const { buildPoseidon, buildBabyjub } = require("circomlibjs");
const fs = require("fs");

const DEPTH = 10, BASE = 1024n, POLL_ID = 42n, THRESHOLD = 3000n;
const N = 4;                       // 演示 4 个投票者
const COMMITTEE_N = 5, T = 3;      // 3-of-5 委员会

(async () => {
  const poseidon = await buildPoseidon(), babyjub = await buildBabyjub();
  const Fp = poseidon.F, Fb = babyjub.F;
  const H = (a) => Fp.toObject(poseidon(a));
  const G = babyjub.Base8, q = babyjub.subOrder;
  const mul = (P,s)=>babyjub.mulPointEscalar(P,s), add=(P,Q)=>babyjub.addPoint(P,Q);
  const neg = (P)=>[Fb.neg(P[0]),P[1]];
  const Spt = (P)=>[Fb.toString(P[0]),Fb.toString(P[1])];
  const mod=(a,m)=>((a%m)+m)%m;
  const rnd=()=>{let x=0n;for(let i=0;i<4;i++)x=(x<<64n)|BigInt(Math.floor(Math.random()*2**32));return (x%(q-1n))+1n;};
  const inv=(a)=>{let[r0,r1]=[mod(a,q),q],[s0,s1]=[1n,0n];while(r1!==0n){const t=r0/r1;[r0,r1]=[r1,r0-t*r1];[s0,s1]=[s1,s0-t*s1];}return mod(s0,q);};
  const ID = [Fb.e(0n), Fb.e(1n)];     // 单位元（域元素形式）

  // ---- 1) 委员会 Shamir 建钥 ----
  const sk = rnd(), PK = mul(G, sk);
  const coeffs=[sk]; for(let i=1;i<T;i++) coeffs.push(rnd());
  const f=(x)=>{let y=0n,xp=1n;for(const c of coeffs){y=mod(y+c*xp,q);xp=mod(xp*x,q);}return y;};
  const members=[]; for(let j=1;j<=COMMITTEE_N;j++){const s=f(BigInt(j));members.push({id:j,share:s,pk:mul(G,s)});}

  // ---- 2) 建注册树（深度10，前 N 个是真实选民，其余 0 叶子）----
  const voters=[];
  for(let i=0;i<N;i++){
    const secret=rnd();
    const a=BigInt(200+100*i), b=BigInt(1+i);          // 各人不同权重
    const weight=a+BASE*b;
    const idc=H([secret]);
    const leaf=H([idc,weight]);
    voters.push({secret,a,b,weight,vote: i%2===0?1n:0n, leaf});  // 偶数号投1
  }
  const size=1<<DEPTH;
  let level=new Array(size).fill(0n);
  for(let i=0;i<N;i++) level[i]=voters[i].leaf;
  const tree=[level];
  for(let d=0;d<DEPTH;d++){const nx=[];for(let i=0;i<level.length;i+=2)nx.push(H([level[i],level[i+1]]));tree.push(nx);level=nx;}
  const root=level[0];
  const pathOf=(idx)=>{const pe=[],pi=[];let id=idx;for(let d=0;d<DEPTH;d++){const sib=id^1;pe.push(tree[d][sib].toString());pi.push(id&1);id>>=1;}return{pe,pi};};

  // ---- 3) 每个选民：vote_full 输入 + 记录密文 ----
  let aggC1L=ID,aggC2L=ID,aggC1H=ID,aggC2H=ID;
  let expLow=0n,expHigh=0n;
  fs.mkdirSync("e2e",{recursive:true});
  voters.forEach((v,i)=>{
    const {pe,pi}=pathOf(i);
    const mLow=v.vote*v.a, mHigh=v.vote*v.b;
    const rL=rnd(), rH=rnd();
    const C1L=mul(G,rL), C2L=add(mul(G,mLow),mul(PK,rL));
    const C1H=mul(G,rH), C2H=add(mul(G,mHigh),mul(PK,rH));
    aggC1L=add(aggC1L,C1L); aggC2L=add(aggC2L,C2L); aggC1H=add(aggC1H,C1H); aggC2H=add(aggC2H,C2H);
    expLow+=mLow; expHigh+=mHigh;
    fs.writeFileSync(`e2e/vote_${i}.json`, JSON.stringify({
      identitySecret:v.secret.toString(), weightA:v.a.toString(), weightB:v.b.toString(),
      vote:v.vote.toString(), rLow:rL.toString(), rHigh:rH.toString(),
      pathElements:pe, pathIndices:pi, root:root.toString(), pollId:POLL_ID.toString(), PK:Spt(PK)
    },null,2));
  });

  // ---- 4) 选 3 个成员，对聚合 C1 做部分解密 + 生成 committee 输入 ----
  const S=[members[0],members[2],members[4]];
  const Dlist=S.map(m=>({id:m.id, DL:mul(aggC1L,m.share), DH:mul(aggC1H,m.share)}));
  S.forEach((m,k)=>{
    fs.writeFileSync(`e2e/committee_${m.id}.json`, JSON.stringify({
      skj:m.share.toString(), C1Low:Spt(aggC1L), C1High:Spt(aggC1H)
    },null,2));
  });

  // ---- 5) Lagrange + 合并 + BSGS 还原（这也是 tally 的私密输入）----
  const ids=S.map(s=>BigInt(s.id));
  const lam=(j)=>{let nu=1n,de=1n;for(const l of ids)if(l!==j){nu=mod(nu*l,q);de=mod(de*mod(l-j,q),q);}return mod(nu*inv(de),q);};
  const lambdas=Dlist.map(d=>lam(BigInt(d.id)));
  let combL=ID,combH=ID;
  Dlist.forEach((d,k)=>{combL=add(combL,mul(d.DL,lambdas[k]));combH=add(combH,mul(d.DH,lambdas[k]));});
  const ML=add(aggC2L,neg(combL)), MH=add(aggC2H,neg(combH));
  function bsgs(target,bound){const m0=BigInt(Math.ceil(Math.sqrt(Number(bound)))+1);const tb=new Map();let b=ID;
    for(let i=0n;i<m0;i++){tb.set(Fb.toString(b[0])+","+Fb.toString(b[1]),i);b=add(b,G);}
    const st=mul(G,m0),ns=neg(st);let c=target;
    for(let j=0n;j<=m0;j++){const k=Fb.toString(c[0])+","+Fb.toString(c[1]);if(tb.has(k))return j*m0+tb.get(k);c=add(c,ns);}return null;}
  const totalLow=bsgs(ML,1<<21), totalHigh=bsgs(MH,1<<21);
  const total=totalLow+BASE*totalHigh;
  const winner=total>THRESHOLD?1n:0n;

  // ---- 6) tally 输入 ----
  const flat=(arr)=>arr.reduce((o,p)=>o.concat(Spt(p)),[]);
  fs.writeFileSync("e2e/tally.json", JSON.stringify({
    C2Low:Spt(aggC2L), C2High:Spt(aggC2H),
    DjLow:Dlist.map(d=>Spt(d.DL)), DjHigh:Dlist.map(d=>Spt(d.DH)),
    lambda:lambdas.map(x=>x.toString()), threshold:THRESHOLD.toString(),
    winner:winner.toString(), totalLow:totalLow.toString(), totalHigh:totalHigh.toString()
  },null,2));

  // ---- 自检 ----
  console.log("选民数 N =", N, " 委员会 3-of-5");
  console.log("期望 low/high =", expLow.toString(), expHigh.toString());
  console.log("还原 low/high =", totalLow.toString(), totalHigh.toString(),
              (totalLow===expLow&&totalHigh===expHigh)?"✅":"❌");
  console.log("total =", total.toString(), " threshold =", THRESHOLD.toString(), " winner =", winner.toString());
  console.log("\n已写出 e2e/ 下：", N, "个 vote_*.json、3 个 committee_*.json、tally.json");
  console.log("聚合 C1Low =", Spt(aggC1L));
  console.log("委员会成员顺序 (memberIds):", S.map(m=>m.id).join(","), "← 链上按这个顺序提交");
})();

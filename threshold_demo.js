// ===========================================================================
//  门限 ElGamal 解密 端到端 demo（BN254 G1 曲线）
//  目的：用「真实的」密钥分片 + 真实的零知识证明，代替你脚本里的 "0x1111"
//  运行：  npm install @noble/curves@1.6.0   然后   node threshold_demo.js
// ===========================================================================
const { bn254 } = require("@noble/curves/bn254");
const { keccak_256 } = require("@noble/hashes/sha3");

const P = bn254.G1.ProjectivePoint;   // G1 上的点（用投影坐标表示）
const G = P.BASE;                       // 生成元 G
const q = bn254.G1.CURVE.n;             // 群的阶（标量必须 mod q）

// ---- 小工具 ----
const rnd = () => {                     // 随机标量 ∈ [1, q)
  let x = 0n;
  for (let i = 0; i < 4; i++) x = (x << 64n) | BigInt(Math.floor(Math.random() * 2 ** 32));
  return (x % (q - 1n)) + 1n;
};
const mod = (a, m) => ((a % m) + m) % m;
// 模逆（费马小定理，q 是素数）
const inv = (a) => {
  let [old_r, r] = [mod(a, q), q], [old_s, s] = [1n, 0n];
  while (r !== 0n) { const t = old_r / r; [old_r, r] = [r, old_r - t * r]; [old_s, s] = [s, old_s - t * s]; }
  return mod(old_s, q);
};
// 把一个点序列化成 64 字节（x、y 各 32 字节）用于哈希 / 当 map 的 key
const ptBytes = (pt) => {
  const { x, y } = pt.toAffine();
  const out = new Uint8Array(64);
  for (let i = 0; i < 32; i++) { out[31 - i] = Number((x >> BigInt(8 * i)) & 0xffn); out[63 - i] = Number((y >> BigInt(8 * i)) & 0xffn); }
  return out;
};
const ptKey = (pt) => { const { x, y } = pt.toAffine(); return x.toString(16) + ":" + y.toString(16); };
// 把若干个点哈希成一个挑战标量 e（Fiat–Shamir）
const hashToScalar = (...points) => {
  const chunks = points.map(ptBytes);
  const total = new Uint8Array(chunks.length * 64);
  chunks.forEach((c, i) => total.set(c, i * 64));
  let e = 0n; for (const x of keccak_256(total)) e = (e << 8n) | BigInt(x);
  return mod(e, q);
};

// === 1) 委员会建钥（这里用「可信发牌人」简化版 DKG）====================
//     n 个成员，门限 t：任意 t 个成员就能解密，少于 t 个则什么都得不到。
const n = 5, t = 3;
const sk = rnd();                       // 整个委员会的私钥（真实系统里没人能单独看到它）
const pk = G.multiply(sk);              // 委员会公钥（公开）

// Shamir 分片：构造一个 t-1 次多项式 f，使 f(0)=sk，给成员 j 分片 f(j)
const coeffs = [sk];                    // f(x)=sk + a1*x + ... + a_{t-1} x^{t-1}
for (let i = 1; i < t; i++) coeffs.push(rnd());
const f = (x) => { let y = 0n, xp = 1n; for (const c of coeffs) { y = mod(y + c * xp, q); xp = mod(xp * x, q); } return y; };

const members = [];
for (let j = 1; j <= n; j++) {
  const share = f(BigInt(j));           // 成员 j 的私钥分片 sk_j
  members.push({ id: j, share, pkShare: G.multiply(share) }); // pk_j = sk_j*G 公开
}

// === 2) 投票产生的「聚合密文」（指数 ElGamal）==========================
//     m = 总的 yes 权重（一个不太大的整数；这就是为什么要做 weight-cap）
const m = 12345n;                       // 假设最终 yes 权重 = 12345
const r = rnd();
const C1 = G.multiply(r);               // C1 = r*G
const C2 = G.multiply(m).add(pk.multiply(r)); // C2 = m*G + r*pk
console.log(`明文权重 m = ${m}，已用委员会公钥加密成 (C1, C2)`);

// === 3) 每个成员做「部分解密」+ 出一份 Chaum–Pedersen 证明 ============
//     这一步替代你脚本里的  dj=["0x1111","0x2222"], sigmaj="0xabcdef"
function partialDecrypt(member) {
  const D = C1.multiply(member.share);  // D_j = sk_j * C1   ← 真实分片！
  // 证明：log_G(pk_j) == log_{C1}(D_j) == sk_j，但不泄露 sk_j
  const k = rnd();
  const A1 = G.multiply(k);             // A1 = k*G
  const A2 = C1.multiply(k);            // A2 = k*C1
  const e = hashToScalar(G, member.pkShare, C1, D, A1, A2); // 挑战
  const z = mod(k + e * member.share, q);                   // 应答
  return { id: member.id, D, proof: { e, z } };
}

// 验证证明（链下先验一遍；链上 Solidity 也会做同样的检查）
function verifyPartial(pkShare, D, proof) {
  const { e, z } = proof;
  const A1 = G.multiply(z).add(pkShare.multiply(mod(-e, q)));  // = z*G - e*pk_j
  const A2 = C1.multiply(z).add(D.multiply(mod(-e, q)));       // = z*C1 - e*D_j
  return e === hashToScalar(G, pkShare, C1, D, A1, A2);        // 重算挑战是否一致
}

// === 4) 任取 t 个成员，合并得到结果 ===================================
const S = [members[0], members[2], members[4]]; // 比如成员 1、3、5 在线（演示「任意 t 个」）
const parts = S.map(partialDecrypt);

// 先逐个验证证明
for (const p of parts) {
  const mem = members.find(x => x.id === p.id);
  const ok = verifyPartial(mem.pkShare, p.D, p.proof);
  console.log(`成员 ${p.id} 的部分解密证明验证: ${ok ? "✅ 通过" : "❌ 失败"}`);
  if (!ok) process.exit(1);
}

// Lagrange 系数 λ_j（在 0 点插值），Σ λ_j * D_j = sk*C1 = r*pk
const ids = S.map(s => BigInt(s.id));
function lagrange(j) {
  let num = 1n, den = 1n;
  for (const l of ids) if (l !== j) { num = mod(num * mod(-l, q), q); den = mod(den * mod(j - l, q), q); }
  return mod(num * inv(den), q);
}
let combined = P.ZERO;
for (const p of parts) combined = combined.add(p.D.multiply(lagrange(BigInt(p.id))));

// M = C2 - Σ λ_j D_j = m*G
const M = C2.add(combined.negate());

// === 5) 从 M = m*G 还原出整数 m（baby-step giant-step，范围有界才可行）==
function bsgs(target, maxBound) {
  const stepN = BigInt(Math.ceil(Math.sqrt(Number(maxBound))) + 1);
  const table = new Map();
  let baby = P.ZERO;
  for (let i = 0n; i < stepN; i++) { table.set(ptKey(baby), i); baby = baby.add(G); }
  const giantStride = G.multiply(stepN).negate();
  let cur = target;
  for (let i = 0n; i <= stepN; i++) {
    const hit = table.get(ptKey(cur));
    if (hit !== undefined) return i * stepN + hit;
    cur = cur.add(giantStride);
  }
  return null;
}
const recovered = bsgs(M, 1n << 20n);   // 权重上界 2^20（和论文里 weight-cap 对应）
console.log(`\n还原出的明文权重 = ${recovered}`);
console.log(`和原始 m 是否一致: ${recovered === m ? "✅ 完全正确" : "❌ 不一致"}`);

// === 6) 验证「少于 t 个成员」确实无法恢复（信息论安全）===============
const tooFew = [members[0], members[1]].map(partialDecrypt); // 只有 2 个 < t=3
let badCombine = P.ZERO;
const ids2 = [1n, 2n];
for (const p of tooFew) {
  let num = 1n, den = 1n;
  for (const l of ids2) if (l !== BigInt(p.id)) { num = mod(num * mod(-l, q), q); den = mod(den * mod(BigInt(p.id) - l, q), q); }
  badCombine = badCombine.add(p.D.multiply(mod(num * inv(den), q)));
}
const Mbad = C2.add(badCombine.negate());
const recBad = bsgs(Mbad, 1n << 20n);
console.log(`\n只用 2 个成员（< t）还原结果: ${recBad === m ? "竟然对了（不应该）" : "得到错误值，无法恢复 ✅（符合门限安全）"}`);

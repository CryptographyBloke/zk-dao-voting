// ============================================================================
//  Week 2 基础：BabyJubjub 上的 2-limb 指数 ElGamal（加密 + 解密自检）
//  这就是 circom 加密电路要算出的「标准答案」，也是委员会解密的输入。
//  运行： node babyjub_elgamal.js
// ============================================================================
const { buildBabyjub } = require("circomlibjs");

(async () => {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;
  const G = babyjub.Base8;                 // BabyJubjub 子群生成元
  const order = babyjub.subOrder;          // 子群阶（标量 mod 它）

  const mul = (P, s) => babyjub.mulPointEscalar(P, s);
  const add = (P, Q) => babyjub.addPoint(P, Q);
  const eq  = (P, Q) => F.eq(P[0], Q[0]) && F.eq(P[1], Q[1]);
  const show = (P) => [F.toString(P[0]), F.toString(P[1])];
  const rnd = () => {                       // 随机标量 ∈ [1, order)
    let x = 0n;
    for (let i = 0; i < 4; i++) x = (x << 64n) | BigInt(Math.floor(Math.random() * 2 ** 32));
    return (x % (order - 1n)) + 1n;
  };

  // ---- 1) 委员会公钥（Week 5 会换成 Shamir 分片；这里先单钥验证加密正确性）----
  const sk = rnd();
  const PK = mul(G, sk);

  // ---- 2) 选民的权重 limb 和投票 ----
  const BASE = 1024n;
  const a = 700n, b = 3n;                   // w = a + 1024b = 3772
  const v = 1n;                             // 投 1
  const mLow  = (v * a) % order;            // 低位明文 = v·a
  const mHigh = (v * b) % order;            // 高位明文 = v·b

  // ---- 3) 对每个 limb 做指数 ElGamal：C1=r·G, C2=m·G+r·PK ----
  function encrypt(m) {
    const r = rnd();
    const C1 = mul(G, r);
    const C2 = add(mul(G, m), mul(PK, r));  // m·G + r·PK
    return { r, C1, C2 };
  }
  const low  = encrypt(mLow);
  const high = encrypt(mHigh);

  console.log("低位密文 C1_low =", show(low.C1));
  console.log("低位密文 C2_low =", show(low.C2));
  console.log("高位密文 C1_high=", show(high.C1));
  console.log("高位密文 C2_high=", show(high.C2));

  // ---- 4) 解密自检：M = C2 - sk·C1 = m·G，再 BSGS 还原小整数 m ----
  function bsgs(target, bound) {
    const m0 = BigInt(Math.ceil(Math.sqrt(Number(bound))) + 1);
    const table = new Map();
    let baby = null;                        // 0·G 用 null 表示无穷远点
    for (let i = 0n; i < m0; i++) {
      const key = baby === null ? "O" : F.toString(baby[0]) + "," + F.toString(baby[1]);
      table.set(key, i);
      baby = baby === null ? G : add(baby, G);
    }
    const stride = mul(G, m0);              // giant step = m0·G
    const negStride = [F.neg(stride[0]), stride[1]]; // -P = (-x, y) 在扭曲爱德华兹曲线上
    let cur = target;
    for (let j = 0n; j <= m0; j++) {
      const key = cur === null ? "O" : F.toString(cur[0]) + "," + F.toString(cur[1]);
      if (table.has(key)) return j * m0 + table.get(key);
      cur = add(cur, negStride);
    }
    return null;
  }
  function decrypt(ct, bound) {
    const skC1 = mul(ct.C1, sk);
    const negSkC1 = [F.neg(skC1[0]), skC1[1]];
    const M = add(ct.C2, negSkC1);          // M = C2 - sk·C1 = m·G
    return bsgs(M, bound);
  }

  const decLow  = decrypt(low,  Number(BASE));
  const decHigh = decrypt(high, Number(BASE));
  const wRecovered = decLow + BASE * decHigh;

  console.log("\n解密低位 =", decLow.toString(), "(应为", mLow.toString() + ")");
  console.log("解密高位 =", decHigh.toString(), "(应为", mHigh.toString() + ")");
  console.log("还原权重 w =", wRecovered.toString(), "(应为", (v * (a + BASE * b)).toString() + ")");
  console.log("结果:", wRecovered === v * (a + BASE * b) ? "✅ 加密/解密完全正确" : "❌ 出错");
})();

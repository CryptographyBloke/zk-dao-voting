// ============================================================================
//  Week 2 输入生成器（含 ElGamal）+ 自检 + 密文预测
//  运行： npm i circomlibjs@0.1.7 && node gen_input_full.js
//  产出： input_full.json（喂电路）；并打印电路应当输出的 4 个密文，供你比对
// ============================================================================
const { buildPoseidon, buildBabyjub } = require("circomlibjs");
const fs = require("fs");
const crypto = require("crypto");

const DEPTH = 10, BASE = 1024n, POLL_ID = 42n;

(async () => {
  const poseidon = await buildPoseidon();
  const Fp = poseidon.F;
  const H = (arr) => Fp.toObject(poseidon(arr));

  const bj = await buildBabyjub();
  const F = bj.F;
  const G = bj.Base8;
  const l = bj.subOrder;
  // CSPRNG：密码学安全随机标量（修复原 Math.random 可预测 → ElGamal 随机数可爆破、票面隐私失效）
  const rndScalar = () => { let x; do { x = BigInt("0x" + crypto.randomBytes(32).toString("hex")) % l; } while (x === 0n); return x; };
  const ptStr = (p) => [F.toString(p[0]), F.toString(p[1])];

  // ---- 选民 + 权重 ----
  const identitySecret = 123456789n;
  const idCommitment = H([identitySecret]);
  const weightA = 700n, weightB = 3n;
  const weight = weightA + BASE * weightB;
  const vote = 1n;
  const leaf = H([idCommitment, weight]);

  // ---- Merkle（同 Week 1）----
  const leafIndex = 5n;
  let zeros = [0n];
  for (let i = 0; i < DEPTH; i++) zeros.push(H([zeros[i], zeros[i]]));
  let cur = leaf, idx = leafIndex;
  const pathElements = [], pathIndices = [];
  for (let i = 0; i < DEPTH; i++) {
    const bit = idx & 1n, sib = zeros[i];
    pathElements.push(sib.toString()); pathIndices.push(Number(bit));
    cur = (bit === 0n) ? H([cur, sib]) : H([sib, cur]);
    idx >>= 1n;
  }
  const root = cur;
  const nullifierHash = H([identitySecret, POLL_ID]);

  // ---- 委员会密钥（演示：单把密钥；真实里是 t-of-n 分片，但 PK 形式一样）----
  const committeeSk = rndScalar();
  const PK = bj.mulPointEscalar(G, committeeSk);

  // ---- 两路 ElGamal 加密：mLow=v*a, mHigh=v*b ----
  const mLow = vote * weightA;     // 700
  const mHigh = vote * weightB;    // 3
  const rLow = rndScalar(), rHigh = rndScalar();

  const enc = (m, r) => {
    const C1 = bj.mulPointEscalar(G, r);
    const C2 = bj.addPoint(bj.mulPointEscalar(G, m), bj.mulPointEscalar(PK, r));
    return { C1, C2 };
  };
  const eLow = enc(mLow, rLow);
  const eHigh = enc(mHigh, rHigh);

  // ---- 路径自检 ----
  let chk = leaf;
  for (let i = 0; i < DEPTH; i++) chk = (pathIndices[i] === 0) ? H([chk, BigInt(pathElements[i])]) : H([BigInt(pathElements[i]), chk]);
  console.log("Merkle 路径自检:", chk === root ? "✅" : "❌");

  // ---- 写电路输入 ----
  const input = {
    identitySecret: identitySecret.toString(),
    weightA: weightA.toString(), weightB: weightB.toString(),
    vote: vote.toString(),
    pathElements, pathIndices,
    rLow: rLow.toString(), rHigh: rHigh.toString(),
    root: root.toString(), pollId: POLL_ID.toString(),
    PK: ptStr(PK),
  };
  fs.writeFileSync("input_full.json", JSON.stringify(input, null, 2));
  console.log("已写出 input_full.json");

  // ---- 打印电路「应当」输出的公开信号，供你比对 witness ----
  console.log("\n=== 电路应输出的公开信号（按顺序比对 witness）===");
  console.log("nullifierHash =", nullifierHash.toString());
  console.log("C1Low  =", ptStr(eLow.C1));
  console.log("C2Low  =", ptStr(eLow.C2));
  console.log("C1High =", ptStr(eHigh.C1));
  console.log("C2High =", ptStr(eHigh.C2));
})();

// ============================================================================
//  Week 1 输入生成器 + 自检
//  作用：1) 建一棵深度10的 Poseidon Merkle 注册树
//        2) 算出某个选民的 leaf、Merkle 路径、nullifier
//        3) 生成 circuit 需要的 input.json
//        4) 自己先验证「路径能重算出 root」，确保喂给电路的数据是对的
//  运行： npm i circomlibjs@0.1.7 && node gen_input.js
// ============================================================================
const { buildPoseidon } = require("circomlibjs");
const fs = require("fs");

const DEPTH = 10;          // Merkle 深度（2^10 = 1024 个选民）
const BASE  = 1024n;       // 权重 limb 的基数 B
const POLL_ID = 42n;       // 当前投票的编号（用于 nullifier，防跨票重放）

(async () => {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const H = (arr) => F.toObject(poseidon(arr));   // Poseidon 哈希，返回 BigInt

  // ---- 1) 造一个选民身份 + 权重 ----
  const identitySecret = 123456789n;              // 选民私密值（真实里是随机的）
  const idCommitment   = H([identitySecret]);     // Poseidon(1)
  const weightA = 700n;                            // 低位 limb (< 1024)
  const weightB = 3n;                              // 高位 limb (< 1024)
  const weight  = weightA + BASE * weightB;        // w = a + 1024b = 3772
  const vote    = 1n;                              // 投 0 或 1

  // leaf = Poseidon(idCommitment, weight)  ← 把权重绑死在叶子里，选民没法谎报权重
  const leaf = H([idCommitment, weight]);

  // ---- 2) 把这个 leaf 放进一棵深度10的树，其余位置先用 0 叶子填充 ----
  const leafIndex = 5n;                            // 这个选民在树里的位置（第5个）
  let zeros = [0n];                                // 各层的「空子树」哈希
  for (let i = 0; i < DEPTH; i++) zeros.push(H([zeros[i], zeros[i]]));

  // 只放我们这一个真实 leaf，其余按空子树算（演示用；真实树会有很多 leaf）
  let cur = leaf;
  let idx = leafIndex;
  const pathElements = [];
  const pathIndices = [];
  for (let i = 0; i < DEPTH; i++) {
    const bit = idx & 1n;                          // 当前层我是左(0)还是右(1)孩子
    const sibling = zeros[i];                       // 兄弟节点（这里都是空子树）
    pathElements.push(sibling.toString());
    pathIndices.push(Number(bit));
    // 按左右顺序往上哈希
    cur = (bit === 0n) ? H([cur, sibling]) : H([sibling, cur]);
    idx >>= 1n;
  }
  const root = cur;

  // ---- 3) nullifier = Poseidon(identitySecret, pollId) ----
  const nullifierHash = H([identitySecret, POLL_ID]);

  // ---- 4) 自检：用 leaf + 路径，能不能重算出同一个 root ----
  let check = leaf;
  for (let i = 0; i < DEPTH; i++) {
    const sib = BigInt(pathElements[i]);
    check = (pathIndices[i] === 0) ? H([check, sib]) : H([sib, check]);
  }
  console.log("leaf   =", leaf.toString());
  console.log("root   =", root.toString());
  console.log("重算root=", check.toString());
  console.log("路径自检:", check === root ? "✅ 一致（数据正确）" : "❌ 不一致");
  console.log("nullifier =", nullifierHash.toString());

  // ---- 5) 写出电路输入 ----
  const input = {
    identitySecret: identitySecret.toString(),
    weightA: weightA.toString(),
    weightB: weightB.toString(),
    vote: vote.toString(),
    pathElements,
    pathIndices,
    root: root.toString(),
    pollId: POLL_ID.toString(),
  };
  fs.writeFileSync("input.json", JSON.stringify(input, null, 2));
  console.log("\n已写出 input.json（喂给电路用）");
})();

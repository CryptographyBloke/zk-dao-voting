// ============================================================================
//  Week 7：端到端部署 + 测真实 gas（Table IV）+ 抓取真实 TxHash
// ============================================================================
const hre = require("hardhat");
const fs = require("fs");
const DIR = "e2e/proofs";

// 把 snarkjs 的 proof.json + public.json 转成合约 verifyProof 需要的 (a,b,c,pub)
function load(name) {
  const p = JSON.parse(fs.readFileSync(`${DIR}/${name}_proof.json`));
  const pub = JSON.parse(fs.readFileSync(`${DIR}/${name}_public.json`));
  const a = [p.pi_a[0], p.pi_a[1]];
  const b = [[p.pi_b[0][1], p.pi_b[0][0]], [p.pi_b[1][1], p.pi_b[1][0]]]; // G2 注意交换顺序
  const c = [p.pi_c[0], p.pi_c[1]];
  return { a, b, c, pub };
}

async function main() {
  const POLL_ID = 42, THRESHOLD = 3000;
  // root = 投票公开信号里的 pub[9]
  const root = JSON.parse(fs.readFileSync(`${DIR}/vote_0_public.json`))[9];

  // 1) 部署三个 verifier + DAOVote
  const V = await (await hre.ethers.getContractFactory("VoteVerifier")).deploy();
  const C = await (await hre.ethers.getContractFactory("CommitteeVerifier")).deploy();
  const T = await (await hre.ethers.getContractFactory("TallyVerifier")).deploy();
  await V.waitForDeployment(); await C.waitForDeployment(); await T.waitForDeployment();
  const DAO = await (await hre.ethers.getContractFactory("DAOVote")).deploy(
    await V.getAddress(), await C.getAddress(), await T.getAddress(), root, POLL_ID, THRESHOLD);
  await DAO.waitForDeployment();
  console.log("DAOVote 部署于", await DAO.getAddress());

  // 2) 注册委员会成员 1,3,5（pk_j 取自各自 committee 证明的公开输出 pub[0..1]）
  for (const id of [1, 3, 5]) {
    const pub = JSON.parse(fs.readFileSync(`${DIR}/committee_${id}_public.json`));
    await (await DAO.registerCommitteeMember(id, [pub[0], pub[1]])).wait();
  }

  // 3) 先提交全部 4 张票（建立链上聚合）—— 必须在部分解密之前
  let voteGas;
  for (let i = 0; i < 4; i++) {
    const { a, b, c, pub } = load(`vote_${i}`);
    const tx = await DAO.submitVote(a, b, c, pub);
    const receipt = await tx.wait();
    voteGas = receipt.gasUsed.toString();
    console.log(`submitVote[${i}] gas = ${voteGas} | TxHash = ${receipt.hash}`);
  }

  // 4) 三个成员提交部分解密（顺序必须和 orchestrate 的 memberIds 一致：1,3,5）
  let pdGas;
  for (const id of [1, 3, 5]) {
    const { a, b, c, pub } = load(`committee_${id}`);
    const tx = await DAO.submitPartialDecrypt(id, a, b, c, pub);
    const receipt = await tx.wait();
    pdGas = receipt.gasUsed.toString();
    console.log(`submitPartialDecrypt[${id}] gas = ${pdGas} | TxHash = ${receipt.hash}`);
  }

  // 5) finalize（合约自己算 λ，验 tally 证明，读出赢家）
  const tallyCall = load("tally");
  const txFinal = await DAO.finalize(tallyCall.a, tallyCall.b, tallyCall.c, tallyCall.pub);
  const receiptFinal = await txFinal.wait();
  const finGas = receiptFinal.gasUsed.toString();
  console.log(`finalize gas = ${finGas} | TxHash = ${receiptFinal.hash}`);

  console.log("\n=== Table IV（真实 gas 与链上哈希）===");
  console.log("Vote submit       :", voteGas);
  console.log("Partial decrypt   :", pdGas);
  console.log("Finalize          :", finGas);
  console.log("链上赢家 winner    :", (await DAO.winner()).toString(), "(应为 1)");
}

main().catch((e) => { console.error(e); process.exit(1); });

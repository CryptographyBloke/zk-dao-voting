const hre = require("hardhat");
const { bn254 } = require("@noble/curves/bn254");
const { keccak_256 } = require("@noble/hashes/sha3");

// ---- 链下密码学引擎 (复用你的代码) ----
const P = bn254.G1.ProjectivePoint;
const G = P.BASE;
const q = bn254.G1.CURVE.n;
const mod = (a, m) => ((a % m) + m) % m;
const rnd = () => {
    let x = 0n;
    for (let i = 0; i < 4; i++) x = (x << 64n) | BigInt(Math.floor(Math.random() * 2 ** 32));
    return (x % (q - 1n)) + 1n;
};
const ptBytes = (pt) => {
    const { x, y } = pt.toAffine();
    const out = new Uint8Array(64);
    for (let i = 0; i < 32; i++) { out[31 - i] = Number((x >> BigInt(8 * i)) & 0xffn); out[63 - i] = Number((y >> BigInt(8 * i)) & 0xffn); }
    return out;
};
const hashToScalar = (...points) => {
    const chunks = points.map(ptBytes);
    const total = new Uint8Array(chunks.length * 64);
    chunks.forEach((c, i) => total.set(c, i * 64));
    let e = 0n; for (const x of keccak_256(total)) e = (e << 8n) | BigInt(x);
    return mod(e, q);
};
// 转换辅助函数：将点转为智能合约需要的 [uint256, uint256] 格式
const toContractPoint = (pt) => [ "0x" + pt.toAffine().x.toString(16), "0x" + pt.toAffine().y.toString(16) ];

async function main() {
    console.log("🚀 启动真实的门限解密上链 Gas 测试...");

    // 1. 部署合约
    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const DAOVote = await hre.ethers.getContractFactory("DAOVote");
    const daoVote = await DAOVote.deploy(await verifier.getAddress());
    await daoVote.waitForDeployment();

    // 2. 链下生成真实的委员会私钥分片和证明参数
    console.log("⚙️ 正在本地生成真实的密码学参数...");
    const sk_j = rnd(); // 模拟委员会成员的私钥分片
    const pk_j = G.multiply(sk_j);
    const r = rnd();
    const C1 = G.multiply(r); // 模拟聚合密文的第一部分
    const D_j = C1.multiply(sk_j); // 真实的解密份额

    // 生成 Chaum-Pedersen 证明
    const k = rnd();
    const A1 = G.multiply(k);
    const A2 = C1.multiply(k);
    const e = hashToScalar(G, pk_j, C1, D_j, A1, A2);
    const z = mod(k + e * sk_j, q);

    // 格式化为 ethers.js 能发送的数据
    const pk_j_sol = toContractPoint(pk_j);
    const C1_sol = toContractPoint(C1);
    const D_j_sol = toContractPoint(D_j);
    const e_sol = "0x" + e.toString(16);
    const z_sol = "0x" + z.toString(16);

    // 3. 上链交互
    console.log("⏳ [1/2] 注册委员会公钥 (预备工作)...");
    const txReg = await daoVote.registerCommitteeMember(pk_j_sol);
    await txReg.wait();

    console.log("⏳ [2/2] 广播包含真实 CP 证明的 Partial Decrypt 交易...");
    const txDec = await daoVote.submitPartialDecrypt(D_j_sol, C1_sol, e_sol, z_sol);
    const receipt = await txDec.wait();

    console.log("====================================================");
    console.log(`✅ Chaum-Pedersen 证明链上验证通过！`);
    console.log(`📊 【Table IV - Partial Decrypt】真实消耗 Gas: ${receipt.gasUsed.toString()}`);
    console.log(`🔗 查看交易: https://sepolia.arbiscan.io/tx/${txDec.hash}`);
    console.log("====================================================");
}

main().catch(console.error);
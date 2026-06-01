const hre = require("hardhat");

async function main() {
    console.log("🚀 开始最终的 Table IV 全量 Gas 测算...");

    // 1. 部署合约
    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    
    const DAOVote = await hre.ethers.getContractFactory("DAOVote");
    const daoVote = await DAOVote.deploy(await verifier.getAddress());
    await daoVote.waitForDeployment();
    
    const a = ["0x0b6377624a6006ea4517131f83bf36f3c405aa91b6ce60cb20105ff5b5d66d90", "0x1c9f63db2edbc204d3b6ea628da5341f7f42795642cdc3897097086d1fb2afca"];
    const b = [
        ["0x11becfcc6e988573460ea5edf926e3eaf3eb798d3ff2f79d463b57c1496191d7", "0x0e4fdcad1526eab3786ea78bd9af71730b2e312be5401e594de682a11c3de36d"],
        ["0x01580fadf164b5daadba6888343b5ca704dd50a23a0f9773b7bd2832ad2edd00", "0x02f5c69e2fc2f82a8559569fa0653e133c27524df6c91347f6dd2f8bcbb96fa2"]
    ];
    const c = ["0x205cf2b0b1d3991684c18715c0f62405a101013b4d21d7b4d145aeab5b2b8852", "0x2ee18eddbc5e63db8af31d8f864a994ebd1726a98336d3a8cc4e700c1e8bca3b"];
    const Input = ["0x23e8b8acd2dbe131aefba56799433006371a93cd732e861e5f2d409341515f21"];
    const ciphertext = ["0x1234567890abcdef", "0x0987654321fedcba"]; 
    const nullifier = hre.ethers.id("user_voter_001");

    // 定义打印交易信息的辅助函数
    const logTx = (name, tx, receipt) => {
        console.log(`✅ ${name} 成功!`);
        console.log(`   交易哈希: ${tx.hash}`);
        console.log(`   区块确认: ${receipt.blockNumber}`);
        console.log(`   消耗 Gas: ${receipt.gasUsed.toString()}`);
        console.log(`   查看链接: https://sepolia.arbiscan.io/tx/${tx.hash}`);
    };

    // === 测量 1: Vote Submit ===
    console.log("\n⏳ [1/3] 正在广播 Vote Submit...");
    const tx1 = await daoVote.submitVote(a, b, c, Input, ciphertext, nullifier);
    const r1 = await tx1.wait();
    logTx("Vote Submit", tx1, r1);

    // === 测量 2: Partial Decrypt ===
    console.log("\n⏳ [2/3] 正在广播 Partial Decrypt...");
    const dj = ["0x1111", "0x2222"];
    const sigmaj = "0xabcdef";
    const tx2 = await daoVote.submitPartialDecrypt(dj, sigmaj);
    const r2 = await tx2.wait();
    logTx("Partial Decrypt", tx2, r2);

    // === 测量 3: Result Verify ===
    console.log("\n⏳ [3/3] 正在广播 Result Verify...");
    const tx3 = await daoVote.finalizeResult(a, b, c, Input, true);
    const r3 = await tx3.wait();
    logTx("Result Verify", tx3, r3);
}

main().catch(console.error);

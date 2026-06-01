const hre = require("hardhat");

async function main() {
    console.log("🚀 开始部署完整的 DAO 投票系统...");

    // 1. 部署底层的 ZK Verifier
    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier 部署成功:", verifierAddress);

    // 2. 部署顶层的业务合约 DAOVote，并绑定 Verifier
    const DAOVote = await hre.ethers.getContractFactory("DAOVote");
    const daoVote = await DAOVote.deploy(verifierAddress);
    await daoVote.waitForDeployment();
    console.log("✅ DAOVote 业务合约部署成功:", await daoVote.getAddress());

    // 3. 准备测试数据
    const a = ["0x0b6377624a6006ea4517131f83bf36f3c405aa91b6ce60cb20105ff5b5d66d90", "0x1c9f63db2edbc204d3b6ea628da5341f7f42795642cdc3897097086d1fb2afca"];
    const b = [
        ["0x11becfcc6e988573460ea5edf926e3eaf3eb798d3ff2f79d463b57c1496191d7", "0x0e4fdcad1526eab3786ea78bd9af71730b2e312be5401e594de682a11c3de36d"],
        ["0x01580fadf164b5daadba6888343b5ca704dd50a23a0f9773b7bd2832ad2edd00", "0x02f5c69e2fc2f82a8559569fa0653e133c27524df6c91347f6dd2f8bcbb96fa2"]
    ];
    const c = ["0x205cf2b0b1d3991684c18715c0f62405a101013b4d21d7b4d145aeab5b2b8852", "0x2ee18eddbc5e63db8af31d8f864a994ebd1726a98336d3a8cc4e700c1e8bca3b"];
    const Input = ["0x23e8b8acd2dbe131aefba56799433006371a93cd732e861e5f2d409341515f21"];
    
    // 模拟的加密选票和唯一标识符
    const ciphertext = ["0x1234567890abcdef", "0x0987654321fedcba"]; 
    const nullifier = hre.ethers.id("user_voter_001");

    // 获取当前 L2 Gas 费率
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPriceGwei = hre.ethers.formatUnits(feeData.gasPrice, "gwei");

    console.log("\n⏳ 正在广播真实上链交易 (Submit Vote)...");
    
    // 发送真实的修改状态交易
    const tx1 = await daoVote.submitVote(a, b, c, Input, ciphertext, nullifier);
    const receipt1 = await tx1.wait(); // 等待区块确认
    
    const costEth1 = Number(receipt1.gasUsed) * Number(feeData.gasPrice) / 1e18;
    
    console.log("========================================");
    console.log(`📊 【真实上链】Vote Submit 消耗 Gas: ${receipt1.gasUsed.toString()}`);
    console.log(`💸 交易真实耗费 ETH: ${costEth1.toFixed(8)} ETH`);
    console.log(`💵 交易真实耗费 USD (按 ETH=$3000): $${(costEth1 * 3000).toFixed(6)}`);
    console.log("========================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

const hre = require("hardhat");

async function main() {
    console.log("🚀 开始部署并测试零知识证明验证合约 Gas 消耗...");

    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier 部署成功，合约地址:", verifierAddress);

    // 换成你的真实参数
    const a = ["0x0b6377624a6006ea4517131f83bf36f3c405aa91b6ce60cb20105ff5b5d66d90", "0x1c9f63db2edbc204d3b6ea628da5341f7f42795642cdc3897097086d1fb2afca"];
    const b = [
        ["0x11becfcc6e988573460ea5edf926e3eaf3eb798d3ff2f79d463b57c1496191d7", "0x0e4fdcad1526eab3786ea78bd9af71730b2e312be5401e594de682a11c3de36d"],
        ["0x01580fadf164b5daadba6888343b5ca704dd50a23a0f9773b7bd2832ad2edd00", "0x02f5c69e2fc2f82a8559569fa0653e133c27524df6c91347f6dd2f8bcbb96fa2"]
    ];
    const c = ["0x205cf2b0b1d3991684c18715c0f62405a101013b4d21d7b4d145aeab5b2b8852", "0x2ee18eddbc5e63db8af31d8f864a994ebd1726a98336d3a8cc4e700c1e8bca3b"];
    const Input = ["0x23e8b8acd2dbe131aefba56799433006371a93cd732e861e5f2d409341515f21"];

    console.log("⏳ 正在验证证明的有效性...");
    const isValid = await verifier.verifyProof(a, b, c, Input);
    console.log(`🔒 ZK 证明验证结果: ${isValid ? "✅ 成功 (True)" : "❌ 失败 (False)"}`);

    if (!isValid) {
        console.log("⚠️ 证明无效，无法测算 Gas。请检查你的参数是否正确。");
        return;
    }

    console.log("⏳ 正在精确测量 EVM 验证 Gas 消耗...");
    // 终极武器：直接调用 estimateGas 获取底层消耗！
    const gasUsed = await verifier.verifyProof.estimateGas(a, b, c, Input);

    console.log("========================================");
    console.log(`📊 单次 ZK 验证所消耗的 Gas Limit: ${gasUsed.toString()}`);
    console.log("========================================");

    // 计算 Arbitrum L2 真实美元成本
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPriceGwei = hre.ethers.formatUnits(feeData.gasPrice, "gwei");
    console.log(`💰 当前 Arbitrum Sepolia Gas Price: ${gasPriceGwei} gwei`);

    // 换算成 ETH 和 USD (假设 ETH = $3000)
    const costEth = Number(gasUsed) * Number(feeData.gasPrice) / 1e18;
    console.log(`💸 预估消耗 ETH: ${costEth.toFixed(8)} ETH`);
    console.log(`💵 预估消耗 USD (按 ETH=$3000 计算): $${(costEth * 3000).toFixed(6)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

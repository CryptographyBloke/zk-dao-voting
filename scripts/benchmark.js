// benchmark.js
const snarkjs = require("snarkjs");
const fs = require("fs");

async function runBenchmark() {
    console.log("=== Groth16 基准测试 (Node v20) ===");

    // 1. 测量冷启动 IO (将几百 MB 的 zkey 和 wtns 读入内存)
    console.time("[Cold Start] 参数加载到内存耗时");
    const zkey_buffer = new Uint8Array(fs.readFileSync("init_70k.zkey"));
    const wtns_buffer = new Uint8Array(fs.readFileSync("witness_70k.wtns"));
    console.timeEnd("[Cold Start] 参数加载到内存耗时");

    // 2. 测量热启动 Prove (纯粹的 MSM 和 FFT 计算)
    console.log("\n-> 预热完成，开始纯粹的密码学证明生成...");
    console.time("[Warm] 零知识证明生成耗时");
    const { proof, publicSignals } = await snarkjs.groth16.prove(zkey_buffer, wtns_buffer);
    console.timeEnd("[Warm] 零知识证明生成耗时");
}

runBenchmark().then(() => process.exit(0)).catch(console.error);
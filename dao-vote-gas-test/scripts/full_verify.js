const { buildBabyjub } = require("circomlibjs");
const fs = require("fs");
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// ... [此处省略相同的加密/解密函数，确保 workers 共享代码] ...

if (isMainThread) {
    const PROPOSALS = JSON.parse(fs.readFileSync("proposals.json"));
    const numWorkers = 8;
    const chunkSize = Math.ceil(PROPOSALS.length / numWorkers);
    let completed = 0;

    console.log(`🚀 启动全量并行验证：共 ${PROPOSALS.length} 个提案，分配到 ${numWorkers} 个核心...`);

    for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(__filename, {
            workerData: { chunk: PROPOSALS.slice(i * chunkSize, (i + 1) * chunkSize), id: i }
        });
        worker.on('message', (msg) => {
            console.log(msg);
            completed++;
            if (completed === numWorkers) console.log("\n🏆 全量验证结束！");
        });
    }
} else {
    // Worker 线程执行逻辑
    const { chunk, id } = workerData;
    let matchCount = 0;
    for (let p of chunk) {
        // 这里执行你原本的 replay 逻辑
        const r = replay(p.weights.map((w,i)=>({weight:BigInt(w), vote:p.votes[i]})), ...);
        if(r.match) matchCount++;
    }
    parentPort.postMessage(`Core ${id} 完成任务: ${matchCount}/${chunk.length} 匹配`);
}

const { exec } = require('child_process');
const fs = require('fs');

// 将 18 个提案分成 8 份，每份分配给一个核心去跑
const PROPOSALS = JSON.parse(fs.readFileSync("proposals.json"));
const numCores = 8;
const chunkSize = Math.ceil(PROPOSALS.length / numCores);

for (let i = 0; i < numCores; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, PROPOSALS.length);
    if (start >= PROPOSALS.length) break;

    const chunk = PROPOSALS.slice(start, end);
    fs.writeFileSync(`chunk_${i}.json`, JSON.stringify(chunk));

    // 调用原来的核心逻辑（你需要确保 replay_harness.js 中有读取指定文件的逻辑）
    // 或者简单粗暴地，我们直接让每个进程跑一份
    exec(`node scripts/replay_harness.js chunk_${i}.json`, (err, stdout, stderr) => {
        console.log(`Core ${i} 任务完成:\n${stdout}`);
    });
}

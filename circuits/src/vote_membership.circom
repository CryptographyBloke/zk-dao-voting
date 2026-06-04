pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

// ---- 二选一选择器：根据 s(0/1) 决定哈希时左右孩子的顺序 ----
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];
    s * (1 - s) === 0;                       // 强制 s 是 0 或 1
    out[0] <== (in[1] - in[0]) * s + in[0];  // s=0 → in[0]; s=1 → in[1]
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// ---- 标准 Poseidon Merkle 成员证明 ----
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hashers[levels];
    component muxes[levels];
    signal levelHash[levels + 1];
    levelHash[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        muxes[i] = DualMux();
        muxes[i].in[0] <== levelHash[i];
        muxes[i].in[1] <== pathElements[i];
        muxes[i].s    <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== muxes[i].out[0];
        hashers[i].inputs[1] <== muxes[i].out[1];
        levelHash[i + 1] <== hashers[i].out;
    }
    root === levelHash[levels];              // 算到顶必须等于公开的 root
}

// ============================================================================
//  Week 1 投票电路：成员证明 + 权重绑定 + nullifier + 投票合法性
//  （还没加 ElGamal 加密，Week 2 再加）
//  levels = Merkle 深度 10，base = limb 基数 1024
// ============================================================================
template VoteMembership(levels, base) {
    // ---- 私密输入 ----
    signal input identitySecret;             // 选民私密值
    signal input weightA;                    // 权重低位 limb
    signal input weightB;                    // 权重高位 limb
    signal input vote;                       // 投票 0/1
    signal input pathElements[levels];       // Merkle 兄弟节点
    signal input pathIndices[levels];        // Merkle 左右位

    // ---- 公开输入 ----
    signal input root;                       // 注册树根
    signal input pollId;                     // 本次投票编号

    // ---- 公开输出 ----
    signal output nullifierHash;             // 防双投

    // 1) 身份承诺 idCommitment = Poseidon(identitySecret)
    component idc = Poseidon(1);
    idc.inputs[0] <== identitySecret;

    // 2) 限制两个 limb 都 < base(=1024=2^10)，即各 10 bit
    component rangeA = Num2Bits(10);
    rangeA.in <== weightA;
    component rangeB = Num2Bits(10);
    rangeB.in <== weightB;

    // 权重 w = a + base*b
    signal weight;
    weight <== weightA + base * weightB;

    // 3) leaf = Poseidon(idCommitment, weight) —— 把权重绑死，选民没法谎报
    component leafH = Poseidon(2);
    leafH.inputs[0] <== idc.out;
    leafH.inputs[1] <== weight;

    // 4) 成员证明
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== leafH.out;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i]  <== pathIndices[i];
    }

    // 5) 投票必须是 0 或 1
    vote * (vote - 1) === 0;

    // 6) nullifier = Poseidon(identitySecret, pollId)
    component nh = Poseidon(2);
    nh.inputs[0] <== identitySecret;
    nh.inputs[1] <== pollId;
    nullifierHash <== nh.out;
}

component main {public [root, pollId]} = VoteMembership(10, 1024);

pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/escalarmulany.circom";
include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/babyjub.circom";

// ---- DualMux + Merkle（和 Week 1 相同）----
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];
    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

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
    root === levelHash[levels];
}

// ---- 指数 ElGamal 加密（BabyJubjub）：加密标量 m，随机数 r，公钥 PK ----
//  C1 = r*G ; C2 = m*G + r*PK
template ElGamalEnc() {
    signal input m;            // 要加密的标量（这里是 v*a 或 v*b，很小）
    signal input r;            // 随机数（253 bit）
    signal input PK[2];        // 委员会公钥（BabyJubjub 点）
    signal output C1[2];
    signal output C2[2];

    // circomlib 标准 Base8 生成元
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    // C1 = r*G
    component rBits = Num2Bits(253);
    rBits.in <== r;
    component c1 = EscalarMulFix(253, BASE8);
    for (var i = 0; i < 253; i++) c1.e[i] <== rBits.out[i];
    C1[0] <== c1.out[0];
    C1[1] <== c1.out[1];

    // mG = m*G（m 很小；先用 253 位保证正确，跑出数后可优化成小位宽）
    component mBits = Num2Bits(253);
    mBits.in <== m;
    component mg = EscalarMulFix(253, BASE8);
    for (var i = 0; i < 253; i++) mg.e[i] <== mBits.out[i];

    // rPK = r*PK（变基点乘）
    component rpk = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) rpk.e[i] <== rBits.out[i];
    rpk.p[0] <== PK[0];
    rpk.p[1] <== PK[1];

    // C2 = mG + rPK
    component add = BabyAdd();
    add.x1 <== mg.out[0];
    add.y1 <== mg.out[1];
    add.x2 <== rpk.out[0];
    add.y2 <== rpk.out[1];
    C2[0] <== add.xout;
    C2[1] <== add.yout;
}

// ============================================================================
//  Week 2 完整投票电路
// ============================================================================
template VoteFull(levels, base) {
    // ---- 私密输入 ----
    signal input identitySecret;
    signal input weightA;
    signal input weightB;
    signal input vote;                 // 0/1
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input rLow;                 // low limb 加密随机数
    signal input rHigh;                // high limb 加密随机数

    // ---- 公开输入 ----
    signal input root;
    signal input pollId;
    signal input PK[2];                // 委员会公钥

    // ---- 公开输出 ----
    signal output nullifierHash;
    signal output C1Low[2];
    signal output C2Low[2];
    signal output C1High[2];
    signal output C2High[2];

    // 1) 身份承诺
    component idc = Poseidon(1);
    idc.inputs[0] <== identitySecret;

    // 2) limb 范围 < base
    component rangeA = Num2Bits(10);
    rangeA.in <== weightA;
    component rangeB = Num2Bits(10);
    rangeB.in <== weightB;
    signal weight;
    weight <== weightA + base * weightB;

    // 3) leaf = Poseidon(idc, weight)
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

    // 5) vote ∈ {0,1}
    vote * (vote - 1) === 0;

    // 6) 待加密的两个 limb 贡献：mLow = v*a, mHigh = v*b
    signal mLow;
    signal mHigh;
    mLow  <== vote * weightA;
    mHigh <== vote * weightB;

    // 7) 两路 ElGamal 加密
    component encLow = ElGamalEnc();
    encLow.m <== mLow;
    encLow.r <== rLow;
    encLow.PK[0] <== PK[0];
    encLow.PK[1] <== PK[1];
    C1Low[0] <== encLow.C1[0];  C1Low[1] <== encLow.C1[1];
    C2Low[0] <== encLow.C2[0];  C2Low[1] <== encLow.C2[1];

    component encHigh = ElGamalEnc();
    encHigh.m <== mHigh;
    encHigh.r <== rHigh;
    encHigh.PK[0] <== PK[0];
    encHigh.PK[1] <== PK[1];
    C1High[0] <== encHigh.C1[0];  C1High[1] <== encHigh.C1[1];
    C2High[0] <== encHigh.C2[0];  C2High[1] <== encHigh.C2[1];

    // 8) nullifier
    component nh = Poseidon(2);
    nh.inputs[0] <== identitySecret;
    nh.inputs[1] <== pollId;
    nullifierHash <== nh.out;
}

component main {public [root, pollId, PK]} = VoteFull(10, 1024);

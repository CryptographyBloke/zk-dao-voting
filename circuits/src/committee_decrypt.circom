pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/escalarmulany.circom";
include "circomlib/circuits/poseidon.circom";

// ============================================================================
//  委员会成员"解密正确性"证明电路（路 A · Option C：winner-only）
//  私密: sk_j（成员私钥分片）
//  公开输入: 聚合密文两个 limb 的 C1（C1Low, C1High）
//  公开输出: pk_j = sk_j·G  和  cm_j = Poseidon(D_jLow, D_jHigh)
//  —— 关键改动（Option C）：不再把 D_j 公开上链，而是只公开它的 Poseidon 承诺 cm_j。
//     真正的 D_j 经链下安全通道发给聚合方，由 tally 证明在私密侧使用。
//     这样链上观察者只看到 cm_j（隐藏），无法用 D_j 重建聚合明文 total。
//  合约只需核对 pk_j 是注册成员、记录 cm_j；tally 证明再用同一个 cm_j 绑定私密 D_j。
// ============================================================================
template CommitteeDecrypt() {
    signal input skj;               // 私密：私钥分片
    signal input C1Low[2];          // 公开：低位 limb 的 C1
    signal input C1High[2];         // 公开：高位 limb 的 C1

    signal output pkj[2];           // 公开：pk_j = sk_j·G
    signal output cm;               // 公开：cm_j = Poseidon(D_jLow, D_jHigh)

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    component sBits = Num2Bits(253);
    sBits.in <== skj;

    // pk_j = sk_j·G
    component pk = EscalarMulFix(253, BASE8);
    for (var i = 0; i < 253; i++) pk.e[i] <== sBits.out[i];
    pkj[0] <== pk.out[0];
    pkj[1] <== pk.out[1];

    // D_jLow = sk_j·C1Low（内部信号，不再公开）
    component dLow = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) dLow.e[i] <== sBits.out[i];
    dLow.p[0] <== C1Low[0];
    dLow.p[1] <== C1Low[1];

    // D_jHigh = sk_j·C1High（内部信号，不再公开）
    component dHigh = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) dHigh.e[i] <== sBits.out[i];
    dHigh.p[0] <== C1High[0];
    dHigh.p[1] <== C1High[1];

    // 承诺 cm_j = Poseidon(D_jLow.x, D_jLow.y, D_jHigh.x, D_jHigh.y)
    component cmH = Poseidon(4);
    cmH.inputs[0] <== dLow.out[0];
    cmH.inputs[1] <== dLow.out[1];
    cmH.inputs[2] <== dHigh.out[0];
    cmH.inputs[3] <== dHigh.out[1];
    cm <== cmH.out;
}

// 公开信号顺序 = [outputs..., public inputs...] = [pkj(2), cm(1), C1Low(2), C1High(2)] → uint[7]
component main {public [C1Low, C1High]} = CommitteeDecrypt();

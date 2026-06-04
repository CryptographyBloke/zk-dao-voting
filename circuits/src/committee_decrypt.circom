pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/escalarmulany.circom";

// ============================================================================
//  委员会成员"解密正确性"证明电路（路 A）
//  私密: sk_j（成员私钥分片）
//  公开输入: 聚合密文两个 limb 的 C1（C1Low, C1High）
//  公开输出: pk_j = sk_j·G  和  D_j = sk_j·C1（两个 limb）
//  证明含义：D_j 确实是用"对应 pk_j 的那把 sk_j"算出来的部分解密
//  —— 合约只需核对 pk_j 是注册成员、记录 D_j，无需在链上算曲线
// ============================================================================
template CommitteeDecrypt() {
    signal input skj;               // 私密：私钥分片
    signal input C1Low[2];          // 公开：低位 limb 的 C1
    signal input C1High[2];         // 公开：高位 limb 的 C1

    signal output pkj[2];           // 公开：pk_j = sk_j·G
    signal output DjLow[2];         // 公开：sk_j·C1Low
    signal output DjHigh[2];        // 公开：sk_j·C1High

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

    // D_jLow = sk_j·C1Low
    component dLow = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) dLow.e[i] <== sBits.out[i];
    dLow.p[0] <== C1Low[0];
    dLow.p[1] <== C1Low[1];
    DjLow[0] <== dLow.out[0];
    DjLow[1] <== dLow.out[1];

    // D_jHigh = sk_j·C1High
    component dHigh = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) dHigh.e[i] <== sBits.out[i];
    dHigh.p[0] <== C1High[0];
    dHigh.p[1] <== C1High[1];
    DjHigh[0] <== dHigh.out[0];
    DjHigh[1] <== dHigh.out[1];
}

component main {public [C1Low, C1High]} = CommitteeDecrypt();

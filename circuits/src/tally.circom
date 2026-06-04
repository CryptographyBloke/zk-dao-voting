pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/escalarmulany.circom";
include "circomlib/circuits/babyjub.circom";
include "circomlib/circuits/comparators.circom";

// ============================================================================
//  circuit 2：计票电路（路 A 的最后一块）
//  证明：用 t 个已验证的部分解密 D_j，合并还原出 total，并判定赢家——全程零知识
//  λ_j 由合约按参与成员 id 计算后作为公开输入传入（合约算的，可信）
// ============================================================================
template Tally(t) {
    // ---- 公开输入 ----
    signal input C2Low[2];
    signal input C2High[2];
    signal input DjLow[t][2];
    signal input DjHigh[t][2];
    signal input lambda[t];
    signal input threshold;
    signal input winner;          // 声称的赢家位（公开）

    // ---- 私密输入（链下 BSGS 还原）----
    signal input totalLow;
    signal input totalHigh;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    // ---- 1) comb_limb = Σ λ_j · D_j_limb ----
    component lamBits[t];
    component mulL[t];
    component mulH[t];
    for (var j = 0; j < t; j++) {
        lamBits[j] = Num2Bits(253);
        lamBits[j].in <== lambda[j];
        mulL[j] = EscalarMulAny(253);
        mulH[j] = EscalarMulAny(253);
        for (var i = 0; i < 253; i++) { mulL[j].e[i] <== lamBits[j].out[i]; mulH[j].e[i] <== lamBits[j].out[i]; }
        mulL[j].p[0] <== DjLow[j][0];  mulL[j].p[1] <== DjLow[j][1];
        mulH[j].p[0] <== DjHigh[j][0]; mulH[j].p[1] <== DjHigh[j][1];
    }
    component addL[t - 1];
    component addH[t - 1];
    signal combL[t][2];
    signal combH[t][2];
    combL[0][0] <== mulL[0].out[0]; combL[0][1] <== mulL[0].out[1];
    combH[0][0] <== mulH[0].out[0]; combH[0][1] <== mulH[0].out[1];
    for (var j = 1; j < t; j++) {
        addL[j-1] = BabyAdd();
        addL[j-1].x1 <== combL[j-1][0]; addL[j-1].y1 <== combL[j-1][1];
        addL[j-1].x2 <== mulL[j].out[0]; addL[j-1].y2 <== mulL[j].out[1];
        combL[j][0] <== addL[j-1].xout; combL[j][1] <== addL[j-1].yout;
        addH[j-1] = BabyAdd();
        addH[j-1].x1 <== combH[j-1][0]; addH[j-1].y1 <== combH[j-1][1];
        addH[j-1].x2 <== mulH[j].out[0]; addH[j-1].y2 <== mulH[j].out[1];
        combH[j][0] <== addH[j-1].xout; combH[j][1] <== addH[j-1].yout;
    }

    // ---- 2) M_limb = C2_limb - comb_limb  (= C2 + neg(comb)) ----
    component mLow = BabyAdd();
    mLow.x1 <== C2Low[0];  mLow.y1 <== C2Low[1];
    mLow.x2 <== 0 - combL[t-1][0];  mLow.y2 <== combL[t-1][1];
    component mHigh = BabyAdd();
    mHigh.x1 <== C2High[0]; mHigh.y1 <== C2High[1];
    mHigh.x2 <== 0 - combH[t-1][0]; mHigh.y2 <== combH[t-1][1];

    // ---- 3) 反验 total_limb·G == M_limb，并把 total_limb 限制在 21 bit (< 2^21) ----
    component tlBits = Num2Bits(253);
    tlBits.in <== totalLow;
    for (var i = 21; i < 253; i++) tlBits.out[i] === 0;     // 强制 < 2^21
    component tlG = EscalarMulFix(253, BASE8);
    for (var i = 0; i < 253; i++) tlG.e[i] <== tlBits.out[i];
    tlG.out[0] === mLow.xout;
    tlG.out[1] === mLow.yout;

    component thBits = Num2Bits(253);
    thBits.in <== totalHigh;
    for (var i = 21; i < 253; i++) thBits.out[i] === 0;
    component thG = EscalarMulFix(253, BASE8);
    for (var i = 0; i < 253; i++) thG.e[i] <== thBits.out[i];
    thG.out[0] === mHigh.xout;
    thG.out[1] === mHigh.yout;

    // ---- 4) total = totalLow + 1024·totalHigh ; winner = (total > threshold) ----
    signal total;
    total <== totalLow + 1024 * totalHigh;
    component gt = GreaterThan(32);
    gt.in[0] <== total;
    gt.in[1] <== threshold;
    winner === gt.out;
}

component main {public [C2Low, C2High, DjLow, DjHigh, lambda, threshold, winner]} = Tally(3);

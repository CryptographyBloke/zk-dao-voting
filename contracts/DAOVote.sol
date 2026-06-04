// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================================================
//  DAOVote (Week 6) —— 路 A：合约只做「验 Groth16 + 点加聚合 + 记录/比对」，
//  不在链上做椭圆曲线标量乘（那些都在电路里）。
//
//  你需要先用 snarkjs 生成三个 verifier 合约并改名（避免重名）：
//    snarkjs zkey export solidityverifier full_final.zkey      VoteVerifier.sol
//    snarkjs zkey export solidityverifier committee_final.zkey CommitteeVerifier.sol
//    snarkjs zkey export solidityverifier tally_final.zkey     TallyVerifier.sol
//  并把每个文件里的 `contract Groth16Verifier` 改成 VoteVerifier / CommitteeVerifier / TallyVerifier。
//
//  注意：snarkjs 生成的 verifyProof 公开信号顺序 = [电路 outputs..., 然后 public inputs...]。
//  本合约按下面注释里的顺序拼数组；若你的电路改了信号顺序，按生成的 .sol 里 uint[N] 的 N 和顺序对齐。
// ============================================================================

// ---- BabyJubjub 仿射点加（公式已和 circomlibjs 逐位对齐验证）----
library BabyJub {
    // BN254 标量域 = BabyJubjub 基域
    uint256 internal constant P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant A = 168700;
    uint256 internal constant D = 168696;

    // 模逆：x^(P-2) mod P，用 modexp 预编译 0x05
    function inv(uint256 x) internal view returns (uint256) {
        uint256[6] memory in_;
        in_[0] = 0x20; in_[1] = 0x20; in_[2] = 0x20;
        in_[3] = x; in_[4] = P - 2; in_[5] = P;
        uint256[1] memory out;
        bool ok;
        assembly { ok := staticcall(gas(), 0x05, in_, 0xc0, out, 0x20) }
        require(ok, "modexp failed");
        return out[0];
    }

    // 扭曲爱德华兹点加：单位元为 (0,1)
    function add(uint256[2] memory p1, uint256[2] memory p2) internal view returns (uint256[2] memory r) {
        uint256 x1 = p1[0]; uint256 y1 = p1[1];
        uint256 x2 = p2[0]; uint256 y2 = p2[1];
        uint256 x1x2 = mulmod(x1, x2, P);
        uint256 y1y2 = mulmod(y1, y2, P);
        uint256 dt   = mulmod(mulmod(D, x1x2, P), y1y2, P);
        // x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2)
        uint256 xn = addmod(mulmod(x1, y2, P), mulmod(y1, x2, P), P);
        r[0] = mulmod(xn, inv(addmod(1, dt, P)), P);
        // y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2)
        uint256 yn = addmod(y1y2, P - mulmod(A, x1x2, P), P);
        r[1] = mulmod(yn, inv(addmod(1, P - dt, P)), P);
    }
}

interface IVoteVerifier      { function verifyProof(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[13] calldata pub) external view returns (bool); }
interface ICommitteeVerifier { function verifyProof(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[10] calldata pub) external view returns (bool); }
interface ITallyVerifier     { function verifyProof(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[21] calldata pub) external view returns (bool); }

contract DAOVote {
    IVoteVerifier      public voteV;
    ICommitteeVerifier public commV;
    ITallyVerifier     public tallyV;

    uint256 public merkleRoot;      // 注册树根
    uint256 public pollId;
    uint256 public threshold;       // 赢家阈值
    uint256 public constant T = 3;  // 门限（3-of-5）

    // 聚合密文（单位元初始化为 (0,1)）
    uint256[2] public C1Low  = [uint256(0), 1];
    uint256[2] public C2Low  = [uint256(0), 1];
    uint256[2] public C1High = [uint256(0), 1];
    uint256[2] public C2High = [uint256(0), 1];

    mapping(uint256 => bool) public nullifierUsed;

    // 委员会成员注册：id => pk_j；以及收到的部分解密
    mapping(uint256 => uint256[2]) public committeePk;
    mapping(uint256 => bool)       public pkRegistered;
    uint256[2][T] public DjLow;
    uint256[2][T] public DjHigh;
    uint256[T]    public memberIds;
    uint256       public numDecrypts;

    bool    public finalized;
    uint256 public winner;

    constructor(address _vote, address _comm, address _tally, uint256 _root, uint256 _pollId, uint256 _threshold) {
        voteV = IVoteVerifier(_vote);
        commV = ICommitteeVerifier(_comm);
        tallyV = ITallyVerifier(_tally);
        merkleRoot = _root; pollId = _pollId; threshold = _threshold;
    }

    // 委员会成员注册公钥分片
    function registerCommitteeMember(uint256 id, uint256[2] calldata pk) external {
        require(!pkRegistered[id], "id used");
        committeePk[id] = pk; pkRegistered[id] = true;
    }

    // ---- 1) 投票：验证明 + 查 nullifier + 链上聚合 ----
    //  vote_full 公开信号顺序: [nullifier, C1Low(2), C2Low(2), C1High(2), C2High(2), root, pollId, PK(2)]
    function submitVote(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[13] calldata pub) external {
        require(voteV.verifyProof(a, b, c, pub), "bad vote proof");
        require(pub[9] == merkleRoot, "wrong root");      // pub[9]=root
        require(pub[10] == pollId,    "wrong poll");        // pub[10]=pollId
        uint256 nf = pub[0];
        require(!nullifierUsed[nf], "double vote");
        nullifierUsed[nf] = true;

        // 把这张票的密文加进聚合
        C1Low  = BabyJub.add(C1Low,  [pub[1], pub[2]]);
        C2Low  = BabyJub.add(C2Low,  [pub[3], pub[4]]);
        C1High = BabyJub.add(C1High, [pub[5], pub[6]]);
        C2High = BabyJub.add(C2High, [pub[7], pub[8]]);
    }

    // ---- 2) 委员会部分解密：验 circuit1 + 核对 pk_j 与聚合 C1 + 记录 D_j ----
    //  committee 公开信号顺序: [pkj(2), DjLow(2), DjHigh(2), C1Low(2), C1High(2)]
    function submitPartialDecrypt(uint256 id, uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[10] calldata pub) external {
        require(pkRegistered[id], "not committee");
        require(commV.verifyProof(a, b, c, pub), "bad committee proof");
        // 电路输出的 pk_j 必须等于注册的公钥（防止用别的钥匙）
        require(pub[0] == committeePk[id][0] && pub[1] == committeePk[id][1], "pk mismatch");
        // 电路用的 C1 必须等于链上聚合的 C1（防止解密别的密文）
        require(pub[6] == C1Low[0]  && pub[7] == C1Low[1],  "C1Low mismatch");
        require(pub[8] == C1High[0] && pub[9] == C1High[1], "C1High mismatch");

        uint256 k = numDecrypts;
        require(k < T, "enough shares");
        memberIds[k] = id;
        DjLow[k]  = [pub[2], pub[3]];
        DjHigh[k] = [pub[4], pub[5]];
        numDecrypts = k + 1;
    }

    // ---- 3) finalize：合约算 λ_j，验 circuit2，读出赢家 ----
    //  tally 公开信号顺序: [C2Low(2), C2High(2), DjLow(3*2), DjHigh(3*2), lambda(3), threshold, winner]
    function finalize(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[21] calldata pub) external {
        require(!finalized, "done");
        require(numDecrypts == T, "need T shares");

        // 合约自己算 Lagrange 系数 λ_j（在子群阶 L 下），保证可信
        uint256[T] memory lambda = _lagrange();

        // 拼出期望的公开信号并逐项核对（防止 prover 用伪造输入）
        require(pub[0]==C2Low[0]  && pub[1]==C2Low[1],  "C2Low");
        require(pub[2]==C2High[0] && pub[3]==C2High[1], "C2High");
        for (uint256 j = 0; j < T; j++) {
            require(pub[4 + 2*j]==DjLow[j][0]  && pub[5 + 2*j]==DjLow[j][1],  "DjLow");
            require(pub[10 + 2*j]==DjHigh[j][0] && pub[11 + 2*j]==DjHigh[j][1], "DjHigh");
            require(pub[16 + j]==lambda[j], "lambda");
        }
        require(pub[19]==threshold, "threshold");
        require(tallyV.verifyProof(a, b, c, pub), "bad tally proof");

        winner = pub[20];
        finalized = true;
    }

    // 子群阶 L（BabyJubjub 大素数子群）
    uint256 internal constant L = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    function _expmodL(uint256 base, uint256 e) internal view returns (uint256 o) {
        uint256[6] memory in_; in_[0]=0x20;in_[1]=0x20;in_[2]=0x20;in_[3]=base;in_[4]=e;in_[5]=L;
        uint256[1] memory out; bool ok;
        assembly { ok := staticcall(gas(),0x05,in_,0xc0,out,0x20) }
        require(ok,"modexp"); return out[0];
    }
    // λ_j = Π_{l≠j} l/(l-j) mod L
    function _lagrange() internal view returns (uint256[T] memory lam) {
        for (uint256 j = 0; j < T; j++) {
            uint256 num = 1; uint256 den = 1;
            uint256 xj = memberIds[j];
            for (uint256 m = 0; m < T; m++) {
                if (m == j) continue;
                uint256 xl = memberIds[m];
                num = mulmod(num, xl, L);
                // (xl - xj) mod L
                uint256 diff = addmod(xl, L - (xj % L), L);
                den = mulmod(den, diff, L);
            }
            lam[j] = mulmod(num, _expmodL(den, L - 2), L);
        }
    }
}

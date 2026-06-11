// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================================================
//  DAOVote (Option C：winner-only) —— 路 A：合约只做「验 Groth16 + 点加聚合 + 记录/比对」。
//
//  Option C 改动要点：
//   1) 投票时强制密文公钥 == 委员会公钥 committeePK（防伪造 PK 破坏/篡改计票）。
//   2) 委员部分解密只在链上记录承诺 cm_j = Poseidon(D_j)，不再公开 D_j；
//      真正的 D_j 经链下安全通道交给聚合方，tally 证明在私密侧用 cm_j 绑定。
//      → 链上观察者只看到 cm_j（隐藏）+ winner，无法重建聚合明文 total。
//   3) 委员 id 去重，防重复提交导致 Lagrange 分母为 0。
//
//  生成三个 verifier 合约并改名（注意新的 public 信号数）：
//    snarkjs zkey export solidityverifier full_final.zkey      VoteVerifier.sol      // uint[13]
//    snarkjs zkey export solidityverifier committee_final.zkey CommitteeVerifier.sol // uint[7]
//    snarkjs zkey export solidityverifier tally_final.zkey     TallyVerifier.sol     // uint[12]
//  并把每个文件里的 `contract Groth16Verifier` 改成 VoteVerifier / CommitteeVerifier / TallyVerifier。
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
interface ICommitteeVerifier { function verifyProof(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[7]  calldata pub) external view returns (bool); }
interface ITallyVerifier     { function verifyProof(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[12] calldata pub) external view returns (bool); }

contract DAOVote {
    IVoteVerifier      public voteV;
    ICommitteeVerifier public commV;
    ITallyVerifier     public tallyV;

    uint256 public merkleRoot;      // 注册树根
    uint256 public pollId;
    uint256 public threshold;       // 赢家阈值
    uint256 public constant T = 3;  // 门限（3-of-5）
    uint256[2] public committeePK;  // 委员会聚合公钥（所有票必须用它加密）

    // 聚合密文（单位元初始化为 (0,1)）
    uint256[2] public C1Low  = [uint256(0), 1];
    uint256[2] public C2Low  = [uint256(0), 1];
    uint256[2] public C1High = [uint256(0), 1];
    uint256[2] public C2High = [uint256(0), 1];

    mapping(uint256 => bool) public nullifierUsed;

    // 委员会成员注册：id => pk_j；以及收到的部分解密【承诺】
    mapping(uint256 => uint256[2]) public committeePk;
    mapping(uint256 => bool)       public pkRegistered;
    mapping(uint256 => bool)       public decryptSubmitted;   // 防同一 id 重复提交
    uint256[T]    public cm;          // Option C：只存承诺 cm_j = Poseidon(D_j)
    uint256[T]    public memberIds;
    uint256       public numDecrypts;

    bool    public finalized;
    uint256 public winner;

    constructor(
        address _vote, address _comm, address _tally,
        uint256 _root, uint256 _pollId, uint256 _threshold,
        uint256[2] memory _committeePK,
        uint256[] memory _ids, uint256[2][] memory _pks
    ) {
        voteV = IVoteVerifier(_vote);
        commV = ICommitteeVerifier(_comm);
        tallyV = ITallyVerifier(_tally);
        merkleRoot = _root; pollId = _pollId; threshold = _threshold;
        committeePK = _committeePK;
        // 封闭委员会集合：部署时一次性固定 {id => pk_j}，不开放注册（防抢注/灌入无关 pk）。
        require(_ids.length == _pks.length, "len");
        for (uint256 i = 0; i < _ids.length; i++) {
            require(!pkRegistered[_ids[i]], "dup id");
            committeePk[_ids[i]] = _pks[i];
            pkRegistered[_ids[i]] = true;
        }
    }

    // ---- 1) 投票：验证明 + 查 nullifier + 校验 PK + 链上聚合 ----
    //  vote_full 公开信号顺序: [nullifier, C1Low(2), C2Low(2), C1High(2), C2High(2), root, pollId, PK(2)]
    function submitVote(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[13] calldata pub) external {
        require(voteV.verifyProof(a, b, c, pub), "bad vote proof");
        require(pub[9]  == merkleRoot, "wrong root");      // pub[9]=root
        require(pub[10] == pollId,    "wrong poll");        // pub[10]=pollId
        // 强制本票密文使用委员会聚合公钥，否则同态聚合后无法被门限正确解密（防篡改/破坏计票）
        require(pub[11] == committeePK[0] && pub[12] == committeePK[1], "wrong PK");
        uint256 nf = pub[0];
        require(!nullifierUsed[nf], "double vote");
        nullifierUsed[nf] = true;

        // 把这张票的密文加进聚合
        C1Low  = BabyJub.add(C1Low,  [pub[1], pub[2]]);
        C2Low  = BabyJub.add(C2Low,  [pub[3], pub[4]]);
        C1High = BabyJub.add(C1High, [pub[5], pub[6]]);
        C2High = BabyJub.add(C2High, [pub[7], pub[8]]);
    }

    // ---- 2) 委员会部分解密：验 circuit1 + 核对 pk_j 与聚合 C1 + 记录承诺 cm_j ----
    //  committee 公开信号顺序: [pkj(2), cm(1), C1Low(2), C1High(2)]  (uint[7])
    function submitPartialDecrypt(uint256 id, uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[7] calldata pub) external {
        require(pkRegistered[id], "not committee");
        require(!decryptSubmitted[id], "id submitted");      // 去重：同一委员只能提交一次
        require(commV.verifyProof(a, b, c, pub), "bad committee proof");
        // 电路输出的 pk_j 必须等于注册的公钥（防止用别的钥匙）
        require(pub[0] == committeePk[id][0] && pub[1] == committeePk[id][1], "pk mismatch");
        // 电路用的 C1 必须等于链上聚合的 C1（防止解密别的密文）
        require(pub[3] == C1Low[0]  && pub[4] == C1Low[1],  "C1Low mismatch");
        require(pub[5] == C1High[0] && pub[6] == C1High[1], "C1High mismatch");

        uint256 k = numDecrypts;
        require(k < T, "enough shares");
        decryptSubmitted[id] = true;
        memberIds[k] = id;
        cm[k] = pub[2];                                       // 只记录承诺，不记录 D_j
        numDecrypts = k + 1;
    }

    // ---- 3) finalize：合约算 λ_j，验 circuit2，读出赢家 ----
    //  tally 公开信号顺序: [C2Low(2), C2High(2), cm(3), lambda(3), threshold, winner]  (uint[12])
    function finalize(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[12] calldata pub) external {
        require(!finalized, "done");
        require(numDecrypts == T, "need T shares");

        // 合约自己算 Lagrange 系数 λ_j（在子群阶 L 下），保证可信
        uint256[T] memory lambda = _lagrange();

        // 拼出期望的公开信号并逐项核对（防止 prover 用伪造输入）
        require(pub[0]==C2Low[0]  && pub[1]==C2Low[1],  "C2Low");
        require(pub[2]==C2High[0] && pub[3]==C2High[1], "C2High");
        for (uint256 j = 0; j < T; j++) {
            require(pub[4 + j] == cm[j],     "cm");           // 承诺绑定到委员证明记录
            require(pub[7 + j] == lambda[j], "lambda");
        }
        require(pub[10]==threshold, "threshold");
        require(tallyV.verifyProof(a, b, c, pub), "bad tally proof");

        winner = pub[11];
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

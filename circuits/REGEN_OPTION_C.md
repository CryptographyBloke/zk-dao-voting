# Option C 重生成说明（winner-only：链上不再公开 D_j）

本次修改把「委员部分解密 `D_j`」从链上公开改为只公开承诺 `cm_j = Poseidon(D_jLow, D_jHigh)`，
`D_j` 改为 tally 证明的**私密输入**。这样链上观察者只看到 `cm_j`（隐藏）+ winner，无法重建聚合明文 `total`。

> **vote 电路（`vote_full.circom`）完全未改** → VoteVerifier、每票证明、per-ballot gas / 4.5s 证明时间**保持不变**。
> 只有 **committee 与 tally 两侧** 需要重新生成。

## 公开信号数变化（合约接口已同步）

| 证明 | 旧 | 新 (Option C) | 公开信号顺序 |
|---|---|---|---|
| vote | `uint[13]` | `uint[13]`（不变） | `[nullifier, C1Low(2), C2Low(2), C1High(2), C2High(2), root, pollId, PK(2)]` |
| committee | `uint[10]` | **`uint[7]`** | `[pkj(2), cm(1), C1Low(2), C1High(2)]` |
| tally | `uint[21]` | **`uint[12]`** | `[C2Low(2), C2High(2), cm(3), lambda(3), threshold, winner]` |

## 必须重新生成的产物

1. **CommitteeVerifier.sol、TallyVerifier.sol**（snarkjs 生成；旧文件信号数不符，必换）
2. **committee_final.zkey、tally_final.zkey**
3. **e2e/proofs/ 下 committee_\*、tally 的 proof/public.json**（旧格式作废）

VoteVerifier.sol / full_final.zkey / vote_\*_proof.json **不用动**。

## 重生成命令（在 `circuits/` 下，沿用你原来的 ptau 文件 `<POT>.ptau`）

```bash
# 0) 生成连贯的端到端输入（含 CSPRNG、新 tally 格式、committeePK）
node orchestrate.js          # 写出 e2e/vote_*.json, e2e/committee_*.json, e2e/tally.json

# 1) 编译 + 可信设置：committee
circom src/committee_decrypt.circom --r1cs --wasm --sym -l node_modules
snarkjs groth16 setup committee_decrypt.r1cs <POT>.ptau committee_0000.zkey
snarkjs zkey contribute committee_0000.zkey committee_final.zkey -e="$(head -c32 /dev/urandom|xxd -p)"
snarkjs zkey export solidityverifier committee_final.zkey CommitteeVerifier.sol
#   将 CommitteeVerifier.sol 内 `contract Groth16Verifier` 改名为 `CommitteeVerifier`

# 2) 编译 + 可信设置：tally
circom src/tally.circom --r1cs --wasm --sym -l node_modules
snarkjs groth16 setup tally.r1cs <POT>.ptau tally_0000.zkey
snarkjs zkey contribute tally_0000.zkey tally_final.zkey -e="$(head -c32 /dev/urandom|xxd -p)"
snarkjs zkey export solidityverifier tally_final.zkey TallyVerifier.sol
#   将 TallyVerifier.sol 内 `contract Groth16Verifier` 改名为 `TallyVerifier`

# 3) 为每个 e2e 输入生成 witness + proof（committee 三个 + tally 一个）
for id in 1 3 5; do
  node committee_decrypt_js/generate_witness.js committee_decrypt_js/committee_decrypt.wasm \
       e2e/committee_${id}.json e2e/proofs/committee_${id}.wtns
  snarkjs groth16 prove committee_final.zkey e2e/proofs/committee_${id}.wtns \
       e2e/proofs/committee_${id}_proof.json e2e/proofs/committee_${id}_public.json
done
node tally_js/generate_witness.js tally_js/tally.wasm e2e/tally.json e2e/proofs/tally.wtns
snarkjs groth16 prove tally_final.zkey e2e/proofs/tally.wtns \
     e2e/proofs/tally_proof.json e2e/proofs/tally_public.json

# 4) 把新的 CommitteeVerifier.sol / TallyVerifier.sol 拷到 dao-vote-gas-test/contracts/
#    再跑端到端 gas 测量
cd ../dao-vote-gas-test && npx hardhat run scripts/measure_e2e.js
```

## 部署接口变化

`DAOVote` 构造函数新增 `uint256[2] committeePK`（所有票必须用此公钥加密）：

```solidity
constructor(address _vote, address _comm, address _tally,
            uint256 _root, uint256 _pollId, uint256 _threshold,
            uint256[2] memory _committeePK)
```

`measure_e2e.js` 已更新：从 `vote_0_public.json[11..12]` 读取 `committeePK` 传入。

## 与论文的对应（只需改 ~2 句）

- 门限解密那段：注明 `D_j` 以**承诺**形式上链、明文经链下安全通道交聚合方。
- 把「no party including committee members learns … only Boolean released」改为：**链上观察者**只得 winner；指定轮值聚合方短暂获知聚合值，但无法篡改被 ZK 证明的结果。

> per-ballot 数字（~591K gas / ~4.5s）不变；finalize/committee 侧 gas 因承诺改动略有变化（commitment 比存点更省 storage）。

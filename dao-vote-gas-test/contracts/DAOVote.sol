// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA, 
        uint[2][2] calldata _pB, 
        uint[2] calldata _pC, 
        uint[1] calldata _pubSignals
    ) external view returns (bool);
}

contract DAOVote {
    IVerifier public verifier;
    
    // === 状态变量 ===
    mapping(bytes32 => bool) public nullifierSet;
    uint256[2] public CT_total;
    bool public result;
    mapping(address => uint256[2]) public partialDecryptions; // 委员会解密份额

    constructor(address _verifierAddress) {
        verifier = IVerifier(_verifierAddress);
    }

    // 核心交易 1：提交选票 (Vote Submit)
    function submitVote(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata input,
        uint256[2] calldata ciphertext,
        bytes32 nullifier
    ) external {
        require(!nullifierSet[nullifier], "Already voted");
        nullifierSet[nullifier] = true;
        
        require(verifier.verifyProof(a, b, c, input), "Invalid ZK proof");
        
        CT_total[0] += ciphertext[0];
        CT_total[1] += ciphertext[1];
    }

    // 核心交易 2：提交部分解密 (Partial Decrypt)
    function submitPartialDecrypt(uint256[2] calldata dj, bytes calldata sigmaj) external {
        // 模拟 Chaum-Pedersen 验证的计算开销
        bytes32 proofCheck = keccak256(abi.encodePacked(dj[0], dj[1], sigmaj));
        require(proofCheck != bytes32(0), "Invalid CP proof"); 
        
        // 状态上链：记录解密份额
        partialDecryptions[msg.sender] = dj;
    }

    // 核心交易 3：验证最终结果 (Result Verify)
    function finalizeResult(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata input,
        bool finalResult
    ) external {
        require(verifier.verifyProof(a, b, c, input), "Invalid final proof");
        result = finalResult;
    }
}

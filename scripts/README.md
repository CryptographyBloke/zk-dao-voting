# 📊 Performance Benchmark: Client-Side Groth16 Proof Generation (~70K Constraints)

## 🎯 Objective
This benchmark evaluates the computational feasibility of generating zero-knowledge proofs (Groth16) strictly on the client side, targeting a DAO voting use case (500 voters).

## ⚙️ Execution Environment
* **Hardware:** Intel(R) Core(TM) i7-14650HX (Allocated 8 vCPUs, 16GB RAM)
* **OS:** Ubuntu 22.04 LTS (VMware)
* **Runtime:** Node.js v20.x
* **Cryptographic Backend:** `snarkjs` (WebAssembly)
* **Trusted Setup:** Polygon Hermez MPC Phase-2 (`powersOfTau28_hez_final_17.ptau`)

## 📐 Cryptographic Scale
* **Curve:** BN254
* **Circuit Scale:** ~70,000 R1CS Constraints
* **Domain Size:** $2^{17}$ (131,072)

## ⏱️ Benchmark Results (Cold vs. Warm Isolation)
We strictly isolated the I/O-bound parameter loading phase from the CPU-bound cryptographic operations:

| Metric | Latency | Description |
| :--- | :--- | :--- |
| **Cold Start (I/O)** | `114.66 ms` | Loading the 140MB `ptau` and `zkey` into physical memory. |
| **Witness Generation** | `~0.21 s` | Computing the computation trace via WASM. |
| **Warm Prove (CPU)** | `7.483 s` | Pure Multi-Scalar Multiplication (MSM) and FFT execution. |

## 💡 Conclusion
The results demonstrate that evaluating a $2^{17}$ domain size Groth16 proof within a standard browser-compatible environment (Node.js/WASM) takes under **8 seconds**. This proves that client-side proof generation is highly practical for decentralized governance without relying on centralized provers or native C++ hardware acceleration.

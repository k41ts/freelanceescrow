import { network } from "hardhat";

const { ethers } = await network.getOrCreate();

const [deployer] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(deployer.address);

console.log("Deployer :", deployer.address);
console.log("Balance  :", ethers.formatEther(balance), "ETH");

if (balance === 0n) {
  throw new Error("Saldo deployer 0. Isi dulu lewat Sepolia faucet sebelum deploy.");
}

console.log("\nMen-deploy FreelanceEscrow...");
const escrow = await ethers.deployContract("FreelanceEscrow");
await escrow.waitForDeployment();

const address = await escrow.getAddress();
console.log("\n=== DEPLOY BERHASIL ===");
console.log("Alamat contract :", address);
console.log("\nLangkah berikutnya:");
console.log("1. Simpan alamat di frontend/.env sebagai VITE_CONTRACT_ADDRESS");
console.log(`2. Verify: npx hardhat verify --network sepolia ${address}`);
console.log(`3. Cek di https://sepolia.etherscan.io/address/${address}`);

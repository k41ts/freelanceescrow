import type { HardhatUserConfig } from "hardhat/config";
import { configVariable } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // RPC publik dipakai sebagai default supaya deploy bisa jalan tanpa daftar
    // Infura/Alchemy. Bukan rahasia, jadi aman ditulis langsung di sini.
    // Set SEPOLIA_RPC_URL kalau nanti mau pindah ke endpoint sendiri.
    //
    // Endpoint ini dipilih setelah dites: eth_blockNumber, eth_gasPrice, dan
    // eth_getBalance semuanya jalan. Jangan pakai rpc.sepolia.org (sudah mati,
    // balikannya 404) atau 1rpc.io/sepolia (kena 429 di eth_getBalance).
    //
    // PRIVATE_KEY sengaja tetap configVariable() dan disimpan di keystore
    // terenkripsi Hardhat, bukan di file plaintext. Sifatnya lazy: nilainya baru
    // dibaca saat jaringan sepolia dipakai, sehingga `hardhat test` tetap jalan
    // tanpa keystore sama sekali.
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.ethpandaops.io",
      accounts: [configVariable("PRIVATE_KEY")],
    },
    // Jaringan kembar khusus `hardhat verify`, sengaja TANPA accounts.
    // Verifikasi hanya mengunggah source code ke block explorer dan tidak
    // menandatangani transaksi apa pun, jadi private key tidak diperlukan.
    // Tanpa accounts, Hardhat tidak perlu membuka keystore sehingga tidak
    // ada prompt password sama sekali.
    sepoliaVerify: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.ethpandaops.io",
    },
  },
};

export default config;

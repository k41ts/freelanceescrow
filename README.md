# Decentralized Freelance Escrow

Sistem pembayaran freelance berbasis smart contract dengan milestone, auto-release, dan
arbitrator.

**Prototyping Blockchain Project · DTSC6018001 · BINUS University**
Nicholas · Evan · Kai · Akmal · Tafarel

> **Simulasi akademik di Ethereum Sepolia testnet. Bukan layanan finansial.**
> Di Indonesia hanya Rupiah yang merupakan alat pembayaran yang sah
> (UU No. 7/2011 Pasal 21, PBI 18/40/2016 Pasal 34).

## Masalah yang diselesaikan

Freelancer bekerja lalu tidak dibayar; klien membayar di muka lalu tidak menerima hasil.
Dana klien dikunci di smart contract sejak awal dan hanya cair setelah pekerjaan disetujui.

## Jaminan yang ditegakkan di level contract

Ini bukan sekadar aturan tampilan — semuanya dipaksakan oleh `FreelanceEscrow.sol` dan
dibuktikan oleh test suite:

| Jaminan | Mekanisme |
|---|---|
| Dana tidak bisa ditarik sepihak klien | Tidak ada fungsi `withdraw`, `receive`, maupun `fallback` |
| Freelancer tidak bekerja untuk dana kosong | `submitWork()` revert bila milestone belum `Funded` |
| Sikap diam klien tidak menguntungkan | `autoRelease()` permissionless setelah `reviewPeriod` lewat |
| Sengketa diputus pihak ketiga | Hanya `arbitrator` yang bisa `resolveDispute()` |
| Tanpa oracle eksternal | Seluruh input berasal dari klien dan freelancer sendiri |

## Arsitektur

- **Smart contract** — Solidity 0.8.28, Hardhat 3, OpenZeppelin `ReentrancyGuard`,
  pola checks-effects-interactions.
- **Front-end** — Vite + React + ethers v6 + MetaMask.
- **Penyimpanan** — file bukti kerja di IPFS via Pinata; hanya CID yang disimpan on-chain
  agar hemat gas.

Satu contract registry menampung banyak proyek, jadi cukup sekali deploy.

## Menjalankan

### 1. Smart contract

```bash
npm install
npx hardhat compile
npx hardhat test
```

### 2. Deploy ke Sepolia

**Tidak ada `.env` di root.** Private key disimpan di keystore terenkripsi Hardhat, bukan
file plaintext, supaya tidak mungkin ikut ter-commit. Cukup sekali set:

```bash
npx hardhat keystore set PRIVATE_KEY
```

Akan muncul dua prompt: password keystore (bikin baru, dipakai tiap deploy) lalu private
key-nya. Ketikan tidak ditampilkan di layar — itu normal.

> Gunakan wallet **sekali pakai**. Jangan pernah memakai private key wallet yang memegang
> aset asli.

RPC Sepolia sudah punya default publik di `hardhat.config.ts`, jadi tidak perlu daftar
Infura/Alchemy. Set `SEPOLIA_RPC_URL` hanya bila ingin memakai endpoint sendiri.

```bash
npm run deploy:sepolia
```

Script akan mencetak alamat deployer dan saldonya, lalu berhenti bila saldo masih 0 —
isi dulu lewat faucet, baru jalankan ulang.

### 2b. Verifikasi source code

Blockscout dan Sourcify tidak memerlukan API key:

```bash
npx hardhat verify blockscout --network sepoliaVerify <ALAMAT_CONTRACT>
npx hardhat verify sourcify   --network sepoliaVerify <ALAMAT_CONTRACT>
```

`sepoliaVerify` adalah jaringan kembar tanpa `accounts`. Verifikasi hanya mengunggah source
code dan tidak menandatangani transaksi, sehingga tidak perlu membuka keystore dan tidak
ada prompt password.

Etherscan opsional dan butuh API key gratis dari etherscan.io. Klaim "dapat diaudit siapa
pun" sudah terpenuhi lewat Blockscout dan Sourcify.

### Deployment yang sedang aktif

| | |
|---|---|
| Alamat | `0xD1325AB34C853B47678D18bC1C0cEdC70d1Ba576` |
| Jaringan | Sepolia (chainId 11155111) |
| Source code | [Blockscout](https://eth-sepolia.blockscout.com/address/0xD1325AB34C853B47678D18bC1C0cEdC70d1Ba576#code) · [Sourcify](https://sourcify.dev/server/repo-ui/11155111/0xD1325AB34C853B47678D18bC1C0cEdC70d1Ba576) (`exact_match`) |

### 3. Front-end

Salin `frontend/.env.example` menjadi `frontend/.env`, isi `VITE_CONTRACT_ADDRESS` dengan
alamat hasil deploy dan `VITE_PINATA_JWT` dengan scoped key Pinata.

```bash
cd frontend
npm install
npm run dev
```

## Persiapan demo

Butuh **3 akun MetaMask** di jaringan Sepolia — klien, freelancer, dan arbitrator — yang
sudah diisi lewat faucet. Isi faucet lebih awal; sering kena rate-limit.

Alur happy path: klien buat proyek → deposit → ganti akun ke freelancer → upload bukti +
submit → ganti ke klien → approve → saldo freelancer bertambah.

Untuk mendemokan auto-release, buat proyek dengan `reviewPeriod` 3–5 menit. Nilai
produksinya 7 hari, tetapi itu mustahil ditunggu saat presentasi.

## Keterbatasan yang kami sadari

- Arbitrator masih terpusat — satu penengah, jadi titik kegagalan tunggal.
- Putusan arbitrator tidak mengikat secara hukum.
- Penilaian kualitas kerja tetap subjektif dan butuh manusia.
- `VITE_PINATA_JWT` terbaca publik di browser; produksi harus lewat proxy back-end.
- Pengguna wajib punya wallet.

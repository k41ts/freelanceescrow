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

Siapkan `.env` di root (lihat `.env.example`):

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
PRIVATE_KEY=0x...
```

> Gunakan wallet **sekali pakai**. Jangan pernah memakai private key wallet yang memegang
> aset asli.

```bash
npm run deploy:sepolia
```

Salin alamat hasil deploy, lalu verify agar source code terbaca publik:

```bash
npx hardhat verify --network sepolia <ALAMAT_CONTRACT>
```

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

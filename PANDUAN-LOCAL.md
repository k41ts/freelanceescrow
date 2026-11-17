# Panduan Menjalankan di Local (Windows)

## 0. Prasyarat

- **Node.js 22+** (sudah dites dengan Node 24). Cek: `node -v`
- Opsional untuk mode asli: ekstensi **MetaMask** di browser + akun Sepolia yang ada saldo faucet.

## 1. Install dependency (sekali saja)

Buka terminal (PowerShell) di folder project:

```bash
cd D:\Coding\freelanceescrow
npm install
cd frontend
npm install
```

## 2. (Opsional) Buktikan smart contract benar

Dari root project:

```bash
npx hardhat test
```

Hasil yang diharapkan: **23 passing**. Bagus untuk ditunjukkan saat presentasi.

## 3. Jalankan aplikasi

```bash
cd D:\Coding\freelanceescrow\frontend
npm run dev
```

Buka **http://localhost:5173** di browser. Stop server dengan `Ctrl + C`.

> Kalau `frontend/.env` diubah, stop lalu `npm run dev` lagi — Vite hanya membaca `.env` saat start.

## 4. Pilih mode demo

### A. Mode demo tanpa wallet (paling aman untuk presentasi)

Tidak butuh MetaMask, internet, atau saldo. Semua disimulasikan di memori.

1. Di landing page klik **Coba tanpa wallet**.
2. Bar "Mode demo" di atas dipakai untuk ganti peran: **Klien / Freelancer / Arbitrator**.
3. Alur happy path:
   - Peran **Klien** → buka proyek "Desain Logo Startup" → **Kunci dana 0.01 ETH**
   - Ganti ke **Freelancer** → pilih file apa saja → **Kirim hasil kerja**
   - Ganti ke **Klien** → **Setujui dan cairkan 0.01 ETH** → dana pindah ke kolom "Sudah dibayarkan"
4. Demo auto-release: setelah freelancer submit, jangan approve — tunggu **20 detik** sampai
   muncul "Batas review sudah lewat", lalu klik **Cairkan otomatis** (boleh dari peran mana saja).
5. Demo sengketa: klik **Ajukan sengketa** → **OK** di dialog konfirmasi → ganti ke **Arbitrator** →
   pilih **Cairkan ke freelancer** atau **Kembalikan ke klien**.
6. **Ulang dari awal** mengembalikan data ke kondisi awal (refresh halaman juga sama).

### B. Mode asli (Sepolia + MetaMask)

Contract sudah ter-deploy di `0xD1325AB34C853B47678D18bC1C0cEdC70d1Ba576` dan alamat ini
sudah ada di `frontend/.env`. Jadi **tidak perlu deploy ulang**.

1. Siapkan 3 akun MetaMask (klien, freelancer, arbitrator) di jaringan Sepolia, semuanya ada saldo faucet.
2. Klik **Buka aplikasi** → connect MetaMask → kalau diminta, klik pindah ke Sepolia.
3. Alur sama seperti mode demo, tapi tiap aksi minta konfirmasi transaksi di MetaMask.

> **Penting:** upload bukti kerja ke IPFS butuh `VITE_PINATA_JWT` di `frontend/.env`
> (saat ini **masih kosong**). Tanpa itu, langkah "Kirim hasil kerja" di mode asli akan gagal.
> Cara isi: dashboard Pinata → API Keys → New Key → scoped, centang hanya `org:files:write` →
> salin JWT ke `VITE_PINATA_JWT=...` → restart `npm run dev`.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `npm` / `node` tidak dikenali | Install Node.js LTS dari nodejs.org, lalu buka ulang terminal |
| Port 5173 sudah dipakai | Vite otomatis pindah ke 5174 dst. — lihat URL di terminal |
| Halaman "Pasang MetaMask dulu" | Normal kalau tanpa MetaMask. Pakai **Coba tanpa wallet** |
| Transaksi gagal / saldo kurang | Isi faucet Sepolia (sering kena rate-limit, isi dari H-1) |
| Kirim hasil kerja gagal (mode asli) | Isi `VITE_PINATA_JWT`, restart dev server |
| Error aneh setelah `git pull` | Jalankan `npm install` lagi di root dan di `frontend` |

## Rekomendasi untuk besok

- Jadikan **mode demo** sebagai jalur utama presentasi — tidak bergantung WiFi, faucet, atau MetaMask.
- Mode asli dipakai sebagai bonus, plus tunjukkan source code terverifikasi di Blockscout (link ada di footer aplikasi).
- Tes sekali lagi di laptop yang dipakai presentasi: `npm install` → `npm run dev` → jalankan alur demo.

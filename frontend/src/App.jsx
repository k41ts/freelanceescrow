import { useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { CONTRACT_ADDRESS } from "./lib/contract";
import { Address } from "./components/RoleBadge";
import { DemoBar } from "./components/DemoBar";
import { isDemoMode } from "./lib/demo";
import { ProjectList } from "./pages/ProjectList";
import { ProjectDetail } from "./pages/ProjectDetail";
import { CreateProject } from "./pages/CreateProject";

export default function App() {
  const { account, isCorrectNetwork, hasMetaMask, isConnecting, error, connect, switchToSepolia } = useWallet();
  const [view, setView] = useState({ name: "list" });

  const ready = hasMetaMask && account && isCorrectNetwork && (CONTRACT_ADDRESS || isDemoMode());

  return (
    <div className="app">
      {/* Banner ini sengaja permanen - posisi hukum proyek (slide 15-16). */}
      <div className="sim-banner">
        Simulasi akademik · Sepolia testnet · bukan alat pembayaran
      </div>

      {/* Sengaja tanpa onChange: berpindah peran tidak boleh melempar pengguna
          kembali ke daftar. useWallet sudah berlangganan perubahan demo, jadi
          App ikut render ulang sendiri dan halaman detail yang sedang terbuka
          langsung menampilkan tombol milik peran yang baru. */}
      <DemoBar />

      <header className="topbar">
        <div className="brand">
          <h1>Freelance Escrow</h1>
          <span className="muted">Pembayaran freelance berbasis smart contract</span>
        </div>

        <div className="wallet">
          {account ? (
            <>
              <Address value={account} />
              {isCorrectNetwork ? (
                <span className="badge badge-ok">Sepolia</span>
              ) : (
                <button className="btn btn-primary" onClick={switchToSepolia}>
                  Pindah ke Sepolia
                </button>
              )}
            </>
          ) : (
            <button className="btn btn-primary" onClick={connect} disabled={isConnecting}>
              {isConnecting ? "Menghubungkan…" : "Hubungkan wallet"}
            </button>
          )}
        </div>
      </header>

      <main>
        {error && <p className="error-box">{error}</p>}

        {!hasMetaMask && !isDemoMode() && (
          <p className="error-box">
            MetaMask tidak terdeteksi. Pasang ekstensi MetaMask lalu muat ulang halaman ini.
          </p>
        )}

        {!CONTRACT_ADDRESS && !isDemoMode() && (
          <p className="error-box">
            <code>VITE_CONTRACT_ADDRESS</code> belum diisi. Deploy contract lalu isi{" "}
            <code>frontend/.env</code>.
          </p>
        )}

        {hasMetaMask && !account && (
          <p className="muted">Hubungkan wallet untuk melihat proyek Anda.</p>
        )}

        {account && !isCorrectNetwork && (
          <p className="warn">
            Wallet sedang berada di jaringan lain. Pindah ke Sepolia agar dapat membaca contract.
          </p>
        )}

        {ready && view.name === "list" && (
          <ProjectList
            account={account}
            onOpen={(projectId) => setView({ name: "detail", projectId })}
            onCreate={() => setView({ name: "create" })}
          />
        )}

        {ready && view.name === "create" && (
          <CreateProject
            account={account}
            onCreated={() => setView({ name: "list" })}
            onCancel={() => setView({ name: "list" })}
          />
        )}

        {ready && view.name === "detail" && (
          <ProjectDetail
            projectId={view.projectId}
            account={account}
            onBack={() => setView({ name: "list" })}
          />
        )}
      </main>

      <footer className="footer">
        <span>DTSC6018001 · BINUS University</span>
        {CONTRACT_ADDRESS && (
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
          >
            Lihat contract di Etherscan
          </a>
        )}
      </footer>
    </div>
  );
}

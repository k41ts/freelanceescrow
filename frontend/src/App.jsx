import { useEffect, useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { CONTRACT_ADDRESS } from "./lib/contract";
import { Address } from "./components/RoleBadge";
import { DemoBar } from "./components/DemoBar";
import { Mark } from "./components/Mark";
import { enableDemo, isDemoMode } from "./lib/demo";
import { ProjectList } from "./pages/ProjectList";
import { ProjectDetail } from "./pages/ProjectDetail";
import { CreateProject } from "./pages/CreateProject";
import { Landing } from "./pages/Landing";

// Landing di "/", aplikasi di "#app" supaya muat ulang tidak melempar balik ke landing.
const inApp = () => window.location.hash === "#app";

export default function App() {
  const { account, isCorrectNetwork, hasMetaMask, isConnecting, error, connect, switchToSepolia } = useWallet();
  const [view, setView] = useState({ name: "list" });
  const [showApp, setShowApp] = useState(inApp);

  useEffect(() => {
    const onHash = () => {
      setShowApp(inApp());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const ready = hasMetaMask && account && isCorrectNetwork && (CONTRACT_ADDRESS || isDemoMode());
  const demo = isDemoMode();

  if (!showApp) {
    return (
      <Landing
        onOpenApp={() => (window.location.hash = "app")}
        onConnect={() => {
          window.location.hash = "app";
          if (hasMetaMask) connect();
        }}
        onTryDemo={() => {
          enableDemo();
          window.location.hash = "app";
        }}
      />
    );
  }

  return (
    <div className="app">
      {/* Banner ini sengaja permanen - posisi hukum proyek (slide 15-16). */}
      <p className="sim-banner">Simulasi akademik di Sepolia testnet. Bukan alat pembayaran.</p>

      <header className="topbar container">
        <button
          type="button"
          className="brand"
          onClick={() => {
            setView({ name: "list" });
            window.location.hash = "";
          }}
        >
          <Mark />
          <span>Escrow</span>
        </button>
        <span className="grow" />
        {account ? (
          <>
            {isCorrectNetwork || demo ? (
              <span className="network">
                <span className="dot" />
                {demo ? "Simulasi" : "Sepolia"}
              </span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={switchToSepolia}>
                Pindah ke Sepolia
              </button>
            )}
            <span className="wallet">
              <Address value={account} />
            </span>
          </>
        ) : (
          <button type="button" className="btn btn-dark" onClick={connect} disabled={isConnecting}>
            {isConnecting ? "Menghubungkan…" : "Hubungkan wallet"}
          </button>
        )}
      </header>

      {/* Sengaja tanpa onChange: berpindah peran tidak boleh melempar pengguna
          kembali ke daftar. Halaman detail yang terbuka langsung menampilkan
          tombol milik peran yang baru. */}
      <div className="container">
        <DemoBar />
      </div>

      <main className="container main">
        {error && <p className="error-box">{error}</p>}

        {!hasMetaMask && !demo && (
          <div className="gate">
            <h1 className="display">Pasang MetaMask dulu</h1>
            <p className="lede">
              Escrow ini berjalan di Sepolia testnet dan butuh wallet. Pasang ekstensi MetaMask lalu muat ulang halaman,
              atau aktifkan mode demo di atas untuk mencoba alurnya tanpa wallet.
            </p>
          </div>
        )}

        {!CONTRACT_ADDRESS && !demo && (
          <p className="error-box">
            <code>VITE_CONTRACT_ADDRESS</code> belum diisi. Deploy contract lalu isi <code>frontend/.env</code>.
          </p>
        )}

        {hasMetaMask && !account && (
          <div className="gate">
            <h1 className="display">Hubungkan wallet</h1>
            <p className="lede">
              Dana tiap milestone dikunci di smart contract dan hanya cair setelah disetujui, lewat auto-release, atau
              putusan arbitrator. Hubungkan wallet untuk melihat proyek yang melibatkan Anda.
            </p>
            <button type="button" className="btn btn-dark" onClick={connect} disabled={isConnecting}>
              {isConnecting ? "Menghubungkan…" : "Hubungkan wallet"}
            </button>
          </div>
        )}

        {account && !isCorrectNetwork && !demo && (
          <p className="warn">Wallet sedang berada di jaringan lain. Pindah ke Sepolia agar dapat membaca contract.</p>
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
          <ProjectDetail projectId={view.projectId} account={account} onBack={() => setView({ name: "list" })} />
        )}
      </main>

      <footer className="footer container">
        <span>DTSC6018001, BINUS University</span>
        {CONTRACT_ADDRESS && (
          <span>
            Kontrak <Address value={CONTRACT_ADDRESS} />, terverifikasi di{" "}
            <a href={`https://eth-sepolia.blockscout.com/address/${CONTRACT_ADDRESS}#code`} target="_blank" rel="noreferrer">
              Blockscout
            </a>{" "}
            dan{" "}
            <a href={`https://sourcify.dev/server/repo-ui/11155111/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
              Sourcify
            </a>
          </span>
        )}
      </footer>
    </div>
  );
}

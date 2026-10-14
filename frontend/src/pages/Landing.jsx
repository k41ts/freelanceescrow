import { useState } from "react";
import { flushSync } from "react-dom";
import { parseEther } from "ethers";
import { FundRail } from "../components/FundRail";
import { StateBlock } from "../components/RoleBadge";
import { Mark } from "../components/Mark";
import { buildZones, eth, STATE_DESC } from "../lib/escrow-ui";
import { CONTRACT_ADDRESS } from "../lib/contract";

const SEED = [
  { index: 0, key: 0, amount: parseEther("0.01"), state: "None" },
  { index: 1, key: 1, amount: parseEther("0.02"), state: "None" },
];

/**
 * Langkah yang sah untuk milestone aktif, mengikuti aturan FreelanceEscrow.sol.
 * Nama event sama persis dengan yang dipancarkan contract.
 */
function stepsFor(m) {
  const n = m.index;
  const amt = `${eth(m.amount)} ETH`;
  switch (m.state) {
    case "None":
      return { actor: "Klien", steps: [{ label: `Kunci ${amt}`, to: "Funded", event: `MilestoneFunded(1, ${n}, ${amt})` }] };
    case "Funded":
      return { actor: "Freelancer", steps: [{ label: "Kirim hasil kerja", to: "Submitted", event: `WorkSubmitted(1, ${n}, "ipfs://bafy…")` }] };
    case "Submitted":
      return {
        actor: "Klien",
        steps: [
          { label: "Setujui", to: "Released", event: `MilestoneApproved(1, ${n}, freelancer, ${amt})` },
          { label: "Diam sampai batas review", to: "Released", event: `MilestoneAutoReleased(1, ${n}, freelancer, ${amt})`, kind: "outline" },
          { label: "Ajukan sengketa", to: "Disputed", event: `DisputeRaised(1, ${n}, klien)`, kind: "danger" },
        ],
      };
    case "Disputed":
      return {
        actor: "Arbitrator",
        steps: [
          { label: "Bayar freelancer", to: "Released", event: `DisputeResolved(1, ${n}, true, ${amt})` },
          { label: "Kembalikan ke klien", to: "Refunded", event: `DisputeResolved(1, ${n}, false, ${amt})`, kind: "outline" },
        ],
      };
    default:
      return null;
  }
}

/** Ganti state dengan transisi kartu antar zona bila browser mendukungnya. */
function withTransition(update) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return update();
  document.startViewTransition(() => flushSync(update));
}

function Simulator() {
  const [{ milestones, log }, setSim] = useState({ milestones: SEED, log: [] });

  const active = milestones.find((m) => m.state !== "Released" && m.state !== "Refunded");
  const turn = active && stepsFor(active);

  // Klik ganda saat transisi masih berjalan tidak boleh mencatat event dua kali,
  // sama seperti contract yang menolak transaksi dari state yang sudah berubah.
  const apply = (step, from) =>
    withTransition(() =>
      setSim((s) => {
        if (s.milestones[from.index].state !== from.state) return s;
        return {
          milestones: s.milestones.map((m) => (m.index === from.index ? { ...m, state: step.to } : m)),
          log: [step.event, ...s.log],
        };
      }),
    );

  const reset = () => withTransition(() => setSim({ milestones: SEED, log: [] }));

  return (
    <section className="sim" aria-labelledby="sim-title">
      <div className="sim-head">
        <h2 id="sim-title" className="h2">
          Desain Logo Startup, dua milestone
        </h2>
        <p className="muted">Coba sendiri. Tiap tombol adalah satu transaksi ke contract.</p>
      </div>

      <FundRail zones={buildZones(milestones)} variant="cards" transitionPrefix="sim" />

      <div className="sim-turn" aria-live="polite">
        {turn ? (
          <>
            <div className="sim-turn-text">
              <strong>
                Giliran {turn.actor.toLowerCase()}, milestone {active.index + 1}
              </strong>
              <span className="muted">{STATE_DESC[active.state]}</span>
            </div>
            <div className="sim-actions">
              {turn.steps.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={`btn ${s.kind ? `btn-${s.kind}` : active.state === "None" ? "btn-primary" : "btn-dark"}`}
                  onClick={() => apply(s, active)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sim-turn-text">
              <strong>Proyek selesai</strong>
              <span className="muted">Semua dana sudah keluar dari contract. Tidak ada sisa yang tertahan.</span>
            </div>
            <div className="sim-actions">
              <button type="button" className="btn btn-outline" onClick={reset}>
                Ulang dari awal
              </button>
            </div>
          </>
        )}
      </div>

      {log.length > 0 && (
        <div className="sim-log">
          <span className="caption">Event yang tercatat di contract, terbaru di atas</span>
          <ol>
            {log.map((e, i) => (
              <li key={log.length - i}>
                <code>{e}</code>
              </li>
            ))}
          </ol>
          {turn && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Ulang dari awal
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const EXITS = [
  {
    state: "Released",
    name: "Klien menyetujui hasil kerja",
    who: "Klien",
    to: "Freelancer",
    fn: "approve",
  },
  {
    state: "Submitted",
    name: "Klien diam melewati batas review",
    who: "Siapa saja, setelah batas lewat",
    to: "Freelancer",
    fn: "autoRelease",
  },
  {
    state: "Disputed",
    name: "Arbitrator memutus sengketa",
    who: "Arbitrator",
    to: "Freelancer atau kembali ke klien",
    fn: "resolveDispute",
  },
];

const REPO_URL = "https://github.com/k41ts/freelanceescrow";

export function Landing({ onOpenApp, onTryDemo }) {
  return (
    <div className="app landing">
      <p className="sim-banner">Simulasi akademik di Sepolia testnet. Bukan alat pembayaran.</p>

      <header className="topbar container">
        <span className="brand">
          <Mark />
          <span>Escrow</span>
        </span>
        <span className="grow" />
        <button type="button" className="btn btn-outline" onClick={onOpenApp}>
          Buka aplikasi
        </button>
      </header>

      <main className="container landing-main">
        <section className="hero">
          <h1 className="hero-title">Uangnya sudah di contract sebelum pekerjaan dimulai.</h1>
          <div className="hero-side">
            <p className="lede">
              Klien mengunci dana tiap milestone di smart contract. Freelancer mengirim hasil kerja, dan dana cair saat
              disetujui. Bila klien diam, dana cair sendiri setelah batas review. Bila berselisih, arbitrator yang
              memutuskan.
            </p>
            <div className="row gap-sm">
              <button type="button" className="btn btn-dark" onClick={onOpenApp}>
                Buka aplikasi
              </button>
              <button type="button" className="btn btn-outline" onClick={onTryDemo}>
                Coba tanpa wallet
              </button>
            </div>
          </div>
        </section>

        <Simulator />

        <section className="exits" aria-labelledby="exits-title">
          <div className="exits-intro">
            <h2 id="exits-title" className="exits-title">
              Dana hanya bisa keluar lewat tiga jalan.
            </h2>
            <p className="lede">
              Contract ini tidak punya fungsi withdraw. Klien tidak bisa menarik kembali dana yang sudah dikunci, dan
              freelancer tidak bisa mengambilnya sebelum waktunya.
            </p>
          </div>
          <div className="table-wrap">
            <table className="table exits-table">
              <thead>
                <tr>
                  <th scope="col">Jalan keluar</th>
                  <th scope="col">Dipicu oleh</th>
                  <th scope="col">Dana ke</th>
                  <th scope="col">Fungsi</th>
                </tr>
              </thead>
              <tbody>
                {EXITS.map((x) => (
                  <tr key={x.fn}>
                    <td>
                      <span className="state-badge strong">
                        <StateBlock state={x.state} size="sm" />
                        {x.name}
                      </span>
                    </td>
                    <td>{x.who}</td>
                    <td>{x.to}</td>
                    <td>
                      <code>{x.fn}()</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="closing">
          <p className="closing-text">
            Satu contract menampung semua proyek. Bukti kerja disimpan di IPFS, dan hanya CID-nya yang dicatat on-chain.
          </p>
          <div className="row gap-sm">
            <button type="button" className="btn btn-primary" onClick={onOpenApp}>
              Buka aplikasi
            </button>
            {CONTRACT_ADDRESS && (
              <a
                className="btn btn-ghost"
                href={`https://eth-sepolia.blockscout.com/address/${CONTRACT_ADDRESS}#code`}
                target="_blank"
                rel="noreferrer"
              >
                Baca source contract di Blockscout
              </a>
            )}
          </div>
        </section>
      </main>

      {/* Identitas tim dan kode sumber sengaja ditampilkan: halaman phishing
          justru anonim, dan filter web menilai sinyal seperti ini. */}
      <footer className="footer container">
        <span>
          Proyek kuliah DTSC6018001, BINUS University. Nicholas, Evan, Kai, Akmal, Tafarel.{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Kode sumber di GitHub
          </a>
        </span>
        <span>Di Indonesia hanya Rupiah yang sah sebagai alat pembayaran (UU No. 7/2011 Pasal 21).</span>
      </footer>
    </div>
  );
}

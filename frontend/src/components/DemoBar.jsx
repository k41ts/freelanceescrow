import { useEffect, useState } from "react";
import {
  DEMO_ACCOUNTS,
  DEMO_ROLES,
  disableDemo,
  enableDemo,
  getDemoRole,
  isDemoMode,
  resetDemo,
  setDemoRole,
  subscribeDemo,
} from "../lib/demo";

/**
 * Bilah kendali mode demo: tombol untuk berpindah peran tanpa wallet.
 * Sengaja dibuat mencolok dan selalu menyebut kata "simulasi", supaya tidak ada
 * yang mengira transaksi di layar ini benar-benar masuk ke blockchain.
 */
export function DemoBar({ onChange }) {
  const [, force] = useState(0);

  useEffect(() => subscribeDemo(() => force((n) => n + 1)), []);

  if (!isDemoMode()) {
    return (
      <div className="demo-off">
        <span className="muted">Tidak punya MetaMask di komputer ini?</span>
        <button
          className="btn btn-secondary"
          onClick={() => {
            enableDemo();
            onChange?.();
          }}
        >
          Aktifkan mode demo
        </button>
      </div>
    );
  }

  const role = getDemoRole();

  return (
    <div className="demo-bar">
      <div className="demo-bar-head">
        <strong>MODE DEMO</strong>
        <span>Data simulasi — tidak ada transaksi yang dikirim ke blockchain</span>
      </div>

      <div className="demo-bar-controls">
        <span className="demo-label">Tampil sebagai:</span>
        {DEMO_ROLES.map((r) => (
          <button
            key={r}
            className={`btn ${role === r ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setDemoRole(r);
              onChange?.();
            }}
          >
            {DEMO_ACCOUNTS[r].label}
          </button>
        ))}

        <span className="demo-spacer" />

        <button
          className="btn btn-ghost"
          onClick={() => {
            resetDemo();
            onChange?.();
          }}
        >
          Ulang dari awal
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            disableDemo();
            onChange?.();
          }}
        >
          Keluar mode demo
        </button>
      </div>
    </div>
  );
}

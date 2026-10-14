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
 * Selalu menyebut bahwa datanya simulasi, supaya tidak ada yang mengira
 * transaksi di layar ini benar-benar masuk ke blockchain.
 */
export function DemoBar({ onChange }) {
  const [, force] = useState(0);

  useEffect(() => subscribeDemo(() => force((n) => n + 1)), []);

  if (!isDemoMode()) {
    return (
      <div className="demo-strip">
        <span className="muted">Tidak punya MetaMask di komputer ini?</span>
        <span className="grow" />
        <button
          type="button"
          className="btn btn-outline btn-sm"
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
    <div className="demo-strip">
      <strong>Mode demo</strong>
      <span className="muted">Data simulasi, tidak ada transaksi yang dikirim.</span>
      <span className="grow" />
      <span className="muted">Lihat sebagai</span>
      <div className="segmented" role="group" aria-label="Peran demo">
        {DEMO_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => {
              setDemoRole(r);
              onChange?.();
            }}
          >
            {DEMO_ACCOUNTS[r].label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          resetDemo();
          onChange?.();
        }}
      >
        Ulang dari awal
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          disableDemo();
          onChange?.();
        }}
      >
        Keluar mode demo
      </button>
    </div>
  );
}

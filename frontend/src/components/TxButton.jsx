import { useState } from "react";
import { humanizeError } from "../lib/contract";

/**
 * Tombol untuk aksi on-chain.
 * Transaksi Sepolia butuh belasan detik; tanpa indikator status UI akan terasa
 * menggantung dan pengguna cenderung menekan tombol dua kali.
 */
export function TxButton({ children, onRun, variant = "primary", disabled = false, confirm = null }) {
  const [status, setStatus] = useState("idle"); // idle | pending | error
  const [message, setMessage] = useState(null);

  async function handleClick() {
    if (confirm && !window.confirm(confirm)) return;

    setStatus("pending");
    setMessage(null);
    try {
      await onRun();
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(humanizeError(err));
    }
  }

  return (
    <span className="txbutton">
      <button
        type="button"
        className={`btn btn-${variant}`}
        onClick={handleClick}
        disabled={disabled || status === "pending"}
      >
        {status === "pending" ? "Memproses…" : children}
      </button>
      {status === "pending" && <span className="txbutton-hint">Konfirmasi di MetaMask, lalu tunggu blok.</span>}
      {status === "error" && <span className="txbutton-error">{message}</span>}
    </span>
  );
}

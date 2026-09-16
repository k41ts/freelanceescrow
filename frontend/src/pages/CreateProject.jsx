import { useState } from "react";
import { getWriteContract, humanizeError, parseEther } from "../lib/contract";

const REVIEW_PERIODS = [
  { label: "3 menit (untuk demo)", value: 3 * 60 },
  { label: "5 menit (untuk demo)", value: 5 * 60 },
  { label: "1 hari", value: 24 * 60 * 60 },
  { label: "7 hari (nilai produksi)", value: 7 * 24 * 60 * 60 },
];

export function CreateProject({ account, onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [freelancer, setFreelancer] = useState("");
  const [arbitrator, setArbitrator] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState(REVIEW_PERIODS[0].value);
  const [amounts, setAmounts] = useState(["0.01"]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function updateAmount(i, value) {
    setAmounts((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const parsed = amounts.map((a) => {
        const value = parseEther(a || "0");
        if (value === 0n) throw new Error("Nilai milestone tidak boleh nol.");
        return value;
      });

      const contract = await getWriteContract();
      const tx = await contract.createProject(freelancer, arbitrator, reviewPeriod, parsed, title);
      await tx.wait();
      onCreated();
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setBusy(false);
    }
  }

  const total = amounts.reduce((sum, a) => sum + (Number(a) || 0), 0);

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Buat kontrak baru</h2>
      <p className="muted">
        Membuat kontrak belum memindahkan dana. Pendanaan dilakukan per milestone setelah kontrak
        dibuat.
      </p>

      {/* Klien tidak punya kolom input: contract mengambilnya dari msg.sender,
          yaitu penanda tangan transaksi. Ditampilkan di sini supaya jelas
          siapa yang akan tercatat sebagai klien. */}
      <div className="readonly-field">
        <span className="readonly-label">Klien</span>
        <code className="address readonly-value">{account}</code>
        <small className="muted">
          Akun MetaMask yang sedang aktif. Contract mencatat klien dari tanda tangan transaksi,
          jadi alamat ini tidak bisa dan tidak perlu diisi manual. Ganti akun di MetaMask bila
          ingin klien yang berbeda.
        </small>
      </div>

      <label>
        Judul proyek
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Desain logo" required />
      </label>

      <label>
        Alamat wallet freelancer
        <input
          value={freelancer}
          onChange={(e) => setFreelancer(e.target.value)}
          placeholder="0x…"
          pattern="0x[a-fA-F0-9]{40}"
          required
        />
      </label>

      <label>
        Alamat wallet arbitrator
        <input
          value={arbitrator}
          onChange={(e) => setArbitrator(e.target.value)}
          placeholder="0x…"
          pattern="0x[a-fA-F0-9]{40}"
          required
        />
        <small className="muted">
          Harus berbeda dari klien dan freelancer. Contract menolak bila ada peran yang dirangkap.
        </small>
      </label>

      <label>
        Batas waktu review sebelum auto-release
        <select value={reviewPeriod} onChange={(e) => setReviewPeriod(Number(e.target.value))}>
          {REVIEW_PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <small className="muted">
          Saat presentasi pilih 3–5 menit supaya auto-release bisa ditunjukkan langsung.
        </small>
      </label>

      <fieldset className="milestones-field">
        <legend>Milestone</legend>
        {amounts.map((a, i) => (
          <div key={i} className="milestone-row">
            <span>#{i + 1}</span>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={a}
              onChange={(e) => updateAmount(i, e.target.value)}
              required
            />
            <span className="unit">ETH</span>
            {amounts.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAmounts((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Hapus
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setAmounts((p) => [...p, "0.01"])}>
          + Tambah milestone
        </button>
      </fieldset>

      <p className="total">
        Total nilai proyek: <strong>{total.toFixed(4)} ETH</strong>
      </p>

      {error && <p className="error-box">{error}</p>}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Memproses…" : "Buat kontrak"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>
          Batal
        </button>
      </div>
    </form>
  );
}

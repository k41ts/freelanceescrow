import { useState } from "react";
import { getWriteContract, humanizeError, parseEther } from "../lib/contract";

// Urutan sengaja begini: yang pertama menjadi nilai default.
// Bila 3 menit di urutan pertama, auto-release selalu menyela lebih dulu dan
// alur approve tidak pernah sempat didemokan.
const REVIEW_PERIODS = [
  { label: "1 hari", hint: "Cocok untuk demo approve", value: 24 * 60 * 60 },
  { label: "7 hari", hint: "Nilai produksi", value: 7 * 24 * 60 * 60 },
  { label: "5 menit", hint: "Demo auto-release", value: 5 * 60 },
  { label: "3 menit", hint: "Demo auto-release cepat", value: 3 * 60 },
];

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

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

  const nums = amounts.map((a) => Math.max(0, Number(a) || 0));
  const total = nums.reduce((sum, a) => sum + a, 0);
  const period = REVIEW_PERIODS.find((p) => p.value === reviewPeriod);

  // Peringatan yang sama dengan aturan contract, ditampilkan sebelum transaksi dikirim.
  const issues = [];
  if (!freelancer) issues.push("Wallet freelancer belum diisi.");
  else if (!ADDRESS_RE.test(freelancer)) issues.push("Alamat freelancer belum valid.");
  if (!arbitrator) issues.push("Wallet arbitrator belum diisi.");
  else if (!ADDRESS_RE.test(arbitrator)) issues.push("Alamat arbitrator belum valid.");
  const lower = [account, freelancer, arbitrator].filter(Boolean).map((a) => a.toLowerCase());
  if (new Set(lower).size < lower.length) issues.push("Klien, freelancer, dan arbitrator harus wallet yang berbeda.");

  return (
    <div className="stack-xl">
      <div className="stack-md">
        <button type="button" className="back-link" onClick={onCancel} disabled={busy}>
          <BackIcon />
          Batal
        </button>
        <h1 className="display">Kontrak baru</h1>
        <p className="lede">
          Kontrak mencatat siapa terlibat dan berapa nilai tiap milestone. Belum ada dana yang berpindah sampai Anda
          mengunci milestone pertama.
        </p>
      </div>

      <div className="columns columns-form">
        <form id="create-form" className="col-main form" onSubmit={handleSubmit}>
          <section className="form-section">
            <h2 className="section-title">Pihak yang terlibat</h2>
            <label className="field">
              <span className="field-label">Judul proyek</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Desain logo" required />
            </label>
            {/* Klien tidak punya kolom input: contract mengambilnya dari msg.sender. */}
            <div className="field">
              <span className="field-label">Klien</span>
              <div className="readonly">{account}</div>
              <span className="caption">Wallet yang sedang terhubung. Ganti akun di MetaMask untuk klien lain.</span>
            </div>
            <label className="field">
              <span className="field-label">Wallet freelancer</span>
              <input
                className="mono"
                value={freelancer}
                onChange={(e) => setFreelancer(e.target.value.trim())}
                placeholder="0x…"
                pattern="0x[a-fA-F0-9]{40}"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Wallet arbitrator</span>
              <input
                className="mono"
                value={arbitrator}
                onChange={(e) => setArbitrator(e.target.value.trim())}
                placeholder="0x…"
                pattern="0x[a-fA-F0-9]{40}"
                required
              />
              <span className="caption">
                Pihak ketiga yang memutus bila terjadi sengketa. Harus berbeda dari klien dan freelancer.
              </span>
            </label>
          </section>

          <fieldset className="form-section">
            <legend className="section-title">Waktu review</legend>
            <p className="muted">
              Bila klien tidak menyetujui atau menyengketakan hasil dalam waktu ini, dana cair otomatis ke freelancer.
            </p>
            <div className="period-grid">
              {REVIEW_PERIODS.map((p) => (
                <label key={p.value} className="period">
                  <input
                    type="radio"
                    name="review"
                    value={p.value}
                    checked={reviewPeriod === p.value}
                    onChange={() => setReviewPeriod(p.value)}
                  />
                  <span className="period-label">{p.label}</span>
                  <span className="period-hint">{p.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend className="section-title">Milestone</legend>
            {amounts.map((a, i) => (
              <div key={i} className="ms-input">
                <span className="ms-no">{i + 1}</span>
                <label className="amount-input">
                  <span className="sr-only">Nilai milestone {i + 1} dalam ETH</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={a}
                    onChange={(e) => updateAmount(i, e.target.value)}
                    required
                  />
                  <span className="unit">ETH</span>
                </label>
                {amounts.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Hapus milestone ${i + 1}`}
                    onClick={() => setAmounts((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-dashed" onClick={() => setAmounts((p) => [...p, "0.01"])}>
              Tambah milestone
            </button>
          </fieldset>
        </form>

        <aside className="col-side stack-md" aria-label="Ringkasan kontrak">
          <div className="summary">
            <div>
              <span className="muted">Nilai kontrak</span>
              <div className="summary-amount">
                {Number(total.toFixed(4))}
                <span>ETH</span>
              </div>
            </div>
            <div className="bars" aria-hidden="true">
              {nums.map((v, i) => (
                <span key={i} style={{ flexGrow: v || 0.001 }}>
                  {i + 1}
                </span>
              ))}
            </div>
            <dl className="kv">
              <div>
                <dt>Milestone</dt>
                <dd>{amounts.length} tahap</dd>
              </div>
              <div>
                <dt>Waktu review</dt>
                <dd>{period?.label}</dd>
              </div>
              <div>
                <dt>Dana yang berpindah sekarang</dt>
                <dd>0 ETH</dd>
              </div>
            </dl>
          </div>
          {issues.length > 0 && (
            <ul className="notice">
              {issues.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          {error && <p className="error-box">{error}</p>}
          <button className="btn btn-dark btn-block" type="submit" form="create-form" disabled={busy}>
            {busy ? "Memproses…" : "Buat kontrak"}
          </button>
          <p className="caption">MetaMask akan meminta tanda tangan. Biaya gas dibayar dengan ETH Sepolia.</p>
        </aside>
      </div>
    </div>
  );
}

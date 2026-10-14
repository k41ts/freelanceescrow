import { useEffect, useRef, useState } from "react";
import { getWriteContract } from "../lib/contract";
import { eth, formatDateTime, STATE_DESC } from "../lib/escrow-ui";
import { gatewayUrl, isPinataConfigured, uploadToIpfs } from "../lib/ipfs";
import { TxButton } from "./TxButton";

function useCountdown(targetSeconds) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!targetSeconds) return;
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [targetSeconds]);

  if (!targetSeconds) return null;
  const remaining = Number(targetSeconds) - now;
  if (remaining <= 0) return { expired: true, remaining: 0, text: "batas waktu sudah lewat" };

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const text = h > 0 ? `${h} jam ${m} menit` : m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
  return { expired: false, remaining, text };
}

const FileIcon = () => (
  <svg width="30" height="36" viewBox="0 0 36 44" aria-hidden="true">
    <path d="M2 2h22l10 10v30H2z" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" />
    <path d="M24 2v10h10" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

/**
 * Satu baris milestone. Tombol aksi menyesuaikan peran pengguna dan status
 * milestone (slide 10); tombol yang pasti ditolak contract tidak ditampilkan.
 */
export function MilestoneCard({ milestone, project, role, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const countdown = useCountdown(milestone.state === "Submitted" ? milestone.releasableAt : 0n);
  const canAutoRelease = milestone.state === "Submitted" && countdown?.expired;

  const { index, state } = milestone;
  const id = project.projectId;
  const amount = eth(milestone.amount);

  async function run(method, ...args) {
    const contract = await getWriteContract();
    const tx = await contract[method](id, index, ...args);
    await tx.wait();
    onDone();
  }

  async function submitWork() {
    if (!file) throw new Error("Pilih file bukti hasil kerja terlebih dahulu.");
    setUploading(true);
    try {
      const cid = await uploadToIpfs(file);
      await run("submitWork", cid);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  const isParticipant = role === "client" || role === "freelancer";
  const isOpen = state === "Funded" || state === "Submitted";

  const actions = [];
  if (role === "client" && state === "None")
    actions.push(<TxButton key="deposit" variant="outline" onRun={() => run("deposit", { value: milestone.amount })}>Kunci dana {amount} ETH</TxButton>);
  if (role === "client" && state === "Submitted")
    actions.push(<TxButton key="approve" onRun={() => run("approve")}>Setujui dan cairkan {amount} ETH</TxButton>);
  if (canAutoRelease && role !== "client")
    actions.push(<TxButton key="auto" variant="dark" onRun={() => run("autoRelease")}>Cairkan otomatis</TxButton>);
  if (isParticipant && isOpen)
    actions.push(
      <TxButton
        key="dispute"
        variant="danger"
        onRun={() => run("raiseDispute")}
        confirm="Ajukan sengketa untuk milestone ini? Dana hanya bisa cair lewat putusan arbitrator setelah ini."
      >
        Ajukan sengketa
      </TxButton>,
    );
  if (role === "arbitrator" && state === "Disputed") {
    actions.push(<TxButton key="rel" variant="dark" onRun={() => run("resolveDispute", true)}>Cairkan ke freelancer</TxButton>);
    actions.push(<TxButton key="ref" variant="outline" onRun={() => run("resolveDispute", false)}>Kembalikan ke klien</TxButton>);
  }

  const showSubmit = role === "freelancer" && state === "Funded";
  const showTimer = state === "Submitted" && countdown;
  const hasPanel = Boolean(milestone.cid) || showSubmit || showTimer || actions.length > 0;
  // Baris yang butuh tindakan wallet ini disorot, sisanya tetap tenang.
  const needsYou =
    (role === "client" && state === "Submitted") ||
    (role === "freelancer" && state === "Funded") ||
    (role === "arbitrator" && state === "Disputed");

  const reviewPeriod = Number(project.reviewPeriod) || 1;
  const elapsedPct = showTimer ? Math.min(100, Math.max(0, 100 - (countdown.remaining / reviewPeriod) * 100)) : 0;

  return (
    <li className={`ms ms-${state}${needsYou ? " ms-active" : ""}`}>
      <div className="ms-row">
        <span className="ms-no">{index + 1}</span>
        <div className="ms-text">
          <strong>Milestone {index + 1}</strong>
          <span className="ms-desc">{needsYou && state === "Submitted" ? "Hasil kerja masuk. Menunggu review Anda." : STATE_DESC[state]}</span>
        </div>
        <span className="ms-amount">{amount} ETH</span>
      </div>

      {hasPanel && (
        <div className="ms-panel">
          {milestone.cid && (
            <div className="evidence">
              <FileIcon />
              <div className="evidence-text">
                <strong>Bukti hasil kerja</strong>
                <span className="caption">Tersimpan di IPFS, CID {milestone.cid.slice(0, 14)}…{milestone.cid.slice(-4)}</span>
              </div>
              <a className="btn btn-outline" href={gatewayUrl(milestone.cid)} target="_blank" rel="noreferrer">
                Buka file
              </a>
            </div>
          )}

          {showTimer && (
            <div className="countdown">
              <div className="countdown-text">
                {countdown.expired ? (
                  <span>Batas review sudah lewat. Siapa pun boleh mencairkan dana ke freelancer.</span>
                ) : (
                  <span>
                    Cair otomatis ke freelancer dalam <strong>{countdown.text}</strong>
                  </span>
                )}
                <span className="caption">{formatDateTime(milestone.releasableAt)}</span>
              </div>
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${elapsedPct}%` }} />
              </div>
            </div>
          )}

          {showSubmit && (
            <div className="submit-block">
              {!isPinataConfigured() && (
                <p className="warn">VITE_PINATA_JWT belum diisi, upload IPFS tidak akan jalan.</p>
              )}
              <label className="dropzone">
                <input
                  ref={fileInput}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                <FileIcon />
                <span>
                  <strong>{file ? file.name : "Pilih file hasil kerja"}</strong>
                  <span className="caption">File diunggah ke IPFS. Hanya CID-nya yang dicatat di kontrak.</span>
                </span>
              </label>
              <TxButton onRun={submitWork} disabled={!file}>
                {uploading ? "Mengunggah ke IPFS…" : "Kirim hasil kerja"}
              </TxButton>
            </div>
          )}

          {actions.length > 0 && <div className="ms-actions">{actions}</div>}
        </div>
      )}
    </li>
  );
}

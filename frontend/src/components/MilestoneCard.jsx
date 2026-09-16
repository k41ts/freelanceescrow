import { useEffect, useRef, useState } from "react";
import { formatEther, getWriteContract, STATE_LABEL } from "../lib/contract";
import { gatewayUrl, isPinataConfigured, uploadToIpfs } from "../lib/ipfs";
import { StateBadge } from "./RoleBadge";
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
  if (remaining <= 0) return { expired: true, text: "batas waktu sudah lewat" };

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const text = h > 0 ? `${h} jam ${m} menit` : m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
  return { expired: false, text };
}

/**
 * Satu kartu milestone dengan tombol aksi yang menyesuaikan peran pengguna
 * dan status milestone (slide 10). Tombol yang tidak relevan tidak ditampilkan
 * sama sekali, supaya tidak ada aksi yang pasti ditolak contract.
 */
export function MilestoneCard({ milestone, project, role, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInput = useRef(null);

  const countdown = useCountdown(milestone.state === "Submitted" ? milestone.releasableAt : 0n);
  const canAutoRelease = milestone.state === "Submitted" && countdown?.expired;

  const { index } = milestone;
  const id = project.projectId;

  async function deposit() {
    const contract = await getWriteContract();
    const tx = await contract.deposit(id, index, { value: milestone.amount });
    await tx.wait();
    onDone();
  }

  async function submitWork() {
    if (!file) throw new Error("Pilih file bukti hasil kerja terlebih dahulu.");
    setUploading(true);
    setUploadError(null);
    try {
      const cid = await uploadToIpfs(file);
      const contract = await getWriteContract();
      const tx = await contract.submitWork(id, index, cid);
      await tx.wait();
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onDone();
    } finally {
      setUploading(false);
    }
  }

  async function approve() {
    const contract = await getWriteContract();
    const tx = await contract.approve(id, index);
    await tx.wait();
    onDone();
  }

  async function autoRelease() {
    const contract = await getWriteContract();
    const tx = await contract.autoRelease(id, index);
    await tx.wait();
    onDone();
  }

  async function raiseDispute() {
    const contract = await getWriteContract();
    const tx = await contract.raiseDispute(id, index);
    await tx.wait();
    onDone();
  }

  async function resolve(releaseToFreelancer) {
    const contract = await getWriteContract();
    const tx = await contract.resolveDispute(id, index, releaseToFreelancer);
    await tx.wait();
    onDone();
  }

  const isParticipant = role === "client" || role === "freelancer";
  const isOpen = milestone.state === "Funded" || milestone.state === "Submitted";

  return (
    <article className="card milestone">
      <header className="milestone-head">
        <div>
          <span className="milestone-index">Milestone {index + 1}</span>
          <strong className="milestone-amount">{formatEther(milestone.amount)} ETH</strong>
        </div>
        <StateBadge state={milestone.state} label={STATE_LABEL[milestone.state]} />
      </header>

      {milestone.cid && (
        <p className="milestone-cid">
          Bukti kerja:{" "}
          <a href={gatewayUrl(milestone.cid)} target="_blank" rel="noreferrer">
            {milestone.cid.slice(0, 18)}…
          </a>
        </p>
      )}

      {milestone.state === "Submitted" && countdown && (
        <p className={`milestone-timer ${countdown.expired ? "expired" : ""}`}>
          {countdown.expired
            ? "Batas review sudah lewat — dana bisa dicairkan otomatis."
            : `Auto-release dalam ${countdown.text}.`}
        </p>
      )}

      <footer className="milestone-actions">
        {role === "client" && milestone.state === "None" && (
          <TxButton onRun={deposit}>Kunci dana {formatEther(milestone.amount)} ETH</TxButton>
        )}

        {role === "freelancer" && milestone.state === "Funded" && (
          <div className="submit-block">
            {!isPinataConfigured() && (
              <p className="warn">VITE_PINATA_JWT belum diisi — upload IPFS tidak akan jalan.</p>
            )}
            <input
              ref={fileInput}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
            <TxButton onRun={submitWork} disabled={!file}>
              {uploading ? "Mengunggah ke IPFS…" : "Upload & kirim hasil"}
            </TxButton>
            {uploadError && <p className="warn">{uploadError}</p>}
          </div>
        )}

        {role === "client" && milestone.state === "Submitted" && (
          <TxButton onRun={approve}>Setujui & cairkan dana</TxButton>
        )}

        {canAutoRelease && role !== "client" && (
          <TxButton onRun={autoRelease} variant="secondary">
            Cairkan otomatis
          </TxButton>
        )}

        {isParticipant && isOpen && (
          <TxButton
            onRun={raiseDispute}
            variant="ghost"
            confirm="Angkat sengketa untuk milestone ini? Dana hanya bisa cair lewat putusan arbitrator setelah ini."
          >
            Angkat sengketa
          </TxButton>
        )}

        {role === "arbitrator" && milestone.state === "Disputed" && (
          <>
            <TxButton onRun={() => resolve(true)}>Menangkan freelancer</TxButton>
            <TxButton onRun={() => resolve(false)} variant="secondary">
              Kembalikan ke klien
            </TxButton>
          </>
        )}

        {(milestone.state === "Released" || milestone.state === "Refunded") && (
          <p className="milestone-final">Milestone selesai. Tidak ada aksi tersisa.</p>
        )}
      </footer>
    </article>
  );
}

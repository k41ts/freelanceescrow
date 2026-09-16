import { useCallback, useEffect, useState } from "react";
import { fetchProjectDetail, formatEther, humanizeError, roleOf } from "../lib/contract";
import { Address, RoleBadge } from "../components/RoleBadge";
import { MilestoneCard } from "../components/MilestoneCard";

export function ProjectDetail({ projectId, account, onBack }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProject(await fetchProjectDetail(projectId));
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="muted">Memuat detail proyek…</p>;
  if (error) return <p className="error-box">{error}</p>;
  if (!project) return null;

  const role = roleOf(project, account);
  const total = project.milestones.reduce((sum, m) => sum + m.amount, 0n);
  const released = project.milestones
    .filter((m) => m.state === "Released")
    .reduce((sum, m) => sum + m.amount, 0n);

  return (
    <section>
      <button className="btn btn-ghost back" onClick={onBack}>
        ← Kembali ke daftar
      </button>

      <header className="detail-head">
        <div>
          <h2>{project.title || `Proyek #${projectId}`}</h2>
          <p className="muted">
            Proyek #{projectId.toString()} · {project.milestones.length} milestone · total{" "}
            {formatEther(total)} ETH · sudah cair {formatEther(released)} ETH
          </p>
        </div>
        <RoleBadge role={role} />
      </header>

      <div className="card parties">
        <div>
          <dt>Klien</dt>
          <dd>
            <Address value={project.client} />
          </dd>
        </div>
        <div>
          <dt>Freelancer</dt>
          <dd>
            <Address value={project.freelancer} />
          </dd>
        </div>
        <div>
          <dt>Arbitrator</dt>
          <dd>
            <Address value={project.arbitrator} />
          </dd>
        </div>
        <div>
          <dt>Batas review</dt>
          {/* Satuan menyesuaikan besarannya: 20 detik jangan dibulatkan jadi
              "0 menit", dan 1 hari jangan ditampilkan sebagai "1440 menit". */}
          <dd>
            {Number(project.reviewPeriod) < 60
              ? `${Number(project.reviewPeriod)} detik`
              : Number(project.reviewPeriod) < 86400
                ? `${Math.round(Number(project.reviewPeriod) / 60)} menit`
                : `${Math.round(Number(project.reviewPeriod) / 86400)} hari`}
          </dd>
        </div>
      </div>

      {role === "none" && (
        <p className="warn">
          Wallet ini bukan klien, freelancer, maupun arbitrator proyek ini. Anda hanya bisa melihat.
        </p>
      )}

      <div className="milestone-list">
        {project.milestones.map((m) => (
          <MilestoneCard key={m.index} milestone={m} project={project} role={role} onDone={load} />
        ))}
      </div>
    </section>
  );
}

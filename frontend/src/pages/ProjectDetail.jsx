import { useCallback, useEffect, useState } from "react";
import { CONTRACT_ADDRESS, fetchProjectDetail, humanizeError, ROLE_LABEL, roleOf } from "../lib/contract";
import { buildZones, eth, formatDateTime, formatPeriod } from "../lib/escrow-ui";
import { Address } from "../components/RoleBadge";
import { FundRail } from "../components/FundRail";
import { MilestoneCard } from "../components/MilestoneCard";

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

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

  const back = (
    <button type="button" className="back-link" onClick={onBack}>
      <BackIcon />
      Semua proyek
    </button>
  );

  if (loading && !project) return <div className="stack-md">{back}<p className="muted">Memuat detail proyek…</p></div>;
  if (error) return <div className="stack-md">{back}<p className="error-box">{error}</p></div>;
  if (!project) return null;

  const role = roleOf(project, account);
  const total = project.milestones.reduce((sum, m) => sum + m.amount, 0n);
  const zones = buildZones(project.milestones.map((m) => ({ ...m, key: m.index })));

  return (
    <div className="stack-xl">
      <div className="stack-md">
        {back}
        <div className="title-row title-row-end">
          <div className="title-block">
            <h1 className="display">{project.title || `Proyek #${projectId}`}</h1>
            <p className="lede">
              {role === "none"
                ? "Wallet ini bukan klien, freelancer, maupun arbitrator proyek ini. Anda hanya bisa melihat. "
                : `Anda ${ROLE_LABEL[role].toLowerCase()} di proyek ini. `}
              Klien punya waktu {formatPeriod(project.reviewPeriod)} untuk review sebelum dana cair otomatis.
            </p>
          </div>
          <div className="value-block">
            <span className="muted">Nilai kontrak</span>
            <strong>{eth(total)} ETH</strong>
          </div>
        </div>
      </div>

      <FundRail zones={zones} variant="cards" />

      <div className="columns">
        <section className="col-main stack-md" aria-labelledby="ms-h">
          <h2 id="ms-h" className="h2">Milestone</h2>
          <ol className="ms-list">
            {project.milestones.map((m) => (
              <MilestoneCard key={m.index} milestone={m} project={project} role={role} onDone={load} />
            ))}
          </ol>
        </section>

        <aside className="col-side stack-md" aria-labelledby="party-h">
          <h2 id="party-h" className="h2">Pihak</h2>
          <dl className="parties">
            {[
              ["Klien", project.client, "client"],
              ["Freelancer", project.freelancer, "freelancer"],
              ["Arbitrator", project.arbitrator, "arbitrator"],
            ].map(([label, addr, r]) => (
              <div key={r}>
                <dt>{label}</dt>
                <dd>
                  <Address value={addr} />
                  {role === r && <span className="you">Anda</span>}
                </dd>
              </div>
            ))}
            <div>
              <dt>Batas review</dt>
              <dd>{formatPeriod(project.reviewPeriod)}</dd>
            </div>
            <div>
              <dt>Dibuat</dt>
              <dd>{formatDateTime(project.createdAt)}</dd>
            </div>
          </dl>
          {CONTRACT_ADDRESS && (
            <a
              className="text-link"
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              Lihat transaksi di Blockscout
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}

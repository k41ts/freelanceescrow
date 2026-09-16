import { useCallback, useEffect, useState } from "react";
import { fetchProjects, formatEther, humanizeError } from "../lib/contract";
import { Address, RoleBadge } from "../components/RoleBadge";

export function ProjectList({ account, onOpen, onCreate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [onlyMine, setOnlyMine] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchProjects(account));
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = onlyMine ? projects.filter((p) => p.role !== "none") : projects;

  return (
    <section>
      <div className="list-head">
        <h2>Daftar proyek</h2>
        <div className="list-actions">
          <label className="checkbox">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Hanya yang melibatkan saya
          </label>
          <button className="btn btn-ghost" onClick={load}>
            Muat ulang
          </button>
          <button className="btn btn-primary" onClick={onCreate}>
            + Kontrak baru
          </button>
        </div>
      </div>

      {loading && <p className="muted">Membaca event dari blockchain…</p>}
      {error && <p className="error-box">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <p className="muted">
          Belum ada proyek{onlyMine ? " yang melibatkan wallet ini" : ""}. Buat kontrak baru untuk memulai.
        </p>
      )}

      <div className="project-grid">
        {visible.map((p) => (
          <button key={p.projectId.toString()} className="card project-card" onClick={() => onOpen(p.projectId)}>
            <header>
              <strong>{p.title || `Proyek #${p.projectId}`}</strong>
              <RoleBadge role={p.role} />
            </header>
            <dl>
              <div>
                <dt>Nilai</dt>
                <dd>{formatEther(p.totalAmount)} ETH</dd>
              </div>
              <div>
                <dt>Milestone</dt>
                <dd>{p.milestoneCount.toString()} tahap</dd>
              </div>
              <div>
                <dt>Klien</dt>
                <dd>
                  <Address value={p.client} />
                </dd>
              </div>
              <div>
                <dt>Freelancer</dt>
                <dd>
                  <Address value={p.freelancer} />
                </dd>
              </div>
            </dl>
          </button>
        ))}
      </div>
    </section>
  );
}

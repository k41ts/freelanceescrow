import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProjects, humanizeError, ROLE_LABEL } from "../lib/contract";
import { buildZones, eth, pendingActions, projectStatus } from "../lib/escrow-ui";
import { Address, StateBlock } from "../components/RoleBadge";
import { FundRail } from "../components/FundRail";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "client", label: "Sebagai klien" },
  { key: "freelancer", label: "Sebagai freelancer" },
  { key: "arbitrator", label: "Sebagai arbitrator" },
];

const LEGEND = [
  ["None", "Belum didanai"],
  ["Funded", "Terkunci"],
  ["Submitted", "Menunggu review"],
  ["Released", "Cair"],
  ["Refunded", "Dikembalikan"],
  ["Disputed", "Sengketa"],
];

export function ProjectList({ account, onOpen, onCreate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const [filter, setFilter] = useState("all");

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

  const mine = useMemo(() => projects.filter((p) => p.role !== "none"), [projects]);
  const base = onlyMine ? mine : projects;
  const visible = filter === "all" ? base : base.filter((p) => p.role === filter);
  const count = (key) => (key === "all" ? base.length : base.filter((p) => p.role === key).length);

  const zones = useMemo(
    () =>
      buildZones(
        mine.flatMap((p) =>
          (p.milestones ?? []).map((m, i) => ({
            ...m,
            index: i,
            key: `${p.projectId}-${i}`,
            title: `${p.title || `Proyek #${p.projectId}`}, milestone ${i + 1}`,
          })),
        ),
      ),
    [mine],
  );
  const todo = useMemo(() => pendingActions(mine).slice(0, 5), [mine]);

  return (
    <div className="stack-xl">
      <section className="stack-lg">
        <div className="title-row">
          <h1 className="display">Proyek Anda</h1>
          <div className="row gap-sm">
            <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
              Muat ulang
            </button>
            <button type="button" className="btn btn-dark" onClick={onCreate}>
              Buat kontrak
            </button>
          </div>
        </div>
        {!loading && !error && <FundRail zones={zones} />}
      </section>

      {loading && <p className="muted">Membaca data proyek dari blockchain…</p>}
      {error && <p className="error-box">{error}</p>}

      {!loading && !error && todo.length > 0 && (
        <section className="stack-md" aria-labelledby="todo-h">
          <h2 id="todo-h" className="h2">Menunggu Anda</h2>
          <ul className="action-list">
            {todo.map((a, i) => (
              <li key={i} className="action-row">
                <StateBlock state={a.state} />
                <div className="action-text">
                  <strong>{a.title}</strong>
                  <span className="muted">{a.desc}</span>
                </div>
                <button
                  type="button"
                  className={`btn ${a.rank <= 2 ? "btn-primary" : "btn-outline"}`}
                  onClick={() => onOpen(a.p.projectId)}
                >
                  {a.cta}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && (
        <section className="stack-md" aria-labelledby="all-h">
          <div className="list-head">
            <h2 id="all-h" className="h2">Semua proyek</h2>
            <div className="tabs" role="tablist" aria-label="Saring menurut peran">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className="tab-count">{count(f.key)}</span>
                </button>
              ))}
            </div>
            <span className="grow" />
            <label className="checkbox">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              Hanya yang melibatkan saya
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <p>Belum ada proyek{onlyMine ? " yang melibatkan wallet ini" : ""}.</p>
              <button type="button" className="btn btn-dark" onClick={onCreate}>
                Buat kontrak pertama
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Proyek</th>
                    <th>Peran Anda</th>
                    <th>Milestone</th>
                    <th className="num">Nilai</th>
                    <th>Keadaan</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const st = projectStatus(p);
                    return (
                      <tr key={p.projectId.toString()} onClick={() => onOpen(p.projectId)}>
                        <td>
                          <button
                            type="button"
                            className="link-strong"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen(p.projectId);
                            }}
                          >
                            {p.title || `Proyek #${p.projectId}`}
                          </button>
                          <span className="caption">
                            Proyek {p.projectId.toString()}, freelancer{" "}
                            {p.role === "freelancer" ? "Anda" : <Address value={p.freelancer} />}
                          </span>
                        </td>
                        <td>{ROLE_LABEL[p.role]}</td>
                        <td>
                          <span className="seg-row">
                            {(p.milestones ?? []).map((m, i) => (
                              <StateBlock key={i} state={m.state} size="sm" />
                            ))}
                          </span>
                        </td>
                        <td className="num strong">{eth(p.totalAmount)} ETH</td>
                        <td className={`status status-${st.tone}`}>{st.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="legend">
            {LEGEND.map(([s, l]) => (
              <span key={s}>
                <StateBlock state={s} size="sm" />
                {l}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

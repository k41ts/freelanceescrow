import { ROLE_LABEL } from "../lib/contract";

export function RoleBadge({ role }) {
  return <span className={`role-tag role-${role}`}>{ROLE_LABEL[role] ?? "Pengamat"}</span>;
}

/** Penanda status milestone. Bentuk dan pola ikut membedakan, tidak hanya warna. */
export function StateBlock({ state, size = "md", title }) {
  return <span className={`mblock mblock-${size} mblock-${state}`} title={title} aria-hidden={title ? undefined : true} />;
}

export function StateBadge({ state, label }) {
  return (
    <span className="state-badge">
      <StateBlock state={state} size="sm" />
      {label ?? state}
    </span>
  );
}

/** Alamat panjang dipersingkat agar tabel tetap terbaca. */
export function Address({ value }) {
  if (!value) return null;
  return (
    <span className="address" title={value}>
      {value.slice(0, 6)}…{value.slice(-4)}
    </span>
  );
}

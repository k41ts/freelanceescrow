import { ROLE_LABEL } from "../lib/contract";

export function RoleBadge({ role }) {
  return <span className={`badge badge-role badge-${role}`}>{ROLE_LABEL[role] ?? "Pengamat"}</span>;
}

export function StateBadge({ state, label }) {
  return <span className={`badge badge-state badge-${state.toLowerCase()}`}>{label ?? state}</span>;
}

/** Alamat panjang dipersingkat agar tabel tetap terbaca. */
export function Address({ value }) {
  if (!value) return null;
  return (
    <code className="address" title={value}>
      {value.slice(0, 6)}…{value.slice(-4)}
    </code>
  );
}

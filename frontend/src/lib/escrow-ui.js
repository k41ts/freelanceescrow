import { formatEther } from "ethers";

/** Nilai ETH tanpa nol berlebih: 0.0100 -> 0.01. */
export function eth(wei) {
  const s = formatEther(wei ?? 0n);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** Satuan menyesuaikan besarannya: 20 detik tidak dibulatkan jadi "0 menit". */
export function formatPeriod(seconds) {
  const s = Number(seconds);
  if (s < 60) return `${s} detik`;
  if (s < 86400) return `${Math.round(s / 60)} menit`;
  return `${Math.round(s / 86400)} hari`;
}

export function formatDateTime(seconds) {
  return new Date(Number(seconds) * 1000).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Mengelompokkan milestone menurut tempat dananya berada:
 * masih di klien, terkunci di contract, atau sudah keluar dari contract.
 */
export function zoneOf(state) {
  if (state === "None") return "unfunded";
  if (state === "Released" || state === "Refunded") return "settled";
  return "locked";
}

export function buildZones(items) {
  const zones = {
    unfunded: { key: "unfunded", label: "Belum didanai", total: 0n, items: [] },
    locked: { key: "locked", label: "Terkunci di kontrak", total: 0n, items: [] },
    settled: { key: "settled", label: "Sudah dibayarkan", total: 0n, items: [] },
  };
  for (const it of items) {
    const z = zones[zoneOf(it.state)];
    z.total += it.amount;
    z.items.push(it);
  }
  return [zones.unfunded, zones.locked, zones.settled];
}

export const STATE_DESC = {
  None: "Belum didanai.",
  Funded: "Dana terkunci. Freelancer sedang mengerjakan.",
  Submitted: "Hasil kerja masuk, menunggu review klien.",
  Released: "Dana sudah cair ke freelancer.",
  Refunded: "Dana dikembalikan ke klien.",
  Disputed: "Sengketa, menunggu putusan arbitrator.",
};

/** Ringkasan keadaan satu proyek untuk kolom "Keadaan" di tabel. */
export function projectStatus(project) {
  const states = (project.milestones ?? []).map((m) => m.state);
  const role = project.role;
  if (states.includes("Disputed"))
    return { text: role === "arbitrator" ? "Sengketa, menunggu putusan Anda" : "Sengketa", tone: "dispute" };
  if (states.includes("Submitted"))
    return { text: role === "client" ? "Menunggu review Anda" : "Menunggu review klien", tone: role === "client" ? "action" : "" };
  if (states.length && states.every((s) => s === "Released" || s === "Refunded")) return { text: "Selesai", tone: "" };
  if (states.includes("Funded"))
    return { text: role === "freelancer" ? "Dana terkunci, kirim hasil kerja" : "Freelancer sedang bekerja", tone: role === "freelancer" ? "action" : "" };
  return { text: role === "client" ? "Perlu didanai" : "Belum didanai", tone: role === "client" ? "action" : "" };
}

/** Hal yang menunggu tindakan wallet ini, diurutkan dari yang paling mendesak. */
export function pendingActions(projects) {
  const out = [];
  for (const p of projects) {
    const title = p.title || `Proyek #${p.projectId}`;
    (p.milestones ?? []).forEach((m, i) => {
      const n = i + 1;
      const amt = eth(m.amount);
      if (p.role === "arbitrator" && m.state === "Disputed")
        out.push({ p, state: m.state, rank: 0, title: `Putuskan sengketa milestone ${n}, ${title}`, desc: `Dana ${amt} ETH dibekukan sampai Anda memutuskan.`, cta: "Putuskan" });
      if (p.role === "client" && m.state === "Submitted")
        out.push({ p, state: m.state, rank: 1, title: `Review hasil kerja milestone ${n}, ${title}`, desc: `Dana ${amt} ETH cair otomatis ke freelancer bila tidak direspons sebelum batas review.`, cta: "Review hasil kerja" });
      if (p.role === "freelancer" && m.state === "Funded")
        out.push({ p, state: m.state, rank: 2, title: `Kirim hasil kerja milestone ${n}, ${title}`, desc: `Dana ${amt} ETH sudah terkunci untuk Anda.`, cta: "Kirim hasil" });
      if (p.role === "client" && m.state === "None")
        out.push({ p, state: m.state, rank: 3, title: `Kunci dana milestone ${n}, ${title}`, desc: `Freelancer belum bisa mengirim hasil sebelum dana ${amt} ETH terkunci.`, cta: `Kunci ${amt} ETH` });
    });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

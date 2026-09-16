/**
 * MODE DEMO - simulasi penuh, tanpa wallet dan tanpa blockchain.
 *
 * Dipakai untuk memeragakan alur di komputer yang tidak bisa memasang MetaMask,
 * misalnya PC showcase. Seluruh state hidup di memori: menyegarkan halaman
 * mengembalikan semuanya ke kondisi awal, dan tidak ada satu pun transaksi yang
 * benar-benar dikirim ke jaringan.
 *
 * Aturan main yang ditiru dari FreelanceEscrow.sol dijaga tetap sama, supaya yang
 * diperagakan tidak berbohong soal perilaku contract:
 *  - submitWork hanya boleh saat milestone berstatus Funded
 *  - approve hanya oleh klien, submitWork hanya oleh freelancer,
 *    resolveDispute hanya oleh arbitrator
 *  - autoRelease hanya setelah reviewPeriod lewat, dan boleh dipicu siapa saja
 */

const STATE = ["None", "Funded", "Submitted", "Released", "Refunded", "Disputed"];

export const DEMO_ROLES = ["client", "freelancer", "arbitrator"];

export const DEMO_ACCOUNTS = {
  client: { role: "client", label: "Klien", address: "0xC1i3n70000000000000000000000000000000001" },
  freelancer: { role: "freelancer", label: "Freelancer", address: "0xF9ee1a0000000000000000000000000000000002" },
  arbitrator: { role: "arbitrator", label: "Arbitrator", address: "0xA9b1770000000000000000000000000000000003" },
};

// Sengaja pendek supaya auto-release bisa diperagakan hidup-hidup di panggung.
const DEMO_REVIEW_PERIOD = 20;

let demoOn = false;
let demoRole = "client";
let state = null;
const listeners = new Set();

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function seed() {
  return {
    nextProjectId: 2,
    projects: [
      {
        projectId: 1n,
        title: "Desain Logo Startup",
        client: DEMO_ACCOUNTS.client.address,
        freelancer: DEMO_ACCOUNTS.freelancer.address,
        arbitrator: DEMO_ACCOUNTS.arbitrator.address,
        reviewPeriod: BigInt(DEMO_REVIEW_PERIOD),
        createdAt: BigInt(nowSec()),
        milestones: [
          { amount: 10000000000000000n, state: 0, cid: "", submittedAt: 0n },
          { amount: 20000000000000000n, state: 0, cid: "", submittedAt: 0n },
        ],
      },
    ],
  };
}

function ensure() {
  if (!state) state = seed();
  return state;
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** Komponen berlangganan agar bilah peran ikut menyegarkan tampilan. */
export function subscribeDemo(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isDemoMode() {
  return demoOn;
}

export function getDemoRole() {
  return demoRole;
}

export function getDemoAccount() {
  return DEMO_ACCOUNTS[demoRole];
}

export function setDemoRole(role) {
  if (!DEMO_ROLES.includes(role)) return;
  demoRole = role;
  notify();
}

export function enableDemo() {
  demoOn = true;
  ensure();
  notify();
}

export function disableDemo() {
  demoOn = false;
  notify();
}

export function resetDemo() {
  state = seed();
  demoRole = "client";
  notify();
}

/** Jeda kecil supaya tombol sempat menampilkan status memproses, seperti transaksi sungguhan. */
function tx(fn) {
  return {
    wait: async () => {
      await new Promise((r) => setTimeout(r, 450));
      fn();
      notify();
    },
  };
}

function findProject(projectId) {
  const id = BigInt(projectId);
  const p = ensure().projects.find((x) => x.projectId === id);
  if (!p) throw new Error("Proyek tidak ditemukan.");
  return p;
}

function findMilestone(projectId, index) {
  const p = findProject(projectId);
  const m = p.milestones[Number(index)];
  if (!m) throw new Error("Milestone tidak ditemukan.");
  return { p, m };
}

function requireRole(role, message) {
  if (demoRole !== role) throw new Error(message);
}

/** Objek ini meniru permukaan ethers Contract yang dipakai komponen. */
export function getDemoContract() {
  return {
    createProject: async (freelancer, arbitrator, reviewPeriod, amounts, title) => {
      requireRole("client", "Hanya klien yang boleh membuat kontrak.");
      const s = ensure();
      const id = BigInt(s.nextProjectId++);
      s.projects.push({
        projectId: id,
        title,
        client: DEMO_ACCOUNTS.client.address,
        freelancer: freelancer || DEMO_ACCOUNTS.freelancer.address,
        arbitrator: arbitrator || DEMO_ACCOUNTS.arbitrator.address,
        reviewPeriod: BigInt(reviewPeriod),
        createdAt: BigInt(nowSec()),
        milestones: amounts.map((a) => ({ amount: BigInt(a), state: 0, cid: "", submittedAt: 0n })),
      });
      return tx(() => {});
    },

    deposit: async (projectId, index) => {
      requireRole("client", "Hanya klien yang boleh menyetor dana.");
      const { m } = findMilestone(projectId, index);
      if (m.state !== 0) throw new Error("Milestone ini sudah didanai.");
      return tx(() => {
        m.state = 1;
      });
    },

    submitWork: async (projectId, index, cid) => {
      requireRole("freelancer", "Hanya freelancer yang boleh mengirim hasil kerja.");
      const { m } = findMilestone(projectId, index);
      // Invariant utama contract: dana harus terkunci lebih dulu.
      if (m.state !== 1) throw new Error("Dana belum terkunci, hasil kerja belum bisa dikirim.");
      return tx(() => {
        m.cid = cid;
        m.submittedAt = BigInt(nowSec());
        m.state = 2;
      });
    },

    approve: async (projectId, index) => {
      requireRole("client", "Hanya klien yang boleh menyetujui.");
      const { m } = findMilestone(projectId, index);
      if (m.state !== 2) throw new Error("Milestone ini belum menunggu persetujuan.");
      return tx(() => {
        m.state = 3;
      });
    },

    autoRelease: async (projectId, index) => {
      const { p, m } = findMilestone(projectId, index);
      if (m.state !== 2) throw new Error("Milestone ini tidak sedang menunggu review.");
      const relAt = Number(m.submittedAt) + Number(p.reviewPeriod);
      if (nowSec() < relAt) throw new Error("Batas waktu review belum lewat.");
      return tx(() => {
        m.state = 3;
      });
    },

    raiseDispute: async (projectId, index) => {
      if (demoRole === "arbitrator") throw new Error("Arbitrator tidak boleh mengangkat sengketa.");
      const { m } = findMilestone(projectId, index);
      if (m.state !== 1 && m.state !== 2) throw new Error("Milestone ini tidak bisa disengketakan.");
      return tx(() => {
        m.state = 5;
      });
    },

    resolveDispute: async (projectId, index, releaseToFreelancer) => {
      requireRole("arbitrator", "Hanya arbitrator yang boleh memutuskan sengketa.");
      const { m } = findMilestone(projectId, index);
      if (m.state !== 5) throw new Error("Milestone ini tidak sedang disengketakan.");
      return tx(() => {
        m.state = releaseToFreelancer ? 3 : 4;
      });
    },
  };
}

function roleOfDemo(project, account) {
  const a = (account ?? "").toLowerCase();
  if (project.client.toLowerCase() === a) return "client";
  if (project.freelancer.toLowerCase() === a) return "freelancer";
  if (project.arbitrator.toLowerCase() === a) return "arbitrator";
  return "none";
}

export function demoFetchProjects(account) {
  return ensure()
    .projects.map((p) => ({
      projectId: p.projectId,
      title: p.title,
      client: p.client,
      freelancer: p.freelancer,
      arbitrator: p.arbitrator,
      reviewPeriod: p.reviewPeriod,
      createdAt: p.createdAt,
      totalAmount: p.milestones.reduce((s, m) => s + m.amount, 0n),
      milestoneCount: BigInt(p.milestones.length),
      role: roleOfDemo(p, account),
    }))
    .reverse();
}

export function demoFetchProjectDetail(projectId) {
  const p = findProject(projectId);
  return {
    projectId: p.projectId,
    title: p.title,
    client: p.client,
    freelancer: p.freelancer,
    arbitrator: p.arbitrator,
    reviewPeriod: p.reviewPeriod,
    createdAt: p.createdAt,
    milestones: p.milestones.map((m, index) => ({
      index,
      amount: m.amount,
      state: STATE[m.state],
      stateValue: m.state,
      cid: m.cid,
      submittedAt: m.submittedAt,
      releasableAt: m.submittedAt > 0n ? m.submittedAt + p.reviewPeriod : 0n,
    })),
  };
}

/**
 * Upload palsu. Mengembalikan CID yang formatnya menyerupai CIDv1 asli supaya
 * tampilan tetap meyakinkan, tetapi tidak ada berkas yang benar-benar diunggah.
 */
export async function demoUpload(file) {
  await new Promise((r) => setTimeout(r, 600));
  const seedStr = (file?.name ?? "demo") + Date.now();
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  const abc = "abcdefghijklmnopqrstuvwxyz234567";
  let out = "";
  let x = h;
  for (let i = 0; i < 52; i++) {
    out += abc[x % 32];
    x = (x * 1103515245 + 12345) >>> 0;
  }
  return "bafkrei" + out;
}

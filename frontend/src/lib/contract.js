import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import abi from "./FreelanceEscrow.abi.json";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";
export const SEPOLIA_CHAIN_ID = 11155111n;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export const ABI = abi;

/** Urutan harus sama persis dengan enum MilestoneState di FreelanceEscrow.sol */
export const MILESTONE_STATE = ["None", "Funded", "Submitted", "Released", "Refunded", "Disputed"];

export const STATE_LABEL = {
  None: "Belum didanai",
  Funded: "Dana terkunci",
  Submitted: "Menunggu review",
  Released: "Dana cair",
  Refunded: "Dana dikembalikan",
  Disputed: "Sengketa",
};

export function stateName(stateValue) {
  return MILESTONE_STATE[Number(stateValue)] ?? "Unknown";
}

export function getProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask tidak terdeteksi. Pasang ekstensi MetaMask terlebih dahulu.");
  }
  return new BrowserProvider(window.ethereum);
}

/** Contract read-only, tidak butuh tanda tangan pengguna. */
export async function getReadContract() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("VITE_CONTRACT_ADDRESS belum diisi di frontend/.env");
  }
  const provider = getProvider();
  return new Contract(CONTRACT_ADDRESS, ABI, provider);
}

/** Contract untuk transaksi; memicu MetaMask saat dipanggil. */
export async function getWriteContract() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("VITE_CONTRACT_ADDRESS belum diisi di frontend/.env");
  }
  const provider = getProvider();
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

/**
 * Menentukan peran wallet yang sedang terhubung pada sebuah proyek.
 * Dipakai untuk menampilkan hanya tombol aksi yang relevan (slide 10).
 */
export function roleOf(project, account) {
  if (!project || !account) return "none";
  const a = account.toLowerCase();
  if (project.client.toLowerCase() === a) return "client";
  if (project.freelancer.toLowerCase() === a) return "freelancer";
  if (project.arbitrator.toLowerCase() === a) return "arbitrator";
  return "none";
}

export const ROLE_LABEL = {
  client: "Klien",
  freelancer: "Freelancer",
  arbitrator: "Arbitrator",
  none: "Pengamat",
};

/**
 * Mengumpulkan daftar proyek dari event ProjectCreated.
 * Pendekatan ini dipilih agar tidak perlu indexer terpisah untuk prototype.
 */
export async function fetchProjects(account) {
  const contract = await getReadContract();
  const events = await contract.queryFilter(contract.filters.ProjectCreated());

  const projects = [];
  for (const ev of events) {
    const projectId = ev.args.projectId;
    const project = await contract.getProject(projectId);
    const role = roleOf(project, account);
    projects.push({
      projectId,
      title: project.title,
      client: project.client,
      freelancer: project.freelancer,
      arbitrator: project.arbitrator,
      reviewPeriod: project.reviewPeriod,
      createdAt: project.createdAt,
      totalAmount: ev.args.totalAmount,
      milestoneCount: ev.args.milestoneCount,
      role,
    });
  }
  return projects.reverse(); // terbaru di atas
}

export async function fetchProjectDetail(projectId) {
  const contract = await getReadContract();
  const [project, milestones] = await Promise.all([
    contract.getProject(projectId),
    contract.getMilestones(projectId),
  ]);

  return {
    projectId,
    title: project.title,
    client: project.client,
    freelancer: project.freelancer,
    arbitrator: project.arbitrator,
    reviewPeriod: project.reviewPeriod,
    createdAt: project.createdAt,
    milestones: milestones.map((m, index) => ({
      index,
      amount: m.amount,
      state: stateName(m.state),
      stateValue: Number(m.state),
      cid: m.cid,
      submittedAt: m.submittedAt,
      releasableAt: m.submittedAt > 0n ? m.submittedAt + project.reviewPeriod : 0n,
    })),
  };
}

/** Menerjemahkan error MetaMask / contract menjadi pesan yang bisa dibaca pengguna. */
export function humanizeError(err) {
  if (!err) return "Terjadi kesalahan tidak dikenal.";

  if (err.code === "ACTION_REJECTED" || err.code === 4001) {
    return "Transaksi dibatalkan di MetaMask.";
  }

  const name = err.revert?.name ?? err.errorName;
  const map = {
    NotClient: "Hanya klien yang boleh melakukan aksi ini.",
    NotFreelancer: "Hanya freelancer yang boleh melakukan aksi ini.",
    NotArbitrator: "Hanya arbitrator yang boleh memutuskan sengketa.",
    NotParticipant: "Hanya klien atau freelancer proyek ini yang boleh mengangkat sengketa.",
    InvalidState: "Status milestone tidak memungkinkan aksi ini. Muat ulang halaman.",
    IncorrectAmount: "Nominal yang dikirim harus sama persis dengan nilai milestone.",
    ReviewPeriodNotOver: "Batas waktu review belum lewat, dana belum bisa dicairkan otomatis.",
    InvalidAddress: "Alamat wallet tidak valid. Klien, freelancer, dan arbitrator harus berbeda.",
    NoMilestones: "Proyek harus punya minimal satu milestone.",
    ZeroAmount: "Nilai milestone dan batas waktu tidak boleh nol.",
    TransferFailed: "Pengiriman dana gagal.",
    ProjectNotFound: "Proyek tidak ditemukan.",
    MilestoneNotFound: "Milestone tidak ditemukan.",
  };
  if (name && map[name]) return map[name];

  if (err.message?.includes("insufficient funds")) {
    return "Saldo Sepolia ETH tidak cukup. Isi lewat faucet terlebih dahulu.";
  }
  return err.shortMessage ?? err.message ?? String(err);
}

export { formatEther, parseEther };

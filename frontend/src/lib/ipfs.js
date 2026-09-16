/**
 * Upload bukti hasil kerja ke IPFS lewat Pinata.
 *
 * CATATAN KEAMANAN (disebut juga di slide 15 "yang belum kami selesaikan"):
 * VITE_PINATA_JWT ikut ter-bundle ke dalam JavaScript front-end dan bisa dibaca
 * siapa pun yang membuka DevTools. Untuk prototype akademik ini masih bisa
 * diterima, dengan syarat memakai Pinata scoped key yang izinnya HANYA upload.
 * Solusi produksinya adalah memindahkan upload ke back-end sebagai proxy,
 * sehingga JWT tidak pernah sampai ke browser.
 */

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT ?? "";
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
const PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export function isPinataConfigured() {
  return PINATA_JWT.length > 0;
}

/** URL gateway agar CID bisa dibuka langsung dari UI. */
export function gatewayUrl(cid) {
  if (!cid) return "";
  return `${PINATA_GATEWAY.replace(/\/$/, "")}/ipfs/${cid}`;
}

/**
 * Mengunggah satu file ke IPFS.
 * @returns {Promise<string>} CID file. Hanya CID inilah yang disimpan on-chain,
 *   supaya biaya gas tetap murah (slide 8).
 */
export async function uploadToIpfs(file) {
  if (!isPinataConfigured()) {
    throw new Error("VITE_PINATA_JWT belum diisi di frontend/.env");
  }

  const form = new FormData();
  form.append("file", file);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: file.name, keyvalues: { app: "freelance-escrow" } })
  );

  const res = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Upload ke Pinata gagal (${res.status}). ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.IpfsHash) {
    throw new Error("Pinata tidak mengembalikan CID.");
  }
  return data.IpfsHash;
}

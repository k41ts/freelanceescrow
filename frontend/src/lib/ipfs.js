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

import { demoUpload, isDemoMode } from "./demo";

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT ?? "";
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";

// API v3. Endpoint lama api.pinata.cloud/pinning/pinFileToIPFS sudah tidak
// muncul lagi di dokumentasi Pinata, dan bentuk responsnya pun berbeda:
// v3 mengembalikan CID di data.cid, bukan IpfsHash.
const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

export function isPinataConfigured() {
  // Di mode demo tidak ada upload sungguhan, jadi peringatan konfigurasi
  // tidak perlu muncul dan alurnya tetap bisa diperagakan.
  if (isDemoMode()) return true;
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
  if (isDemoMode()) return demoUpload(file);

  if (!PINATA_JWT) {
    throw new Error("VITE_PINATA_JWT belum diisi di frontend/.env");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("name", file.name);
  // WAJIB diisi "public". Default Pinata adalah "private", dan file private
  // tidak bisa dibuka lewat gateway publik - upload akan terlihat sukses
  // tetapi tautan CID-nya mati.
  form.append("network", "public");

  const res = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Pinata menolak JWT (${res.status}). Pastikan key punya izin org:files:write dan belum kedaluwarsa.`
      );
    }
    throw new Error(`Upload ke Pinata gagal (${res.status}). ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const cid = json?.data?.cid;
  if (!cid) {
    throw new Error("Pinata tidak mengembalikan CID.");
  }
  return cid;
}

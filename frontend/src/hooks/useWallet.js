import { useCallback, useEffect, useState } from "react";
import { SEPOLIA_CHAIN_ID_HEX } from "../lib/contract";

/**
 * Mengelola koneksi MetaMask dan memastikan pengguna berada di Sepolia.
 * Salah jaringan adalah penyebab bug demo paling umum, jadi kondisi itu
 * dideteksi eksplisit dan disediakan tombol pindah jaringan.
 */
export function useWallet() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);
  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID_HEX;

  const refresh = useCallback(async () => {
    if (!hasMetaMask) return;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const currentChain = await window.ethereum.request({ method: "eth_chainId" });
      setAccount(accounts?.[0] ?? null);
      setChainId(currentChain);
    } catch (err) {
      setError(err.message);
    }
  }, [hasMetaMask]);

  useEffect(() => {
    refresh();
    if (!hasMetaMask) return;

    const onAccounts = (accounts) => setAccount(accounts?.[0] ?? null);
    // Ganti jaringan cukup ditangani dengan memuat ulang state, bukan reload paksa.
    const onChain = (id) => setChainId(id);

    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [hasMetaMask, refresh]);

  const connect = useCallback(async () => {
    if (!hasMetaMask) {
      setError("MetaMask tidak terdeteksi. Pasang ekstensi MetaMask terlebih dahulu.");
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts?.[0] ?? null);
      await refresh();
    } catch (err) {
      setError(err.code === 4001 ? "Koneksi wallet dibatalkan." : err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [hasMetaMask, refresh]);

  const switchToSepolia = useCallback(async () => {
    setError(null);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (err) {
      // 4902 = jaringan belum terdaftar di MetaMask, jadi tawarkan untuk menambahkan.
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: "Sepolia Test Network",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addErr) {
          setError(addErr.message);
        }
      } else {
        setError(err.message);
      }
    }
  }, []);

  return {
    account,
    chainId,
    error,
    isConnecting,
    hasMetaMask,
    isCorrectNetwork,
    connect,
    switchToSepolia,
  };
}

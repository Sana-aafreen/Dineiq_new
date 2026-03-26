import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, LOCAL_API_BASE_URL, ONLINE_APP_URL_STORAGE_KEY } from "@/config";
import { setNetworkMode } from "@/config";
import { Html5Qrcode } from "html5-qrcode";
import splashBg from "@/assets/restaurant-splash.jpg";
import heroVideo from "@/assets/hero-video.mp4";

// -- Design tokens --------------------------------------------------------------
const Z = {
  red:      "#E23744",
  redLight: "#FFF0F1",
  bg:       "#FFFFFF",
  surface:  "#F8F8F8",
  border:   "#E8E8E8",
  text:     "#1C1C1C",
  sub:      "#686B78",
  muted:    "#93959F",
  green:    "#3D9B6E",
};

const LOCAL_WIFI_ID = import.meta.env.VITE_LOCAL_WIFI_SSID || "DineIQ-Local";
const LOCAL_WIFI_PASSWORD = import.meta.env.VITE_LOCAL_WIFI_PASSWORD || "dineiq123";

// -- Extract table number from any QR payload -----------------------------------
// Confirmed QR format: "http://localhost:8000/?table=1"
// Also handles: plain "4", "table=4", path "/table/4", etc.
function extractTable(raw: string): number | null {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  try {
    const url = new URL(s);
    const t = url.searchParams.get("table");
    if (t && /^\d+$/.test(t)) return parseInt(t, 10);
  } catch (_) {}
  const m = s.match(/\btable[=\s:/]*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

// -- Countdown hook -------------------------------------------------------------
function useCountdown() {
  const [count, setCount] = useState(0);
  const start = (n: number) => {
    setCount(n);
    const id = setInterval(() => {
      setCount(c => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; });
    }, 1000);
  };
  return [count, start] as const;
}

// ------------------------------------------------------------------------------
// -- SCAN FRAME CORNERS ---------------------------------------------------------
// ------------------------------------------------------------------------------
function ScanFrame({ success }: { success: boolean }) {
  const color = success ? Z.green : Z.red;
  const corner = (side: "Top" | "Bottom", cross: "Left" | "Right"): React.CSSProperties => ({
    position: "absolute",
    width: 26, height: 26,
    transition: "border-color 0.35s",
    [`border${side}`]: `3px solid ${color}`,
    [`border${cross}`]: `3px solid ${color}`,
    [`border${side === "Top" ? "bottom" : "top"}`]: "none",
    [`border${cross === "Left" ? "right" : "left"}`]: "none",
    borderRadius:
      side === "Top"
        ? cross === "Left" ? "4px 0 0 0" : "0 4px 0 0"
        : cross === "Left" ? "0 0 0 4px" : "0 0 4px 0",
    [side === "Top" ? "top" : "bottom"]: 0,
    [cross === "Left" ? "left" : "right"]: 0,
  });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={corner("Top",    "Left")}  />
      <div style={corner("Top",    "Right")} />
      <div style={corner("Bottom", "Left")}  />
      <div style={corner("Bottom", "Right")} />
      {!success && (
        <motion.div
          animate={{ y: ["0%", "100%", "0%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", left: 4, right: 4, top: 4, height: 2,
            background: `linear-gradient(90deg, transparent, ${Z.red}, transparent)`,
            borderRadius: 2, opacity: 0.8,
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------
// -- QR STEP -------------------------------------------------------------------
// Camera is NOT auto-started — user taps the button first (fixes slow load).
// ------------------------------------------------------------------------------
function QRStep({ onTableConfirmed }: { onTableConfirmed: (n: number) => void }) {
  const [scanStatus, setScanStatus] = useState<"idle" | "ready" | "scanning" | "success" | "error">("idle");
  const [tableFound, setTableFound] = useState<number | null>(null);
  const [errorMsg,   setErrorMsg]   = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualVal,  setManualVal]  = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Cleanup only — no auto-start
  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, []);

  const startCamera = () => {
    setScanStatus("ready");
    const scanner = new Html5Qrcode("qr-region");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => handleScan(decoded),
        () => {}
      )
      .then(() => setScanStatus("scanning"))
      .catch((err: any) => {
        setScanStatus("error");
        setErrorMsg(
          err?.message?.includes("ermission")
            ? "Camera permission denied."
            : "Camera unavailable."
        );
        setShowManual(true);
      });
  };

  const handleScan = async (raw: string) => {
    if (tableFound) return;
    const n = extractTable(raw);
    if (!n) {
      setScanStatus("error");
      setErrorMsg("No table number found in QR code.");
      return;
    }
    await scannerRef.current?.stop().catch(() => {});
    setTableFound(n);
    setScanStatus("success");
    setTimeout(() => onTableConfirmed(n), 1400);
  };

  const handleManual = () => {
    const n = parseInt(manualVal.trim(), 10);
    if (!n || n < 1 || n > 999) { setErrorMsg("Enter a valid table number (1–999)."); return; }
    setTableFound(n);
    setScanStatus("success");
    setTimeout(() => onTableConfirmed(n), 1400);
  };

  return (
    <motion.div
      className="login-qr-step"
      key="qr-step"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
    >
      <div style={{ textAlign: "center" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: Z.text }}>
          Scan Your Table
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: Z.sub }}>
          Point at the QR code on your table
        </p>
      </div>

      {/* -- Camera viewport -- */}
      <div className="login-qr-viewport" style={{
        position: "relative", width: 260, height: 260,
        borderRadius: 20, overflow: "hidden", background: "#111",
        boxShadow: scanStatus === "success"
          ? `0 0 0 3px ${Z.green}, 0 8px 32px rgba(61,155,110,0.25)`
          : "0 8px 32px rgba(0,0,0,0.2)",
        transition: "box-shadow 0.4s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Html5Qrcode mounts its <video> here */}
        <div id="qr-region" style={{ width: "100%", height: "100%" }} />

        {/* Idle: tap to start */}
        {scanStatus === "idle" && (
          <button
            onClick={startCamera}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.62)",
              border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
            }}
          >
            <motion.div
              whileTap={{ scale: 0.93 }}
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: Z.red,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 24px rgba(226,55,68,0.5)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </motion.div>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
              Tap to start camera
            </span>
          </button>
        )}

        {/* Initialising spinner */}
        {scanStatus === "ready" && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={Z.red}
              strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: "spin 0.8s linear infinite" }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
        )}

        <ScanFrame success={scanStatus === "success"} />

        {/* Success overlay */}
        <AnimatePresence>
          {scanStatus === "success" && tableFound && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                position: "absolute", inset: 0, background: "rgba(61,155,110,0.88)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }}
                transition={{ duration: 0.45 }}
                style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#fff", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke={Z.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </motion.div>
              <p style={{ margin: 0, color: "#fff", fontWeight: 900, fontSize: 15 }}>
                Table {tableFound}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {scanStatus === "error" && errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 12,
              background: Z.redLight, border: `1px solid #f8c4c7`,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "#b91c27", textAlign: "center" }}>
              {errorMsg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual entry */}
      {!showManual ? (
        <button onClick={() => setShowManual(true)} style={{
          background: "none", border: "none", cursor: "pointer",
          color: Z.red, fontSize: 13, fontWeight: 700,
          fontFamily: "inherit", padding: "2px 0",
        }}>
          Enter table number manually →
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          style={{ width: "100%" }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600,
                      color: Z.sub, textAlign: "center" }}>
            Enter table number
          </p>
          <div className="login-manual-row" style={{ display: "flex", gap: 10 }}>
            <input
              className="login-manual-input"
              type="number" min={1} max={999}
              value={manualVal}
              onChange={e => { setManualVal(e.target.value); setErrorMsg(""); }}
              onKeyDown={e => e.key === "Enter" && handleManual()}
              placeholder="e.g. 4"
              autoFocus
              style={{
                flex: 1, height: 50, borderRadius: 12,
                border: `1.5px solid ${Z.border}`, background: Z.surface,
                outline: "none", fontSize: 20, fontWeight: 800,
                textAlign: "center", color: Z.text, fontFamily: "inherit",
              }}
            />
            <button
              className="login-manual-button"
              onClick={handleManual}
              disabled={!manualVal.trim()}
              style={{
                height: 50, padding: "0 20px", borderRadius: 12, border: "none",
                background: manualVal.trim() ? Z.red : "#f5b8bc",
                color: "#fff", fontSize: 14, fontWeight: 800,
                cursor: manualVal.trim() ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                boxShadow: manualVal.trim() ? "0 4px 14px rgba(226,55,68,0.28)" : "none",
                transition: "all 0.2s",
              }}
            >
              Go →
            </button>
          </div>
          {errorMsg && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c27", textAlign: "center" }}>
              {errorMsg}
            </p>
          )}
        </motion.div>
      )}

      <div style={{
        display: "flex", alignItems: "flex-start", gap: 8, width: "100%",
        padding: "10px 12px", borderRadius: 10, background: Z.surface,
      }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>📋</span>
        <span style={{ fontSize: 12, color: Z.sub, lineHeight: 1.6 }}>
          Each table has a unique QR on the menu stand. Scan it to identify
          your seat and start ordering.
        </span>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------------------
// -- SHARED SUB-COMPONENTS -----------------------------------------------------
// ------------------------------------------------------------------------------

function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display:"flex", background:Z.surface, borderRadius:14, padding:5, marginBottom:24, border:`1px solid ${Z.border}` }}>
      {["login","register"].map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          flex:1, padding:"11px 0", borderRadius:10, border:"none", cursor:"pointer",
          fontSize:14, fontWeight:700, fontFamily:"inherit", transition:"all 0.2s",
          background: active===tab ? Z.bg : "transparent",
          color:      active===tab ? Z.text : Z.muted,
          boxShadow:  active===tab ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        }}>
          {tab === "login" ? "Log in" : "Sign up"}
        </button>
      ))}
    </div>
  );
}

function MethodToggle({ active, onChange }: { active: string; onChange: (m: string) => void }) {
  return (
    <div style={{ display:"flex", gap:20, borderBottom:`1.5px solid ${Z.border}`, marginBottom:20 }}>
      {["phone","email"].map(m => (
        <button key={m} onClick={() => onChange(m)} style={{
          background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
          fontSize:14, fontWeight:700, padding:"0 2px 10px", marginBottom:-1.5,
          color:       active===m ? Z.red : Z.muted,
          borderBottom:`2.5px solid ${active===m ? Z.red : "transparent"}`,
          transition:"all 0.18s",
        }}>
          {m.charAt(0).toUpperCase()+m.slice(1)}
        </button>
      ))}
    </div>
  );
}

function SInput({ label, icon, prefix, suffix, ...props }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && (
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:Z.sub,
                        marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>
          {label}
        </label>
      )}
      <div
        style={{
          display:"flex", alignItems:"center", height:52, borderRadius:12, overflow:"hidden",
          border:`1.5px solid ${focused ? Z.red : Z.border}`,
          background: focused ? Z.bg : Z.surface,
          boxShadow: focused ? `0 0 0 3px rgba(226,55,68,0.08)` : "none",
          transition:"all 0.2s",
        }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      >
        {prefix && (
          <div style={{ padding:"0 12px 0 14px", borderRight:`1.5px solid ${Z.border}`,
                        height:"100%", display:"flex", alignItems:"center", flexShrink:0 }}>
            {prefix}
          </div>
        )}
        {icon && (
          <div style={{ paddingLeft:14, paddingRight:6, color:Z.muted, display:"flex",
                        alignItems:"center", flexShrink:0 }}>
            {icon}
          </div>
        )}
        <input
          {...props}
          style={{
            flex:1, border:"none", outline:"none", background:"transparent",
            padding:"0 14px", fontSize:15, color:Z.text,
            fontFamily:"inherit", height:"100%", width:0,
          }}
        />
        {suffix && (
          <div style={{ paddingRight:12, display:"flex", alignItems:"center", flexShrink:0 }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

function GreenTick() {
  return (
    <motion.div initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}
      style={{ width:22, height:22, borderRadius:"50%", background:Z.green,
               display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:11, color:"#fff", fontWeight:900 }}>✓</span>
    </motion.div>
  );
}

function RedButton({ children, onClick, disabled, loading }: any) {
  return (
    <motion.button
      whileTap={{ scale: disabled||loading ? 1 : 0.98 }}
      onClick={disabled||loading ? undefined : onClick}
      style={{
        width:"100%", height:52, borderRadius:12, border:"none",
        cursor: disabled||loading ? "not-allowed" : "pointer",
        background: disabled ? "#f5b8bc" : Z.red,
        color:"#fff", fontSize:15, fontWeight:800, fontFamily:"inherit",
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        boxShadow: !disabled ? "0 6px 20px rgba(226,55,68,0.3)" : "none",
        transition:"all 0.2s",
      }}
    >
      {loading ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="2.5" strokeLinecap="round"
          style={{ animation:"spin 0.8s linear infinite" }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      ) : children}
    </motion.button>
  );
}

function GhostButton({ children, onClick }: any) {
  const [hov, setHov] = useState(false);
  return (
    <motion.button
      whileTap={{ scale:0.98 }} onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:"100%", height:50, borderRadius:12, cursor:"pointer", fontFamily:"inherit",
        border:`1.5px solid ${Z.border}`, background: hov ? Z.surface : Z.bg,
        fontSize:14, fontWeight:600, color: hov ? Z.text : Z.sub,
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        transition:"all 0.18s",
      }}
    >
      {children}
    </motion.button>
  );
}

function OtpStep({
  email, title, subtitle, editLabel, onEdit, onVerify, isLoading,
}: {
  email: string; title: string; subtitle: string; editLabel: string;
  onEdit: () => void; onVerify: (otp: string) => void; isLoading: boolean;
}) {
  const [digits, setDigits] = useState(["","","","","",""]);
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const [resend, startResend] = useCountdown();
  useEffect(() => { startResend(30); }, []);

  const filled = digits.join("");

  const handleChange = (i: number, val: string) => {
    const v = val.replace(/\D/g,"").slice(-1);
    const next = [...digits]; next[i] = v; setDigits(next);
    if (v && i < 5) setTimeout(() => refs[i+1]?.current?.focus(), 0);
  };
  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0)
      setTimeout(() => refs[i-1]?.current?.focus(), 0);
  };

  return (
    <motion.div key="otp" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
      exit={{ opacity:0, x:-20 }} transition={{ duration:0.28 }}>
      <button onClick={onEdit} style={{
        display:"flex", alignItems:"center", gap:6, background:"none", border:"none",
        cursor:"pointer", color:Z.text, fontSize:14, fontWeight:700,
        fontFamily:"inherit", padding:"0 0 16px", marginTop:4,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        {editLabel}
      </button>

      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:Z.text }}>{title}</h2>
      <p style={{ margin:"0 0 6px", fontSize:14, color:Z.sub }}>{subtitle}</p>
      <p style={{ margin:"0 0 24px", fontSize:13, color:Z.muted }}>
        Sent to <strong style={{ color:Z.text }}>{email}</strong>
      </p>

      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {[0,1,2,3,4,5].map(i => {
          const [focused, setFocused] = useState(false);
          return (
            <input key={i} ref={refs[i]}
              type="text" inputMode="numeric" maxLength={1}
              value={digits[i]} autoFocus={i===0}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              style={{
                width:"calc(25% - 6px)", maxWidth:56, height:60, borderRadius:12,
                textAlign:"center", fontSize:24, fontWeight:800, outline:"none",
                border:`2px solid ${digits[i] ? Z.red : focused ? Z.red : Z.border}`,
                background: digits[i] ? Z.redLight : Z.surface,
                color:Z.text, transition:"all 0.15s", fontFamily:"inherit",
                boxShadow: digits[i] ? `0 2px 10px rgba(226,55,68,0.18)` : "none",
              }}
            />
          );
        })}
      </div>

      <div style={{ marginBottom:22 }}>
        {resend > 0
          ? <p style={{ margin:0, fontSize:13, color:Z.muted }}>
              Resend OTP in <strong style={{ color:Z.text }}>{resend}s</strong>
            </p>
          : <button onClick={() => startResend(30)} style={{
              background:"none", border:"none", cursor:"pointer",
              color:Z.red, fontSize:13, fontWeight:700, fontFamily:"inherit", padding:0,
            }}>Resend OTP</button>
        }
      </div>

      <RedButton onClick={() => onVerify(filled)} disabled={filled.length < 6} loading={isLoading}>
        Verify & Continue →
      </RedButton>

      <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginTop:16,
                    padding:"12px 14px", borderRadius:10, background:Z.surface }}>
        <span style={{ fontSize:16, flexShrink:0 }}>🔒</span>
        <span style={{ fontSize:12, color:Z.sub, lineHeight:1.55 }}>
          Your details are safe. We never share them with anyone.
        </span>
      </div>
    </motion.div>
  );
}

function Divider({ text }: { text: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0 14px" }}>
      <div style={{ flex:1, height:1, background:Z.border }} />
      <span style={{ fontSize:12, color:Z.muted }}>{text}</span>
      <div style={{ flex:1, height:1, background:Z.border }} />
    </div>
  );
}

// ------------------------------------------------------------------------------
// -- TERMS & CONDITIONS MODAL ---------------------------------------------------
// ------------------------------------------------------------------------------
const TERMS_CONTENT = `Last updated: March 2026

1. Acceptance of Terms
By creating an account or using Harvest DineIQ, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our services.

2. Account Registration
You must provide accurate information (name, email, phone number) during sign-up. You are responsible for maintaining the confidentiality of your account credentials. One account per person \u2014 duplicate accounts may be merged or removed.

3. Ordering & Payment
Prices displayed are in KSh (Kenyan Shillings) and may vary due to dynamic pricing. Orders placed through DineIQ are confirmed once submitted and cannot be modified after preparation begins. Payment is handled in-restaurant; DineIQ facilitates ordering only.

4. Dietary Preferences
Dietary preference information you provide (e.g. vegetarian, allergies) is used solely to personalise your menu experience and AI recommendations. We do our best to accommodate preferences, but cross-contamination cannot be guaranteed. Always inform your server of severe allergies.

5. AI-Powered Recommendations
DineIQ uses artificial intelligence to suggest menu items and combos based on your preferences and order history. Recommendations are suggestions only \u2014 final ordering decisions are yours.

6. User Conduct
You agree not to misuse the platform, submit false information, or attempt to disrupt our services.

7. Service Availability
DineIQ services are available during restaurant operating hours. We reserve the right to modify or discontinue features without prior notice.

8. Limitation of Liability
Harvest DineIQ is provided \u201cas is.\u201d We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.

9. Changes to Terms
We may update these terms from time to time. Continued use after changes constitutes acceptance of the revised terms.

10. Contact
For questions about these terms, contact us at: support@harvestkenya.com`;

const PRIVACY_CONTENT = `Last updated: March 2026

1. Information We Collect
When you create an account, we collect:
\u2022 Full name
\u2022 Email address
\u2022 Phone number
\u2022 Date of birth (optional)
\u2022 Dietary preferences and allergies
\u2022 Order history and interactions

2. How We Use Your Data
Your information is used to:
\u2022 Create and manage your account
\u2022 Personalise menu recommendations and AI combos
\u2022 Process and track your orders
\u2022 Send OTP codes for authentication
\u2022 Improve our service through analytics

3. Data Storage & Security
Your data is stored securely using Google Cloud infrastructure. We use industry-standard encryption for data in transit (HTTPS/TLS). Access to customer data is restricted to authorised personnel only. OTP codes are hashed and expire after a short period.

4. Data Sharing
We do NOT sell your personal data to third parties. Your data is shared only with:
\u2022 Restaurant staff (name and order details for order fulfilment)
\u2022 Email service providers (for OTP delivery only)

5. Marketing Communications
We may send promotional offers or campaigns based on your preferences. You can opt out of marketing communications at any time by contacting us. Transactional messages (OTPs, order confirmations) cannot be opted out of.

6. Data Retention
Your account data is retained as long as your account is active. You may request deletion of your account and associated data at any time.

7. Cookies & Analytics
DineIQ may use local storage to remember your session and preferences. No third-party tracking cookies are used.

8. Your Rights
You have the right to:
\u2022 Access your personal data
\u2022 Request correction of inaccurate data
\u2022 Request deletion of your data
\u2022 Withdraw consent for data processing

9. Children's Privacy
DineIQ is not intended for children under 13. We do not knowingly collect data from minors.

10. Contact Us
For privacy-related inquiries or data requests:
Email: privacy@harvestkenya.com
Address: Harvest Kenya, Nairobi, Kenya`;

function TermsModal({
  open, initialTab, onClose,
}: {
  open: boolean; initialTab: "terms" | "privacy"; onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(initialTab);
  useEffect(() => { if (open) setActiveTab(initialTab); }, [open, initialTab]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 520, maxHeight: "88vh",
              background: Z.bg, borderRadius: "24px 24px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
              display: "flex", flexDirection: "column",
              fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
            }}
          >
            {/* Drag handle */}
            <div style={{ width: 40, height: 5, borderRadius: 3, background: "#DDD", margin: "12px auto 0", flexShrink: 0 }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: Z.text }}>
                {activeTab === "terms" ? "Terms & Conditions" : "Privacy Policy"}
              </h2>
              <button
                onClick={onClose}
                style={{
                  width: 34, height: 34, borderRadius: "50%", border: "none",
                  background: Z.surface, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={Z.sub} strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, padding: "14px 20px 0", flexShrink: 0 }}>
              {(["terms", "privacy"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                    borderRadius: "10px 10px 0 0",
                    background: activeTab === tab ? Z.surface : "transparent",
                    color: activeTab === tab ? Z.red : Z.muted,
                    borderBottom: `2.5px solid ${activeTab === tab ? Z.red : Z.border}`,
                    transition: "all 0.18s",
                  }}
                >
                  {tab === "terms" ? "Terms & Conditions" : "Privacy Policy"}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div style={{
              flex: 1, overflow: "auto", padding: "20px 20px 32px",
              WebkitOverflowScrolling: "touch",
            }}>
              <pre style={{
                margin: 0, fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
                fontSize: 13.5, lineHeight: 1.75, color: Z.sub,
                whiteSpace: "pre-wrap", wordWrap: "break-word",
              }}>
                {activeTab === "terms" ? TERMS_CONTENT : PRIVACY_CONTENT}
              </pre>
            </div>

            {/* Footer */}
            <div style={{
              flexShrink: 0, padding: "14px 20px",
              borderTop: `1px solid ${Z.border}`, background: Z.bg,
            }}>
              <button
                onClick={onClose}
                style={{
                  width: "100%", height: 48, borderRadius: 12, border: "none",
                  background: Z.red, color: "#fff", fontSize: 14, fontWeight: 800,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 4px 16px rgba(226,55,68,0.28)",
                  transition: "all 0.2s",
                }}
              >
                I Understand
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TableBadge({ tableNum, onRescan }: { tableNum: number; onRescan: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", marginBottom: 16, borderRadius: 12,
        background: "#F0FBF5", border: `1.5px solid rgba(61,155,110,0.3)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", background: Z.green,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 6h18M3 6v14M21 6v14M8 6V4h8v2M8 20v-6h8v6"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: Z.green,
                      textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Confirmed
          </p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: Z.text }}>
            Table {tableNum}
          </p>
        </div>
      </div>
      <button onClick={onRescan} style={{
        background: "none", border: `1px solid ${Z.border}`, cursor: "pointer",
        color: Z.sub, fontSize: 11, fontWeight: 700, fontFamily: "inherit",
        padding: "5px 10px", borderRadius: 8, transition: "all 0.15s",
      }}>
        Rescan
      </button>
    </motion.div>
  );
}

// ------------------------------------------------------------------------------
// -- MAIN COMPONENT ------------------------------------------------------------
// ------------------------------------------------------------------------------
export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoggedIn } = useUser();

  const [phase,       setPhase]       = useState<"scan" | "network" | "auth">("scan");
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [showLocalWifiForm, setShowLocalWifiForm] = useState(false);
  const [localWifiId, setLocalWifiId] = useState("");
  const [localWifiPassword, setLocalWifiPassword] = useState("");
  const [isLocalConnecting, setIsLocalConnecting] = useState(false);

  // Skip scan if table already known via URL param or localStorage
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("table");
    const localWifi = p.get("localWifi");

    if (t && /^\d+$/.test(t)) {
      setTableNumber(parseInt(t, 10));
      setPhase(localWifi === "1" ? "network" : "auth");
      if (localWifi === "1") {
        setShowLocalWifiForm(true);
        setLocalWifiId(LOCAL_WIFI_ID);
      }
    } else {
      // ✅ Key matches UserContext
      const saved = localStorage.getItem("dineiq_table_number");
      if (saved) {
        setTableNumber(parseInt(saved));
        setPhase(localWifi === "1" ? "network" : "auth");
        if (localWifi === "1") {
          setShowLocalWifiForm(true);
          setLocalWifiId(LOCAL_WIFI_ID);
        }
      }
    }
  }, []);

  const getTable = () => tableNumber ?? 1;

  const openLocalWifiFallback = (message?: string) => {
    setPhase("network");
    setShowLocalWifiForm(true);
    if (message) {
      toast.info("Switch to restaurant Wi-Fi", {
        description: message,
      });
    }
  };

  // ✅ Key matches UserContext
  const handleTableConfirmed = (n: number) => {
    localStorage.setItem("dineiq_table_number", String(n));
    setTableNumber(n);
    setPhase("network");
  };

  // -- Auth state -------------------------------------------------------------
  const [tab,         setTab]         = useState<"login" | "register">("login");
  const [loginMethod, setLoginMethod] = useState<"phone" | "email">("phone");
  const [step,        setStep]        = useState<1 | 2>(1);
  const [isLoading,   setIsLoading]   = useState(false);

  // T&C modal state
  const [termsOpen,   setTermsOpen]   = useState(false);
  const [termsTab,    setTermsTab]    = useState<"terms" | "privacy">("terms");
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [mobile, setMobile] = useState("");
  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");

  const resetToTab = (t: "login" | "register") => {
    setTab(t); setStep(1);
    setMobile(""); setEmail(""); setName("");
    setLoginMethod("phone");
    setAgreedTerms(false);
  };

  const openTerms   = () => { setTermsTab("terms");   setTermsOpen(true); };
  const openPrivacy = () => { setTermsTab("privacy"); setTermsOpen(true); };

  const phoneValid    = mobile.length === 10;
  const emailValid    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const registerReady = name.trim().length >= 2 && emailValid && phoneValid && agreedTerms;

  // -- API handlers -----------------------------------------------------------
  const handleLogin = async () => {
    if (loginMethod === "email" && !emailValid) { toast.error("Please enter a valid email address"); return; }
    if (loginMethod === "phone" && !phoneValid) { toast.error("Please enter a valid 10-digit mobile number"); return; }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/check-user`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: loginMethod,
          value: loginMethod === "email" ? email : mobile,
          table_number: tableNumber || 1,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      if (data.status === "exists") {
        if (loginMethod === "phone") {
          toast.success(`Welcome back, ${data.name}!`);
          login(String(getTable()), 1, data.name, data.mobile, data.email, data.id);
          navigate("/home");
        } else {
          toast.success("OTP sent to your email.");
          setStep(2);
        }
      } else if (data.status === "not_verified") {
        toast.error(data.message || "Account not verified. Please sign up first.");
        resetToTab("register");
      } else {
        toast.error("Account not found. Please create an account.");
        resetToTab("register");
      }
    } catch (err: any) {
      const isServerError = err?.message?.includes("Server error");
      toast.error(isServerError ? "Server error. Please try again." : "Connection failed.");
      if (!isServerError) {
        openLocalWifiFallback(
          "Internet looks unstable. Enter the local Wi-Fi ID and password to keep ordering on the local DineIQ server."
        );
      }
    } finally { setIsLoading(false); }
  };

  const handleLoginOTPVerify = async (otp: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.status === "ok") {
        toast.success("Login successful!");
        const finalTable = data.table_number || getTable();
        login(String(finalTable), 1, data.name, data.mobile, data.email, data.id);
        navigate("/home");
      } else if (data.status === "expired") {
        toast.error("OTP expired. Please request a new one.");
      } else {
        toast.error("Invalid OTP. Please try again.");
      }
    } catch {
      toast.error("Verification failed. Try again, or connect to the restaurant Wi-Fi for local ordering.");
      openLocalWifiFallback(
        "You can keep ordering locally while internet is unavailable."
      );
    }
    finally { setIsLoading(false); }
  };

  const handleRegisterSendOtp = async () => {
    if (!registerReady) {
      if (name.trim().length < 2) { toast.error("Please enter your full name"); return; }
      if (!emailValid)             { toast.error("Please enter a valid email"); return; }
      if (!phoneValid)             { toast.error("Please enter a valid 10-digit mobile"); return; }
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mobile, table_number: tableNumber || 1 }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.status === "otp_sent") {
        toast.success(`OTP sent to ${email}`); setStep(2);
      } else if (data.status === "already_exists") {
        toast.error("Account already exists. Please log in."); resetToTab("login");
      } else {
        toast.error(data.message || "Unable to send OTP. Try again.");
      }
    } catch {
      toast.error("Registration failed. Check your connection, or connect to the restaurant Wi-Fi and continue locally.");
      openLocalWifiFallback(
        "Use the restaurant Wi-Fi to save orders offline and sync them back to backend SQLite later."
      );
    }
    finally { setIsLoading(false); }
  };

  const handleRegisterVerify = async (otp: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, table_number: tableNumber }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.status === "ok") {
        toast.success("Account created successfully!");
        login(String(getTable()), 1, name, mobile, email, data.id);
        navigate("/preferences", { state: { email, name, mobile } });
      } else if (data.status === "expired") {
        toast.error("OTP expired. Please go back and resend.");
      } else {
        toast.error("Invalid OTP. Please try again.");
      }
    } catch {
      toast.error("Verification failed. Try again, or connect to the restaurant Wi-Fi for local ordering.");
      openLocalWifiFallback(
        "Use the restaurant Wi-Fi to continue on the local DineIQ server."
      );
    }
    finally { setIsLoading(false); }
  };

  // ✅ Key matches UserContext
  const handleGuest = () => {
    const t = getTable();
    localStorage.setItem("dineiq_table_number", String(t));
    login(String(t), 1, "Guest", "", "guest@dineiq.com", "guest");
    navigate("/home");
  };

  const handleStartOnline = () => {
    setNetworkMode("online");
    setShowLocalWifiForm(false);
    setLocalWifiPassword("");
    const params = new URLSearchParams(location.search);
    params.delete("localWifi");
    const destinationPath = isLoggedIn ? "/home" : "/login";
    const storedOnlineUrl = localStorage.getItem(ONLINE_APP_URL_STORAGE_KEY);
    const isOnLocalServerOrigin = window.location.origin === new URL(LOCAL_API_BASE_URL).origin;

    if (storedOnlineUrl && isOnLocalServerOrigin) {
      const onlineUrl = new URL(storedOnlineUrl);
      onlineUrl.pathname = destinationPath;
      onlineUrl.search = params.toString() ? `?${params.toString()}` : "";
      window.location.href = onlineUrl.toString();
      return;
    }

    navigate(
      {
        pathname: destinationPath,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true }
    );
    if (!isLoggedIn) {
      setPhase("auth");
    }
  };

  const enterLocalMode = () => {
    const t = getTable();
    const derivedEmail =
      (email && emailValid ? email.trim().toLowerCase() : "") || "guest@dineiq.com";
    const derivedName =
      (name && name.trim()) ||
      (derivedEmail !== "guest@dineiq.com" ? derivedEmail.split("@")[0] : "Guest");
    const derivedId = derivedEmail === "guest@dineiq.com" ? "guest" : `local_${derivedEmail}`;

    setNetworkMode("local");
    localStorage.setItem("dineiq_table_number", String(t));
    login(String(t), 1, derivedName, mobile || "", derivedEmail, derivedId);
    toast.success("Local ordering mode enabled", {
      description: "Orders will be saved to the local server as pending_sync and synced into backend SQLite later.",
    });
    navigate("/home");
  };

  const handleStartLocal = () => {
    setShowLocalWifiForm(true);
    setLocalWifiId((current) => current || LOCAL_WIFI_ID);
  };

  const handleLocalWifiConnect = async () => {
    if (localWifiId.trim() !== LOCAL_WIFI_ID || localWifiPassword !== LOCAL_WIFI_PASSWORD) {
      toast.error("Incorrect local Wi-Fi credentials");
      return;
    }

    setIsLocalConnecting(true);
    try {
      const res = await fetch(`${LOCAL_API_BASE_URL}/health`);
      if (!res.ok) {
        throw new Error(`Local server unavailable: ${res.status}`);
      }
      enterLocalMode();
    } catch {
      toast.error("Local DineIQ server is not reachable yet.");
      toast.info("Check that the restaurant Wi-Fi is connected and the local server is running on the LAN.");
    } finally {
      setIsLocalConnecting(false);
    }
  };

  useEffect(() => {
    const handleOffline = () => {
      openLocalWifiFallback(
        "Internet connection was lost. Connect to the restaurant Wi-Fi and continue with the local server."
      );
    };

    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, []);

  const slide = {
    enter:  { opacity: 0, x: 20  },
    center: { opacity: 1, x: 0   },
    exit:   { opacity: 0, x: -20 },
  };

  // -- Render -----------------------------------------------------------------
  return (
    <div className="login-page" style={{
      minHeight: "100dvh", width: "100%", background: Z.bg, display: "flex",
      flexDirection: "column", fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
    }}>

      {/* Hero image */}
      <div className="login-hero" style={{
        position: "relative", width: "100%", height: "35vh",
        minHeight: 220, maxHeight: 300, overflow: "hidden", flexShrink: 0,
      }}>
        <video
          src={heroVideo}
          poster={splashBg}
          autoPlay
          muted
          loop
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)",
        }} />
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          style={{ position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center", padding: "0 20px" }}
        >
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
            Harvest <span style={{ color: Z.red }}>DineIQ</span>
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.72)", fontWeight: 500 }}>
            Bounty from the earth, served with care
          </p>
        </motion.div>
      </div>

      {/* Form sheet */}
      <motion.div
        className="login-sheet"
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          flex: 1, background: Z.bg, borderRadius: "28px 28px 0 0", marginTop: -24,
          position: "relative", zIndex: 10, boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
          width: "100%", maxWidth: 520, marginLeft: "auto", marginRight: "auto",
        }}
      >
        <div style={{ width: 40, height: 5, borderRadius: 3, background: "#DDD", margin: "14px auto 20px" }} />

        <div className="login-sheet-inner" style={{ padding: "0 20px 40px" }}>
          <AnimatePresence mode="wait">

            {/* -- PHASE 1: QR SCAN -- */}
            {phase === "scan" && (
              <motion.div key="phase-scan"
                initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                <QRStep onTableConfirmed={handleTableConfirmed} />
              </motion.div>
            )}

            {phase === "network" && (
              <motion.div key="phase-network"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {tableNumber && (
                  <TableBadge
                    tableNum={tableNumber}
                    onRescan={() => { setPhase("scan"); setTableNumber(null); }}
                  />
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: Z.text }}>
                    Choose How To Start
                  </h2>
                  <p style={{ margin: 0, fontSize: 14, color: Z.sub, lineHeight: 1.6 }}>
                    Start online for full login and cloud ordering, or connect to the restaurant Wi-Fi to keep ordering on the local DineIQ network if internet drops.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button
                    onClick={handleStartOnline}
                    style={{
                      textAlign: "left",
                      padding: "16px 18px",
                      borderRadius: 16,
                      border: `1.5px solid ${Z.border}`,
                      background: Z.bg,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 800, color: Z.text }}>Start Online</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: Z.sub }}>
                      Login or sign up with DineIQ and place orders through the main backend.
                    </div>
                  </button>

                  <button
                    onClick={handleStartLocal}
                    style={{
                      textAlign: "left",
                      padding: "16px 18px",
                      borderRadius: 16,
                      border: `1.5px solid ${Z.red}`,
                      background: Z.redLight,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 800, color: Z.text }}>Open Local Wi-Fi Mode</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: Z.sub }}>
                      First connect this device to the restaurant Wi-Fi in device settings, then continue in local ordering mode backed by the on-site DineIQ server.
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: Z.text, fontWeight: 700 }}>
                      Wi-Fi ID: <span style={{ color: Z.red }}>{LOCAL_WIFI_ID}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: Z.text, fontWeight: 700 }}>
                      Password: <span style={{ color: Z.red }}>{LOCAL_WIFI_PASSWORD}</span>
                    </div>
                  </button>
                </div>

                <AnimatePresence>
                  {showLocalWifiForm && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        padding: 16,
                        borderRadius: 16,
                        background: Z.surface,
                        border: `1px solid ${Z.border}`,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: Z.text }}>
                          Open Local Server
                        </div>
                        <div style={{ fontSize: 13, color: Z.sub, lineHeight: 1.6 }}>
                          After connecting this device to the on-site Wi-Fi, open the local DineIQ server. Orders saved after this point will appear in the Dashboard as offline orders with
                          <span style={{ fontWeight: 800, color: Z.text }}> pending_sync</span> and will sync into backend SQLite once the upstream backend is reachable.
                        </div>
                      </div>

                      <SInput
                        label="Local Wi-Fi ID"
                        type="text"
                        value={localWifiId}
                        onChange={(e: any) => setLocalWifiId(e.target.value)}
                        placeholder={LOCAL_WIFI_ID}
                      />
                      <SInput
                        label="Local Wi-Fi Password"
                        type="password"
                        value={localWifiPassword}
                        onChange={(e: any) => setLocalWifiPassword(e.target.value)}
                        placeholder="Enter password after joining Wi-Fi"
                      />

                      <RedButton
                        onClick={handleLocalWifiConnect}
                        disabled={!localWifiId.trim() || !localWifiPassword.trim() || isLocalConnecting}
                        loading={isLocalConnecting}
                      >
                        I'm Connected, Open Local Server →
                      </RedButton>
                    </motion.div>
                  )}
                </AnimatePresence>

                <GhostButton onClick={() => setPhase("scan")}>
                  Back to QR Scan
                </GhostButton>
              </motion.div>
            )}

            {/* -- PHASE 2: AUTH -- */}
            {phase === "auth" && (
              <motion.div key="phase-auth"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.3 }}>

                {tableNumber && (
                  <TableBadge
                    tableNum={tableNumber}
                    onRescan={() => { setPhase("scan"); setTableNumber(null); }}
                  />
                )}

                <TabBar active={tab} onChange={t => resetToTab(t as any)} />

                <AnimatePresence mode="wait">

                  {/* LOGIN step 1 */}
                  {tab === "login" && step === 1 && (
                    <motion.div key="login-1" variants={slide}
                      initial="enter" animate="center" exit="exit"
                      transition={{ duration: 0.28 }}>
                      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: Z.text }}>
                        Welcome Back!
                      </h2>
                      <p style={{ margin: "0 0 22px", fontSize: 14, color: Z.sub }}>
                        Log in to continue ordering
                      </p>
                      <MethodToggle active={loginMethod} onChange={v => setLoginMethod(v as any)} />
                      {loginMethod === "phone" ? (
                        <SInput
                          label="Mobile Number" type="tel" maxLength={10}
                          value={mobile} autoFocus
                          onChange={(e: any) => setMobile(e.target.value.replace(/\D/g, ""))}
                          placeholder="Enter 10-digit number"
                          prefix={<span style={{ fontSize: 14, fontWeight: 700, color: Z.text, whiteSpace: "nowrap" }}>🇮🇳 +91</span>}
                          suffix={<AnimatePresence>{phoneValid && <GreenTick />}</AnimatePresence>}
                        />
                      ) : (
                        <SInput
                          label="Email Address" type="email" value={email} autoFocus
                          onChange={(e: any) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          icon={
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <rect x="2" y="4" width="20" height="16" rx="2"/>
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                          }
                          suffix={<AnimatePresence>{emailValid && <GreenTick />}</AnimatePresence>}
                        />
                      )}
                      <p style={{ margin: "14px 0 16px", fontSize: 12, color: Z.muted, lineHeight: 1.65 }}>
                        You agreed to our{" "}
                        <span onClick={openTerms} style={{ color: Z.red, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>Terms & Conditions</span>
                        {" and "}
                        <span onClick={openPrivacy} style={{ color: Z.red, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>Privacy Policy</span>
                      </p>
                      <RedButton
                        onClick={handleLogin}
                        disabled={loginMethod === "phone" ? !phoneValid : !emailValid}
                        loading={isLoading}
                      >
                        {loginMethod === "phone" ? "Login to Order →" : "Send OTP →"}
                      </RedButton>
                      <Divider text="New here?" />
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <GhostButton onClick={() => resetToTab("register")}>
                          Create an Account
                        </GhostButton>
                        <GhostButton onClick={handleGuest}>
                          <span style={{ fontSize: 17 }}>👤</span> Continue as Guest
                        </GhostButton>
                      </div>
                    </motion.div>
                  )}

                  {/* LOGIN step 2 — OTP */}
                  {tab === "login" && step === 2 && (
                    <OtpStep key="login-otp" email={email}
                      title="Enter Login OTP" subtitle="6-digit code sent to"
                      editLabel="← Change email" onEdit={() => setStep(1)}
                      onVerify={handleLoginOTPVerify} isLoading={isLoading}
                    />
                  )}

                  {/* REGISTER step 1 */}
                  {tab === "register" && step === 1 && (
                    <motion.div key="reg-1" variants={slide}
                      initial="enter" animate="center" exit="exit"
                      transition={{ duration: 0.28 }}>
                      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: Z.text }}>
                        Create Account
                      </h2>
                      <p style={{ margin: "0 0 22px", fontSize: 14, color: Z.sub }}>
                        Join DineIQ for a personalised experience
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <SInput
                          label="Full Name" type="text" value={name} autoFocus
                          onChange={(e: any) => setName(e.target.value)}
                          placeholder="e.g. Atharv Sharma"
                          icon={
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <circle cx="12" cy="8" r="4"/>
                              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                            </svg>
                          }
                        />
                        <SInput
                          label="Email Address" type="email" value={email}
                          onChange={(e: any) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          icon={
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <rect x="2" y="4" width="20" height="16" rx="2"/>
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                          }
                          suffix={<AnimatePresence>{emailValid && <GreenTick />}</AnimatePresence>}
                        />
                        <SInput
                          label="Mobile Number" type="tel" maxLength={10} value={mobile}
                          onChange={(e: any) => setMobile(e.target.value.replace(/\D/g, ""))}
                          placeholder="10-digit number"
                          prefix={<span style={{ fontSize: 14, fontWeight: 700, color: Z.text, whiteSpace: "nowrap" }}>🇮🇳 +91</span>}
                          suffix={<AnimatePresence>{phoneValid && <GreenTick />}</AnimatePresence>}
                        />
                      </div>
                      <div
                        onClick={() => setAgreedTerms(prev => !prev)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          margin: "18px 0 16px", cursor: "pointer", userSelect: "none",
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${agreedTerms ? Z.red : Z.border}`,
                          background: agreedTerms ? Z.red : Z.bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.18s", marginTop: 1,
                        }}>
                          {agreedTerms && (
                            <motion.svg
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              width="13" height="13" viewBox="0 0 24 24" fill="none"
                              stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </motion.svg>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: Z.sub, lineHeight: 1.65 }}>
                          I agree to the{" "}
                          <span onClick={e => { e.stopPropagation(); openTerms(); }} style={{ color: Z.red, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>Terms & Conditions</span>
                          {" and "}
                          <span onClick={e => { e.stopPropagation(); openPrivacy(); }} style={{ color: Z.red, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>Privacy Policy</span>
                        </p>
                      </div>
                      <RedButton onClick={handleRegisterSendOtp} disabled={!registerReady} loading={isLoading}>
                        Send OTP →
                      </RedButton>
                      <Divider text="Have an account?" />
                      <GhostButton onClick={() => resetToTab("login")}>Log in instead</GhostButton>
                    </motion.div>
                  )}

                  {/* REGISTER step 2 — OTP */}
                  {tab === "register" && step === 2 && (
                    <OtpStep key="reg-otp" email={email}
                      title="Verify Your Email" subtitle="6-digit code sent to"
                      editLabel="← Change details" onEdit={() => setStep(1)}
                      onVerify={handleRegisterVerify} isLoading={isLoading}
                    />
                  )}

                </AnimatePresence>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>

      <TermsModal open={termsOpen} initialTab={termsTab} onClose={() => setTermsOpen(false)} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #ABABAB !important; }
        * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }
        html, body, #root { min-height: 100%; }
        body { margin: 0; overflow-x: hidden; }
        #qr-region video {
          width: 100% !important; height: 100% !important;
          object-fit: cover !important; border-radius: 0 !important;
        }
        #qr-region img { display: none !important; }
        #qr-region > div:last-child { display: none !important; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

        .login-page {
          overflow-x: hidden;
        }

        @media (max-width: 640px) {
          .login-hero {
            height: 28vh !important;
            min-height: 180px !important;
            max-height: 240px !important;
          }

          .login-sheet {
            max-width: 100% !important;
            border-radius: 24px 24px 0 0 !important;
            margin-top: -18px !important;
            box-shadow: 0 -6px 24px rgba(0,0,0,0.1) !important;
          }

          .login-sheet-inner {
            padding: 0 16px 28px !important;
          }

          .login-qr-step {
            gap: 14px !important;
          }

          .login-qr-viewport {
            width: min(100%, 300px) !important;
            height: min(100vw - 48px, 300px) !important;
          }

          .login-manual-row {
            flex-direction: column !important;
          }

          .login-manual-input,
          .login-manual-button {
            width: 100% !important;
          }
        }

        @media (max-width: 420px) {
          .login-hero {
            height: 25vh !important;
            min-height: 160px !important;
          }

          .login-sheet-inner {
            padding: 0 14px 24px !important;
          }

          .login-qr-viewport {
            width: min(100%, 272px) !important;
            height: min(100vw - 40px, 272px) !important;
            border-radius: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}

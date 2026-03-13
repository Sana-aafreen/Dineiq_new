import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/config";
import { Html5Qrcode } from "html5-qrcode";

// ── Design tokens ──────────────────────────────────────────────────────────────
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

// ── Extract table number from any QR payload ───────────────────────────────────
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

// ── Countdown hook ─────────────────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════════
// ── SCAN FRAME CORNERS ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════════════
// ── QR STEP ───────────────────────────────────────────────────────────────────
// Camera is NOT auto-started — user taps the button first (fixes slow load).
// ══════════════════════════════════════════════════════════════════════════════
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

      {/* ── Camera viewport ── */}
      <div style={{
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
          <div style={{ display: "flex", gap: 10 }}>
            <input
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

// ══════════════════════════════════════════════════════════════════════════════
// ── SHARED SUB-COMPONENTS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function LoginScreen() {
  const navigate = useNavigate();
  const { login } = useUser();

  const [phase,       setPhase]       = useState<"scan" | "auth">("scan");
  const [tableNumber, setTableNumber] = useState<number | null>(null);

  // Skip scan if table already known via URL param or localStorage
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("table");

    if (t && /^\d+$/.test(t)) {
      setTableNumber(parseInt(t, 10));
      setPhase("auth");
    } else {
      // ✅ Key matches UserContext
      const saved = localStorage.getItem("dineiq_table_number");
      if (saved) {
        setTableNumber(parseInt(saved));
        setPhase("auth");
      }
    }
  }, []);

  const getTable = () => tableNumber ?? 1;

  // ✅ Key matches UserContext
  const handleTableConfirmed = (n: number) => {
    localStorage.setItem("dineiq_table_number", String(n));
    setTableNumber(n);
    setPhase("auth");
  };

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [tab,         setTab]         = useState<"login" | "register">("login");
  const [loginMethod, setLoginMethod] = useState<"phone" | "email">("phone");
  const [step,        setStep]        = useState<1 | 2>(1);
  const [isLoading,   setIsLoading]   = useState(false);

  const [mobile, setMobile] = useState("");
  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");

  const resetToTab = (t: "login" | "register") => {
    setTab(t); setStep(1);
    setMobile(""); setEmail(""); setName("");
    setLoginMethod("phone");
  };

  const phoneValid    = mobile.length === 10;
  const emailValid    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const registerReady = name.trim().length >= 2 && emailValid && phoneValid;

  // ── API handlers ───────────────────────────────────────────────────────────
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
      toast.error(
        err?.message?.includes("Server error")
          ? "Server error. Please try again."
          : "Connection failed. Check your internet and try again."
      );
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
    } catch { toast.error("Verification failed. Please try again."); }
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
    } catch { toast.error("Registration failed. Check your connection."); }
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
    } catch { toast.error("Verification failed. Please try again."); }
    finally { setIsLoading(false); }
  };

  // ✅ Key matches UserContext
  const handleGuest = () => {
    const t = getTable();
    localStorage.setItem("dineiq_table_number", String(t));
    login(String(t), 1, "Guest", "", "guest@dineiq.com", "guest");
    navigate("/home");
  };

  const slide = {
    enter:  { opacity: 0, x: 20  },
    center: { opacity: 1, x: 0   },
    exit:   { opacity: 0, x: -20 },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: Z.bg, display: "flex",
      flexDirection: "column", fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
    }}>

      {/* Hero image */}
      <div style={{
        position: "relative", width: "100%", height: "35vh",
        minHeight: 220, maxHeight: 300, overflow: "hidden", flexShrink: 0,
      }}>
        <img
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80"
          alt="Food"
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
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          flex: 1, background: Z.bg, borderRadius: "28px 28px 0 0", marginTop: -24,
          position: "relative", zIndex: 10, boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
          width: "100%", maxWidth: 520, marginLeft: "auto", marginRight: "auto",
        }}
      >
        <div style={{ width: 40, height: 5, borderRadius: 3, background: "#DDD", margin: "14px auto 20px" }} />

        <div style={{ padding: "0 20px 40px" }}>
          <AnimatePresence mode="wait">

            {/* ══ PHASE 1: QR SCAN ══ */}
            {phase === "scan" && (
              <motion.div key="phase-scan"
                initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                <QRStep onTableConfirmed={handleTableConfirmed} />
              </motion.div>
            )}

            {/* ══ PHASE 2: AUTH ══ */}
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
                        By continuing, you agree to our{" "}
                        <span style={{ color: Z.red, fontWeight: 600, cursor: "pointer" }}>Terms</span>
                        {" & "}
                        <span style={{ color: Z.red, fontWeight: 600, cursor: "pointer" }}>Privacy Policy</span>
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
                      <p style={{ margin: "16px 0", fontSize: 12, color: Z.muted, lineHeight: 1.65 }}>
                        By signing up, you agree to our{" "}
                        <span style={{ color: Z.red, fontWeight: 600, cursor: "pointer" }}>Terms</span>
                        {" & "}
                        <span style={{ color: Z.red, fontWeight: 600, cursor: "pointer" }}>Privacy Policy</span>
                      </p>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #ABABAB !important; }
        * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }
        #qr-region video {
          width: 100% !important; height: 100% !important;
          object-fit: cover !important; border-radius: 0 !important;
        }
        #qr-region img { display: none !important; }
        #qr-region > div:last-child { display: none !important; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}
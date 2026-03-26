import { useEffect, useState } from "react";
import { WifiOff, Wifi, X } from "lucide-react";
import { LOCAL_API_BASE_URL, ONLINE_APP_URL_STORAGE_KEY, setNetworkMode } from "@/config";
import { useNavigate } from "react-router-dom";

const LOCAL_WIFI_ID = import.meta.env.VITE_LOCAL_WIFI_SSID || "DineIQ-Local";
const LOCAL_WIFI_PASSWORD = import.meta.env.VITE_LOCAL_WIFI_PASSWORD || "dineiq123";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [showWifiPopup, setShowWifiPopup] = useState(false);
  const [wifiId, setWifiId] = useState(LOCAL_WIFI_ID);
  const [wifiPassword, setWifiPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      setShowWifiPopup(false);
      setTimeout(() => setShowBackOnline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
      setShowWifiPopup(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showBackOnline && !showWifiPopup) return null;

  const handleOpenPopup = () => {
    setNetworkMode("local");
    localStorage.setItem(ONLINE_APP_URL_STORAGE_KEY, window.location.href);
    setWifiId(LOCAL_WIFI_ID);
    setConnectionError("");
    setShowWifiPopup(true);
  };

  const handleConnect = async () => {
    if (wifiId.trim() !== LOCAL_WIFI_ID || wifiPassword !== LOCAL_WIFI_PASSWORD) {
      setConnectionError("Incorrect local Wi-Fi ID or password.");
      return;
    }

    setIsConnecting(true);
    setConnectionError("");
    try {
      const response = await fetch(`${LOCAL_API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Local server unavailable: ${response.status}`);
      }
      setNetworkMode("local");
      setShowWifiPopup(false);
      const currentUrl = new URL(window.location.href);
      const table = currentUrl.searchParams.get("table") || localStorage.getItem("dineiq_table_number");
      localStorage.setItem(ONLINE_APP_URL_STORAGE_KEY, window.location.href);
      const localUrl = new URL(LOCAL_API_BASE_URL);
      localUrl.pathname = "/login";
      localUrl.searchParams.set("localWifi", "1");
      if (table) {
        localUrl.searchParams.set("table", table);
      }
      window.location.href = localUrl.toString();
    } catch (error) {
      setConnectionError(
        `Health check could not reach ${LOCAL_API_BASE_URL}. If you are connected to the restaurant Wi-Fi, open the local server directly below.`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const openLocalServerDirectly = () => {
    setNetworkMode("local");
    localStorage.setItem(ONLINE_APP_URL_STORAGE_KEY, window.location.href);
    const currentUrl = new URL(window.location.href);
    const table = currentUrl.searchParams.get("table") || localStorage.getItem("dineiq_table_number");
    const localUrl = new URL(LOCAL_API_BASE_URL);
    localUrl.pathname = "/login";
    localUrl.searchParams.set("localWifi", "1");
    if (table) {
      localUrl.searchParams.set("table", table);
    }
    window.location.href = localUrl.toString();
  };

  const credentialsMatch =
    wifiId.trim() === LOCAL_WIFI_ID && wifiPassword === LOCAL_WIFI_PASSWORD;

  return (
    <>
      {(showBackOnline || !isOnline) && (
        <div
          className={`fixed top-4 left-1/2 z-[9999] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold shadow-lg transition-all duration-500 md:text-sm ${
            isOnline
              ? "bg-green-600/90 text-white backdrop-blur-sm"
              : "border border-gray-700 bg-gray-900/90 text-white backdrop-blur-sm"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4" />
              You're back online!
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
              <span className="min-w-0 text-center leading-5">
                Network issue detected. Connect to the restaurant Wi-Fi to keep ordering locally.
              </span>
              <button
                onClick={handleOpenPopup}
                className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-900 transition hover:bg-gray-100 md:text-xs"
              >
                Connect Wi-Fi
              </button>
            </>
          )}
        </div>
      )}

      {showWifiPopup && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black text-gray-900">Open Local Wi-Fi Mode</div>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  First connect this device to the restaurant Wi-Fi in your device settings, then open the local DineIQ server. Orders will be saved offline in the Dashboard and synced to backend SQLite later.
                </p>
              </div>
              <button
                onClick={() => setShowWifiPopup(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                aria-label="Close local Wi-Fi popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
                  Local Wi-Fi ID
                </label>
                <input
                  value={wifiId}
                  onChange={(e) => setWifiId(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#E23744] focus:bg-white"
                  placeholder={LOCAL_WIFI_ID}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
                  Local Wi-Fi Password
                </label>
                <input
                  type="password"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#E23744] focus:bg-white"
                  placeholder="Enter the local Wi-Fi password after joining Wi-Fi"
                />
              </div>
            </div>

            {!credentialsMatch && wifiPassword.length > 0 && !connectionError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                Enter the restaurant Wi-Fi ID and password after connecting this device to that Wi-Fi.
              </p>
            )}

            {connectionError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                {connectionError}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={handleConnect}
                disabled={!wifiId.trim() || !wifiPassword.trim() || !credentialsMatch || isConnecting}
                className="h-12 rounded-2xl bg-[#E23744] px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(226,55,68,0.24)] transition disabled:cursor-not-allowed disabled:bg-[#f0a8ae]"
              >
                {isConnecting ? "Opening Local Server..." : "I'm Connected, Open Local Server"}
              </button>
              <button
                onClick={openLocalServerDirectly}
                className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 transition hover:bg-gray-50"
              >
                Open Local Server Directly
              </button>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
                1. Connect this device in Wi-Fi settings
                <br />
                Wi-Fi ID: <span className="font-bold text-gray-900">{LOCAL_WIFI_ID}</span>
                <br />
                Password: <span className="font-bold text-gray-900">{LOCAL_WIFI_PASSWORD}</span>
                <br />
                2. Then open local server: <span className="font-bold text-gray-900">{LOCAL_API_BASE_URL}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

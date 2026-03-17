import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { offlineApi } from "./utils/offlineApi";

// ─── Wake up backend on app load ───
const wakeBackend = () => {
  fetch(`${import.meta.env.VITE_API_URL || "https://dineiq-backend.in"}/`)
    .then(() => console.log("✅ DineIQ backend is awake"))
    .catch(() => console.log("⏳ Backend waking up..."));
};
wakeBackend();

// ─── Sync queued orders when back online ───
window.addEventListener("online", () => {
  console.log("🌐 Back online — syncing queued orders...");
  offlineApi.syncQueuedOrders();
  wakeBackend();
});

// ─── Register Service Worker ───
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log("✅ DineIQ is ready to work offline!");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
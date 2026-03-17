import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const dismissed = localStorage.getItem("dineiq_install_dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setIsVisible(true), 5000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("dineiq_install_dismissed", "true");
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-orange-100 p-4 flex items-center gap-3">
      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
        <span className="text-2xl">🍽️</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm">Add DineIQ to Home Screen</p>
        <p className="text-xs text-gray-500 mt-0.5">Browse menu & order even offline!</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button onClick={handleDismiss} className="p-1.5 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
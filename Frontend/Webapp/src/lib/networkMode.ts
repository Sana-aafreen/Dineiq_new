const LAN = "http://192.168.1.10:8000";   // ← mini PC's IP on restaurant WiFi
const CLOUD = "https://dineiq-backend.in";

let _cachedBase: string | null = null;

export async function getApiBase(): Promise<string> {
  if (_cachedBase) return _cachedBase;
  try {
    const res = await fetch(`${LAN}/`, {
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) {
      _cachedBase = LAN;
      return LAN;
    }
  } catch {}
  _cachedBase = CLOUD;
  return CLOUD;
}

// Call this on route change or order submit to refresh
export function resetNetworkCache() {
  _cachedBase = null;
}
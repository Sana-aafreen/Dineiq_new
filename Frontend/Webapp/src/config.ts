export type NetworkMode = "online" | "local";

export const NETWORK_MODE_STORAGE_KEY = "dineiq_network_mode";
export const ONLINE_APP_URL_STORAGE_KEY = "dineiq_online_app_url";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const getDefaultApiBaseUrl = () => import.meta.env.VITE_API_URL || "http://localhost:8000";

const getDefaultLocalApiBaseUrl = () => {
  if (import.meta.env.VITE_LOCAL_API_URL) return import.meta.env.VITE_LOCAL_API_URL;
  if (typeof window !== "undefined" && window.location.hostname) {
    const protocol = window.location.protocol || "http:";
    return `${protocol}//${window.location.hostname}:8002`;
  }
  return "http://localhost:8002";
};

export const API_BASE_URL = normalizeBaseUrl(getDefaultApiBaseUrl());
export const LOCAL_API_BASE_URL = normalizeBaseUrl(getDefaultLocalApiBaseUrl());

export const getNetworkMode = (): NetworkMode => {
  if (typeof window === "undefined") return "online";
  const stored = window.localStorage.getItem(NETWORK_MODE_STORAGE_KEY);
  return stored === "local" ? "local" : "online";
};

export const setNetworkMode = (mode: NetworkMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NETWORK_MODE_STORAGE_KEY, mode);
};

export const getActiveApiBaseUrl = () =>
  getNetworkMode() === "local" ? LOCAL_API_BASE_URL : API_BASE_URL;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dineiq.app",
  appName: "DineIQ",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;

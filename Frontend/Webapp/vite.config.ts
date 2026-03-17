import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),

    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false, // ✅ Disabled in dev — prevents blank page on refresh
      },
      includeAssets: ["favicon.ico", "placeholder.svg", "icons/*.png"],

      manifest: {
        name: "DineIQ - The Royal Kitchen",
        short_name: "DineIQ",
        description: "Smart in-house dining experience at The Royal Kitchen",
        theme_color: "#f97316",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        screenshots: [
          {
            src: "/placeholder.svg",
            sizes: "540x720",
            type: "image/svg+xml",
            form_factor: "narrow",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}"],
        skipWaiting: true,
        clientsClaim: true,

        // ✅ Fixes blank page on refresh — serves index.html for all routes
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // Menu API — Network first, fallback to cache
            urlPattern: ({ url }) =>
              url.origin === "https://dineiq-backend.in" &&
              url.pathname.includes("/menu"),
            handler: "NetworkFirst",
            options: {
              cacheName: "dineiq-menu",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 2,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Offers API — Show cached instantly, update in background
            urlPattern: ({ url }) =>
              url.origin === "https://dineiq-backend.in" &&
              url.pathname.includes("/offers"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "dineiq-offers",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Order History — Network first, graceful failure if no cache
            urlPattern: ({ url }) =>
              url.origin === "https://dineiq-backend.in" &&
              url.pathname.includes("/order-history"),
            handler: "NetworkFirst",
            options: {
              cacheName: "dineiq-orders",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: { statuses: [0, 200] },
              fetchOptions: {
                mode: "cors",
              },
            },
          },
          {
            // Coupons — Cache first (rarely changes)
            urlPattern: ({ url }) =>
              url.origin === "https://dineiq-backend.in" &&
              url.pathname.includes("/coupons"),
            handler: "CacheFirst",
            options: {
              cacheName: "dineiq-coupons",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 6,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts — Cache forever
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Unsplash food images — Cache for offline menu images
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "food-images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
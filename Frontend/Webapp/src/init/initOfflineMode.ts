/**
 * Offline Mode Initialization for Webapp
 * Call this in App.tsx or main.tsx to set up offline support
 */

import {
  registerServiceWorker,
  onServiceWorkerUpdate,
  onServiceWorkerSync,
  onNotificationClick,
} from './lib/serviceWorkerManager';
import {
  initSyncEngine,
  SyncConfig,
} from './lib/syncEngine';
import {
  initializeOfflineMode,
  triggerSync,
  setupOfflineListener,
  isAppOnline,
} from './hooks/useOfflineMode';
import { getApiBase } from './api';

/**
 * Initialize complete offline-first architecture
 */
export async function initializeWebappOfflineMode(): Promise<void> {
  console.log('[Webapp Init] Starting offline mode initialization...');

  try {
    // 1. Register Service Worker
    console.log('[Webapp Init] Registering Service Worker...');
    const swReg = await registerServiceWorker({
      filePath: '/service-worker.ts',
      scope: '/',
      autoUpdate: true,
      updateInterval: 60000,
    });

    if (!swReg) {
      console.warn('[Webapp Init] Service Worker registration failed');
    }

    // 2. Initialize Sync Engine
    console.log('[Webapp Init] Initializing sync engine...');
    const apiBase = await getApiBase();
    const localServerBase = 'http://192.168.1.10:8000'; // Mini PC IP

    const syncConfig: SyncConfig = {
      cloudApiBase: apiBase,
      localServerBase,
      maxRetries: 3,
      retryDelayMs: 5000,
      conflictStrategy: 'server', // Default to server version on conflict
      enableLocalSync: true, // Try local server first
    };

    const syncEngine = initSyncEngine(syncConfig);
    syncEngine.startAutoSync(30000); // Auto-sync every 30s

    // 3. Listen for Service Worker updates
    console.log('[Webapp Init] Setting up Service Worker listeners...');
    onServiceWorkerUpdate((newWorker) => {
      console.log('[Webapp Init] Service Worker update available');
      // Notify user via UI toast/banner
      window.dispatchEvent(
        new CustomEvent('app-sw-update-available', {
          detail: { message: 'App update available. Reload to install.' },
        })
      );
    });

    // 4. Listen for sync events
    onServiceWorkerSync((data) => {
      console.log('[Webapp Init] Sync event from Service Worker:', data);
      triggerSync();
    });

    // 5. Listen for notification clicks
    onNotificationClick((data) => {
      console.log('[Webapp Init] Notification clicked:', data);
      if (data.orderId) {
        window.location.href = `/?orderId=${data.orderId}`;
      }
    });

    // 6. Initialize offline mode
    await initializeOfflineMode();

    // 7. Setup online/offline listeners
    setupOfflineListener((isOnline) => {
      window.dispatchEvent(
        new CustomEvent('app-connection-status', {
          detail: { isOnline },
        })
      );

      if (isOnline) {
        console.log('[Webapp Init] Connection restored, triggering sync');
        triggerSync();
      }
    });

    // 8. Trigger initial sync if online
    if (isAppOnline()) {
      console.log('[Webapp Init] App is online, triggering initial sync');
      await triggerSync();
    }

    console.log('[Webapp Init] ✓ Offline mode fully initialized');
  } catch (err) {
    console.error('[Webapp Init] Initialization error:', err);
    // Don't block app startup if offline init fails
  }
}

/**
 * Cleanup function (call on app unmount if needed)
 */
export async function cleanupWebappOfflineMode(): Promise<void> {
  console.log('[Webapp Init] Cleaning up offline mode...');
  // Sync engine cleanup happens automatically through destroySyncEngine()
}

export default initializeWebappOfflineMode;

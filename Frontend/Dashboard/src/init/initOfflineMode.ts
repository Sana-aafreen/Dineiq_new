/**
 * Offline Mode Initialization for Dashboard
 * Call this in App.tsx or main.tsx to set up kitchen display offline support
 */

import {
  registerServiceWorker,
  onServiceWorkerUpdate,
  onKitchenSync,
  onKitchenNotificationClick,
} from '../lib/serviceWorkerManager';
import {
  initializeOfflineModeDashboard,
  isDashboardOnline,
  cacheOrdersForOffline,
  setupKitchenSyncListener,
} from '../hooks/useOfflineMode';

/**
 * Initialize complete offline-first architecture for Dashboard
 */
export async function initializeDashboardOfflineMode(): Promise<void> {
  console.log('[Dashboard Init] Starting offline mode initialization...');

  try {
    // 1. Register Service Worker for Dashboard
    console.log('[Dashboard Init] Registering Service Worker...');
    const swReg = await registerServiceWorker({
      filePath: '/service-worker.ts',
      scope: '/',
      autoUpdate: true,
      updateInterval: 120000, // Longer interval for dashboard (2 min)
    });

    if (!swReg) {
      console.warn('[Dashboard Init] Service Worker registration failed');
    }

    // 2. Listen for Service Worker updates
    console.log('[Dashboard Init] Setting up Service Worker listeners...');
    onServiceWorkerUpdate((newWorker) => {
      console.log('[Dashboard Init] Service Worker update available');
      window.dispatchEvent(
        new CustomEvent('dashboard-sw-update-available', {
          detail: { message: 'Dashboard update available' },
        })
      );
    });

    // 3. Listen for kitchen sync events
    onKitchenSync((data) => {
      console.log('[Dashboard Init] Kitchen sync event:', data);
      window.dispatchEvent(
        new CustomEvent('dashboard-kitchen-sync-received', {
          detail: data,
        })
      );
    });

    // 4. Listen for kitchen notification clicks
    onKitchenNotificationClick((data) => {
      console.log('[Dashboard Init] Kitchen notification clicked:', data);
      if (data.orderId) {
        window.location.href = `/orders/${data.orderId}`;
      }
    });

    // 5. Initialize offline mode for dashboard
    await initializeOfflineModeDashboard();

    // 6. Setup connection status listener
    window.addEventListener('online', () => {
      console.log('[Dashboard Init] Back online');
      window.dispatchEvent(new CustomEvent('dashboard-back-online'));
    });

    window.addEventListener('offline', () => {
      console.log('[Dashboard Init] Going offline');
      window.dispatchEvent(new CustomEvent('dashboard-went-offline'));
    });

    // 7. Check initial connection status
    if (isDashboardOnline()) {
      console.log('[Dashboard Init] Dashboard is online');
      // Emit event to trigger initial data load
      window.dispatchEvent(new CustomEvent('dashboard-online-ready'));
    } else {
      console.log('[Dashboard Init] Dashboard is offline');
      window.dispatchEvent(new CustomEvent('dashboard-offline-mode'));
    }

    console.log('[Dashboard Init] ✓ Offline mode fully initialized');
  } catch (err) {
    console.error('[Dashboard Init] Initialization error:', err);
    // Don't block dashboard startup if offline init fails
  }
}

/**
 * Preload orders into cache when fetched from server
 * Call this after fetching orders from API
 */
export async function preloadOrdersToCache(orders: any[]): Promise<void> {
  try {
    const result = await cacheOrdersForOffline(orders);
    if (result.success) {
      console.log(`[Dashboard Init] Cached ${result.cached} orders for offline`);
    } else {
      console.warn('[Dashboard Init] Failed to cache orders:', result.message);
    }
  } catch (err) {
    console.error('[Dashboard Init] Cache error:', err);
  }
}

/**
 * Cleanup function (call on app unmount if needed)
 */
export async function cleanupDashboardOfflineMode(): Promise<void> {
  console.log('[Dashboard Init] Cleaning up offline mode...');
  // Cleanup is handled automatically
}

export default initializeDashboardOfflineMode;

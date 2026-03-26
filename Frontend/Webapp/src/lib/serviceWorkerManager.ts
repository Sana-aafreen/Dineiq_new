/**
 * Service Worker registration and management for Webapp
 */

interface ServiceWorkerConfig {
  filePath?: string;
  scope?: string;
  autoUpdate?: boolean;
  updateInterval?: number;
}

/**
 * Register Service Worker and handle updates
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | null> {
  const {
    filePath = '/service-worker.ts',
    scope = '/',
    autoUpdate = true,
    updateInterval = 60000, // 1 minute
  } = config;

  if (!('serviceWorker' in navigator)) {
    console.warn(
      '[SW] Service Workers are not supported in this browser'
    );
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(filePath, {
      scope,
    });

    console.log('[SW] Service Worker registered:', registration);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // New Service Worker is ready
          notifyUpdate(newWorker);
        }
      });
    });

    // Auto-update checking
    if (autoUpdate) {
      setInterval(() => {
        registration.update().catch((err) => {
          console.error('[SW] Error checking for updates:', err);
        });
      }, updateInterval);
    }

    // Log when controller changes (update was installed)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed - update installed');
    });

    setupMessageHandlers();

    return registration;
  } catch (err) {
    console.error('[SW] Registration error:', err);
    return null;
  }
}

/**
 * Notify app that a Service Worker update is available
 */
function notifyUpdate(newWorker: ServiceWorker): void {
  console.log('[SW] Update available');

  // Send message to app
  if (newWorker.postMessage) {
    newWorker.postMessage({ type: 'SW_UPDATE_READY' });
  }

  // Also dispatch event
  window.dispatchEvent(
    new CustomEvent('sw-update-ready', { detail: { newWorker } })
  );
}

/**
 * Skip waiting and immediately activate new Service Worker
 */
export function skipWaitingServiceWorker(): void {
  if (!navigator.serviceWorker.controller) return;

  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Handle messages from Service Worker
 */
function setupMessageHandlers(): void {
  if (!navigator.serviceWorker.controller) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, data } = event.data;

    console.log('[SW Message]', type, data);

    switch (type) {
      case 'SYNC_START':
        console.log('[SW] Sync triggered from Service Worker');
        window.dispatchEvent(
          new CustomEvent('sw-sync-start', { detail: data })
        );
        break;

      case 'NOTIFICATION_CLICKED':
        console.log('[SW] Notification clicked, navigating to order:', data.orderId);
        window.dispatchEvent(
          new CustomEvent('sw-notification-click', { detail: data })
        );
        break;

      default:
        console.log('[SW] Unknown message type:', type);
    }
  });
}

/**
 * Trigger background sync from app
 */
export function triggerBackgroundSync(data?: any): void {
  if (!navigator.serviceWorker.controller) {
    console.warn('[SW] No active Service Worker controller');
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'TRIGGER_SYNC',
    data,
  });

  console.log('[SW] Background sync triggered');
}

/**
 * Unregister Service Worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const results = await Promise.all(
      registrations.map((reg) => reg.unregister())
    );

    console.log('[SW] Unregistered', results.length, 'Service Workers');
    return true;
  } catch (err) {
    console.error('[SW] Unregister error:', err);
    return false;
  }
}

/**
 * Check if Service Worker is active
 */
export function isServiceWorkerActive(): boolean {
  return !!navigator.serviceWorker.controller;
}

/**
 * Get Service Worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  return navigator.serviceWorker.ready;
}

/**
 * Listen for Service Worker updates (for UI notifications)
 */
export function onServiceWorkerUpdate(
  callback: (newWorker: ServiceWorker) => void
): () => void {
  const handler = ((event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail.newWorker);
  }) as EventListener;

  window.addEventListener('sw-update-ready', handler);

  return () => {
    window.removeEventListener('sw-update-ready', handler);
  };
}

/**
 * Listen for Service Worker sync events
 */
export function onServiceWorkerSync(
  callback: (data: any) => void
): () => void {
  const handler = ((event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  }) as EventListener;

  window.addEventListener('sw-sync-start', handler);

  return () => {
    window.removeEventListener('sw-sync-start', handler);
  };
}

/**
 * Listen for notification clicks
 */
export function onNotificationClick(
  callback: (data: any) => void
): () => void {
  const handler = ((event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  }) as EventListener;

  window.addEventListener('sw-notification-click', handler);

  return () => {
    window.removeEventListener('sw-notification-click', handler);
  };
}

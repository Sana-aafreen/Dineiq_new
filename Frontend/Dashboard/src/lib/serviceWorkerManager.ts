/**
 * Service Worker registration and management for Dashboard
 */

interface ServiceWorkerConfig {
  filePath?: string;
  scope?: string;
  autoUpdate?: boolean;
  updateInterval?: number;
}

/**
 * Register Service Worker for Dashboard
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | null> {
  const {
    filePath = '/service-worker.ts',
    scope = '/',
    autoUpdate = true,
    updateInterval = 60000,
  } = config;

  if (!('serviceWorker' in navigator)) {
    console.warn('[Dashboard SW] Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(filePath, {
      scope,
    });

    console.log('[Dashboard SW] Registered:', registration);

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          notifyUpdate(newWorker);
        }
      });
    });

    if (autoUpdate) {
      setInterval(() => {
        registration.update().catch((err) => {
          console.error('[Dashboard SW] Update error:', err);
        });
      }, updateInterval);
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[Dashboard SW] Controller changed');
    });

    setupMessageHandlers();

    return registration;
  } catch (err) {
    console.error('[Dashboard SW] Registration error:', err);
    return null;
  }
}

/**
 * Notify about available update
 */
function notifyUpdate(newWorker: ServiceWorker): void {
  console.log('[Dashboard SW] Update available');

  if (newWorker.postMessage) {
    newWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  window.dispatchEvent(
    new CustomEvent('sw-update-ready', { detail: { newWorker } })
  );
}

/**
 * Setup message handlers from Service Worker
 */
function setupMessageHandlers(): void {
  if (!navigator.serviceWorker.controller) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, data } = event.data;

    console.log('[Dashboard SW Message]', type);

    switch (type) {
      case 'SYNC_KITCHEN_UPDATES':
        console.log('[Dashboard SW] Kitchen updates sync triggered');
        window.dispatchEvent(
          new CustomEvent('sw-kitchen-sync', { detail: data })
        );
        break;

      case 'KITCHEN_NOTIFICATION_CLICKED':
        console.log('[Dashboard SW] Kitchen notification clicked');
        window.dispatchEvent(
          new CustomEvent('sw-kitchen-notif-click', { detail: data })
        );
        break;

      default:
        console.log('[Dashboard SW] Unknown message:', type);
    }
  });
}

/**
 * Trigger kitchen status update sync
 */
export function triggerKitchenSync(data?: any): void {
  if (!navigator.serviceWorker.controller) {
    console.warn('[Dashboard SW] No active controller');
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'TRIGGER_SYNC_UPDATES',
    data,
  });

  console.log('[Dashboard SW] Kitchen sync triggered');
}

/**
 * Skip waiting for new Service Worker
 */
export function skipWaitingServiceWorker(): void {
  if (!navigator.serviceWorker.controller) return;

  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
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

    console.log('[Dashboard SW] Unregistered', results.length, 'workers');
    return true;
  } catch (err) {
    console.error('[Dashboard SW] Unregister error:', err);
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
 * Listen for Service Worker updates
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
 * Listen for kitchen sync events
 */
export function onKitchenSync(
  callback: (data: any) => void
): () => void {
  const handler = ((event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  }) as EventListener;

  window.addEventListener('sw-kitchen-sync', handler);

  return () => {
    window.removeEventListener('sw-kitchen-sync', handler);
  };
}

/**
 * Listen for kitchen notification clicks
 */
export function onKitchenNotificationClick(
  callback: (data: any) => void
): () => void {
  const handler = ((event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  }) as EventListener;

  window.addEventListener('sw-kitchen-notif-click', handler);

  return () => {
    window.removeEventListener('sw-kitchen-notif-click', handler);
  };
}

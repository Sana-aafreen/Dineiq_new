/**
 * Service Worker for DineIQ Webapp
 * Handles offline support, background sync, and caching
 */

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'dineiq-webapp-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
];

interface SyncEventData {
  type: 'sync-orders' | 'sync-status';
  orderId?: string;
}

// ============================================================================
// INSTALL EVENT - Cache static assets
// ============================================================================

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(STATIC_ASSETS);
        console.log('[SW] Static assets cached');
        await self.skipWaiting(); // Activate immediately
      } catch (err) {
        console.error('[SW] Install error:', err);
      }
    })()
  );
});

// ============================================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================================

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const toDelete = cacheNames.filter((name) => name !== CACHE_NAME);

      await Promise.all(toDelete.map((name) => caches.delete(name)));
      console.log(`[SW] Cleaned up ${toDelete.length} old caches`);

      await self.clients.claim(); // Control all clients immediately
    })()
  );
});

// ============================================================================
// FETCH EVENT - Network-first strategy with offline fallback
// ============================================================================

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (request.url.startsWith('http') && !request.url.startsWith(self.location.origin)) {
    return;
  }

  // API requests: network-first with IndexedDB fallback
  if (request.url.includes('/api/') || request.url.includes(':8000/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // HTML pages: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
});

/**
 * Handle API requests - network-first, fallback to cache/offline response
 */
async function handleApiRequest(request: Request): Promise<Response> {
  try {
    // Try network
    const response = await fetch(request.clone(), {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request.clone(), response.clone());
      return response;
    }

    // If network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] API request cached:', request.url);
      return cached;
    }

    // Return offline response
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.log('[SW] Network error, returning cached or offline response:', err);

    // Try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return offline response
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle static asset requests - cache-first
 */
async function handleStaticRequest(request: Request): Promise<Response> {
  try {
    // Try cache first
    let response = await caches.match(request);
    if (response) return response;

    // If not cached, fetch and cache
    response = await fetch(request.clone());

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request.clone(), response.clone());
    }

    return response;
  } catch (err) {
    console.log('[SW] Static asset offline:', request.url);

    // Return a generic offline response or placeholder
    const mediaType = getMediaType(request.url);

    if (mediaType === 'image') {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50" y="50" text-anchor="middle">offline</text></svg>`,
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Handle navigation requests (HTML pages) - network-first
 */
async function handleNavigationRequest(
  request: Request
): Promise<Response> {
  try {
    // Try network
    const response = await fetch(request.clone(), {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      // Cache successful responses (but not the base app shell)
      if (!request.url.endsWith('/')) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request.clone(), response.clone());
      }
      return response;
    }

    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return app shell
    const cached_root = await caches.match('/index.html');
    if (cached_root) return cached_root;

    return new Response('Offline - App not available', { status: 503 });
  } catch (err) {
    console.log('[SW] Navigation offline:', request.url);

    // Try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return app shell
    const cached_root = await caches.match('/index.html');
    if (cached_root) return cached_root;

    return new Response('Offline - App not available', { status: 503 });
  }
}

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

// Fallback for browsers that don't support BackgroundSync API
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, data } = event.data;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'TRIGGER_SYNC') {
    handleBackgroundSync(data);
  }
});

/**
 * Handle background sync (triggered from app or periodically)
 */
async function handleBackgroundSync(data?: SyncEventData): Promise<void> {
  console.log('[SW] Background sync triggered:', data);

  // Notify all clients to start sync
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_START',
      data,
    });
  });
}

// ============================================================================
// PUSH NOTIFICATIONS (for order status updates)
// ============================================================================

self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push notification received:', event.data);

  if (!event.data) return;

  const data = event.data.json();
  const { title, body, badge, icon, tag, data: notificationData } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'DineIQ Order Update', {
      body: body || 'Your order status has been updated',
      icon: icon || '/icons/notification.png',
      badge: badge || '/icons/badge.png',
      tag: tag || 'order-notification',
      data: notificationData,
    })
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  const { orderId, action } = event.notification.data || {};

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
      });

      // Check if app is already open
      let appClient = clients.find(
        (client) => client.url.includes('/') && !client.url.includes('about')
      );

      if (appClient) {
        // Focus existing window and send message
        await appClient.focus();
        appClient.postMessage({
          type: 'NOTIFICATION_CLICKED',
          orderId,
          action,
        });
      } else {
        // Open new window
        let url = '/';
        if (orderId) {
          url += `?orderId=${orderId}`;
        }
        appClient = await self.clients.openWindow(url);
      }
    })()
  );
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine if URL is a static asset
 */
function isStaticAsset(url: string): boolean {
  const staticExtensions = [
    '.js',
    '.css',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ];

  return staticExtensions.some((ext) => url.endsWith(ext));
}

/**
 * Get media type from URL
 */
function getMediaType(
  url: string
): 'image' | 'style' | 'script' | 'font' | 'other' {
  if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return 'image';
  if (url.match(/\.css$/i)) return 'style';
  if (url.match(/\.js$/i)) return 'script';
  if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
  return 'other';
}

console.log('[SW] Service Worker loaded');

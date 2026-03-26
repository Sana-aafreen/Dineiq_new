/**
 * Service Worker for DineIQ Dashboard
 * Handles offline support for kitchen display and order management
 */

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'dineiq-dashboard-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
];

// ============================================================================
// INSTALL EVENT
// ============================================================================

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[Dashboard SW] Installing...');

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(STATIC_ASSETS);
        console.log('[Dashboard SW] Static assets cached');
        await self.skipWaiting();
      } catch (err) {
        console.error('[Dashboard SW] Install error:', err);
      }
    })()
  );
});

// ============================================================================
// ACTIVATE EVENT
// ============================================================================

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[Dashboard SW] Activating...');

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const toDelete = cacheNames.filter((name) => name !== CACHE_NAME);

      await Promise.all(toDelete.map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

// ============================================================================
// FETCH EVENT - Critical: Always allow API calls through
// ============================================================================

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // API requests: network-first with long timeout for real-time updates
  if (request.url.includes('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Navigation: network-first
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
});

/**
 * Handle API requests - network-first for real-time kitchen display
 */
async function handleApiRequest(request: Request): Promise<Response> {
  try {
    // Network first (with longer timeout for dashboard real-time)
    const response = await fetch(request.clone(), {
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request.clone(), response.clone());
      return response;
    }

    // Fall back to cache
    const cached = await caches.match(request);
    if (cached) {
      console.log('[Dashboard SW] Using cached API response:', request.url);
      return cached;
    }

    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.log('[Dashboard SW] Network error:', request.url);

    const cached = await caches.match(request);
    if (cached) return cached;

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
 * Handle static assets - cache-first
 */
async function handleStaticRequest(request: Request): Promise<Response> {
  try {
    let response = await caches.match(request);
    if (response) return response;

    response = await fetch(request.clone());

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request.clone(), response.clone());
    }

    return response;
  } catch (err) {
    const mediaType = getMediaType(request.url);

    if (mediaType === 'image') {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50" y="50">offline</text></svg>`,
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Handle navigation requests
 */
async function handleNavigationRequest(
  request: Request
): Promise<Response> {
  try {
    const response = await fetch(request.clone(), {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      if (!request.url.endsWith('/')) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request.clone(), response.clone());
      }
      return response;
    }

    const cached = await caches.match(request);
    if (cached) return cached;

    const cachedRoot = await caches.match('/index.html');
    if (cachedRoot) return cachedRoot;

    return new Response('Offline', { status: 503 });
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const cachedRoot = await caches.match('/index.html');
    if (cachedRoot) return cachedRoot;

    return new Response('Offline', { status: 503 });
  }
}

// ============================================================================
// MESSAGE HANDLING - For app-initiated sync
// ============================================================================

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, data } = event.data;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'TRIGGER_SYNC_UPDATES') {
    console.log('[Dashboard SW] Syncing status updates:', data);
    // Notify app to sync kitchen display updates
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_KITCHEN_UPDATES',
          data,
        });
      });
    });
  }
});

// ============================================================================
// PUSH NOTIFICATIONS - For kitchen display alerts
// ============================================================================

self.addEventListener('push', (event: PushEvent) => {
  console.log('[Dashboard SW] Push received');

  if (!event.data) return;

  const data = event.data.json();
  const { title, body, icon, tag, data: notifData } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'Kitchen Display Update', {
      body: body || 'New order or status change',
      icon: icon || '/icons/notification.png',
      tag: tag || 'kitchen-notification',
      data: notifData,
      requireInteraction: true, // Keep notification visible
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[Dashboard SW] Kitchen notification clicked');

  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      let appClient = clients[0];

      if (appClient) {
        appClient.focus();
        appClient.postMessage({
          type: 'KITCHEN_NOTIFICATION_CLICKED',
          data: event.notification.data,
        });
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});

// ============================================================================
// UTILITIES
// ============================================================================

function isStaticAsset(url: string): boolean {
  const extensions = [
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
  ];
  return extensions.some((ext) => url.endsWith(ext));
}

function getMediaType(
  url: string
): 'image' | 'style' | 'script' | 'font' | 'other' {
  if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return 'image';
  if (url.match(/\.css$/i)) return 'style';
  if (url.match(/\.js$/i)) return 'script';
  if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
  return 'other';
}

console.log('[Dashboard SW] Service Worker loaded');

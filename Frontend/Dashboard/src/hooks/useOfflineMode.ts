/**
 * Offline Mode Hook for Dashboard
 * Handles kitchen display and order status updates while offline
 */

import {
  cacheMultipleOrders,
  updateOrderStatus,
  updateItemStatus,
  recordStatusUpdate,
  getPendingStatusUpdates,
  markMultipleStatusUpdatesSynced,
  getDashboardStats,
  CachedOrder,
  OrderStatus,
} from '../lib/offlineOrderStore';

/**
 * Cache orders from server for offline access
 */
export async function cacheOrdersForOffline(
  orders: any[]
): Promise<{
  success: boolean;
  cached: number;
  message?: string;
}> {
  try {
    const cachedOrders = orders.map((order) => ({
      orderId: order.order_id || order.id,
      customerId: order.customer_id || '',
      customerName: order.customer_name || '',
      customerPhone: order.customer_phone,
      items: order.items || [],
      totalAmount: order.total_amount || 0,
      status: order.status || 'pending',
      estimatedTime: order.estimated_time || 0,
      createdAt: Date.now(),
      syncStatus: 'synced' as const,
      tableNumber: order.table_number,
      specialInstructions: order.special_instructions,
    }));

    await cacheMultipleOrders(cachedOrders);

    console.log('[Dashboard Offline] Cached', cachedOrders.length, 'orders');

    return {
      success: true,
      cached: cachedOrders.length,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Dashboard Offline] Cache error:', err);

    return {
      success: false,
      cached: 0,
      message: `Failed to cache orders: ${errorMsg}`,
    };
  }
}

/**
 * Update order status locally and queue for sync
 */
export async function updateOrderStatusLocally(
  orderId: string,
  status: OrderStatus
): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    await updateOrderStatus(orderId, status, true);

    console.log('[Dashboard Offline] Order', orderId, 'status updated to', status);

    return {
      success: true,
      message: `Order status updated to ${status}`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Dashboard Offline] Update error:', err);

    return {
      success: false,
      message: `Failed to update order: ${errorMsg}`,
    };
  }
}

/**
 * Update item status and queue for kitchen display sync
 */
export async function updateKitchenItemStatus(
  orderId: string,
  itemId: string,
  itemStatus: 'pending' | 'preparing' | 'ready'
): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    await updateItemStatus(orderId, itemId, itemStatus);

    console.log(
      '[Dashboard Offline] Item',
      itemId,
      'in order',
      orderId,
      'status updated to',
      itemStatus
    );

    return {
      success: true,
      message: `Item status updated to ${itemStatus}`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Dashboard Offline] Item update error:', err);

    return {
      success: false,
      message: `Failed to update item: ${errorMsg}`,
    };
  }
}

/**
 * Get pending kitchen status updates
 */
export async function getPendingKitchenUpdates(): Promise<{
  updates: any[];
  count: number;
}> {
  try {
    const updates = await getPendingStatusUpdates();

    return {
      updates,
      count: updates.length,
    };
  } catch (err) {
    console.error('[Dashboard Offline] Error fetching pending updates:', err);
    return {
      updates: [],
      count: 0,
    };
  }
}

/**
 * Sync pending kitchen updates to server
 */
export async function syncKitchenUpdatesToServer(
  baseApiUrl: string
): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  message?: string;
}> {
  try {
    const updates = await getPendingStatusUpdates();

    if (updates.length === 0) {
      return {
        success: true,
        synced: 0,
        failed: 0,
        message: 'No updates to sync',
      };
    }

    let synced = 0;
    let failed = 0;

    for (const update of updates) {
      try {
        const response = await fetch(
          `${baseApiUrl}/orders/${update.orderId}/items/${update.itemId}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: update.status,
              timestamp: update.timestamp,
            }),
          }
        );

        if (response.ok) {
          await markMultipleStatusUpdatesSynced([update.id]);
          synced++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error('[Dashboard Offline] Sync error for update', update.id, err);
        failed++;
      }
    }

    console.log(
      '[Dashboard Offline] Synced',
      synced,
      'updates, failed',
      failed
    );

    return {
      success: failed === 0,
      synced,
      failed,
      message: `Synced ${synced}/${updates.length} updates`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Dashboard Offline] Sync error:', err);

    return {
      success: false,
      synced: 0,
      failed: 0,
      message: `Failed to sync updates: ${errorMsg}`,
    };
  }
}

/**
 * Get dashboard statistics (offline mode)
 */
export async function getOfflineDashboardStats(): Promise<{
  success: boolean;
  stats?: any;
  message?: string;
}> {
  try {
    const stats = await getDashboardStats();

    return {
      success: true,
      stats,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Dashboard Offline] Stats error:', err);

    return {
      success: false,
      message: `Failed to get stats: ${errorMsg}`,
    };
  }
}

/**
 * Listen for sync status changes
 */
export function setupKitchenSyncListener(
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
 * Initialize offline mode for dashboard
 */
export async function initializeOfflineModeDashboard(): Promise<void> {
  try {
    // Listen for online/offline changes
    window.addEventListener('online', () => {
      console.log('[Dashboard Offline] Back online');
      window.dispatchEvent(new CustomEvent('dashboard-online'));
    });

    window.addEventListener('offline', () => {
      console.log('[Dashboard Offline] Going offline');
      window.dispatchEvent(new CustomEvent('dashboard-offline'));
    });

    // Listen for kitchen sync events from Service Worker
    setupKitchenSyncListener((data) => {
      console.log('[Dashboard Offline] Kitchen sync event:', data);
      window.dispatchEvent(
        new CustomEvent('dashboard-kitchen-sync', { detail: data })
      );
    });

    console.log('[Dashboard Offline] Offline mode initialized');
  } catch (err) {
    console.error('[Dashboard Offline] Error initializing offline mode:', err);
  }
}

/**
 * Check if app is online
 */
export function isDashboardOnline(): boolean {
  return navigator.onLine;
}

export default {
  cacheOrdersForOffline,
  updateOrderStatusLocally,
  updateKitchenItemStatus,
  getPendingKitchenUpdates,
  syncKitchenUpdatesToServer,
  getOfflineDashboardStats,
  setupKitchenSyncListener,
  initializeOfflineModeDashboard,
  isDashboardOnline,
};

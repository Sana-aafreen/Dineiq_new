/**
 * Offline API Wrapper for Webapp
 * Handles storing orders locally and syncing when online
 */

import { getApiBase } from '../../api'; // Assuming this exists
import {
  createOfflineOrder,
  getOfflineOrder,
  getCustomerOrders,
  getSyncStats,
  OfflineOrder,
} from './offlineOrderStore';
import { getSyncEngine } from './syncEngine';

/**
 * Place order - handles both online and offline scenarios
 */
export async function placeOrder(
  customerId: string,
  items: any[],
  totalAmount: number,
  appliedDiscount: number,
  paymentMethod: string,
  options?: {
    specialInstructions?: string;
    estimatedTime?: number;
    discountReason?: string;
  }
): Promise<{
  success: boolean;
  orderId: string;
  offline: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Generate temporary order ID (format: Ord_XXXX)
    const tempOrderId = generateTempOrderId();

    // First, create in offline store
    const offlineOrder = await createOfflineOrder({
      tempOrderId,
      customerId,
      items,
      totalAmount,
      appliedDiscount,
      selectedPaymentMethod: paymentMethod,
      syncStatus: 'pending_sync',
      specialInstructions: options?.specialInstructions,
      estimatedTime: options?.estimatedTime,
      discountReason: options?.discountReason,
    });

    console.log('[OfflineAPI] Order created locally:', offlineOrder.tempOrderId);

    // Try to sync immediately if online
    if (navigator.onLine) {
      try {
        const apiBase = await getApiBase();
        const response = await fetch(`${apiBase}/orders/place-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            items: items.map((item) => ({
              item_id: item.itemId,
              quantity: item.quantity,
              customizations: item.customizations,
            })),
            total_amount: totalAmount,
            applied_discount: appliedDiscount,
            discount_reason: options?.discountReason,
            payment_method: paymentMethod,
            special_instructions: options?.specialInstructions,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const cloudOrderId = data.order_id || data.orderId;

          // Update store with cloud order ID
          const syncEngine = getSyncEngine();
          await syncEngine.getSyncEngine()._sync_order_with_retry(
            tempOrderId,
            offlineOrder,
            0
          );

          console.log('[OfflineAPI] Order synced to cloud:', cloudOrderId);

          return {
            success: true,
            orderId: cloudOrderId || tempOrderId,
            offline: false,
            message: 'Order placed and sent to cloud',
          };
        }
      } catch (err) {
        console.warn('[OfflineAPI] Cloud sync failed, saved locally:', err);
      }
    }

    return {
      success: true,
      orderId: tempOrderId,
      offline: true,
      message: 'Order saved locally. Will sync when online.',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[OfflineAPI] Error placing order:', err);

    return {
      success: false,
      orderId: '',
      offline: true,
      error: `Failed to place order: ${errorMsg}`,
    };
  }
}

/**
 * Get customer's orders (including pending offline orders)
 */
export async function getCustomerOrdersWithOffline(
  customerId: string
): Promise<(OfflineOrder & { isOffline: boolean })[]> {
  try {
    const offlineOrders = await getCustomerOrders(customerId);

    return offlineOrders.map((order) => ({
      ...order,
      isOffline: order.syncStatus !== 'synced',
    }));
  } catch (err) {
    console.error('[OfflineAPI] Error fetching orders:', err);
    return [];
  }
}

/**
 * Get sync status for UI
 */
export async function getSyncStatusForUI(): Promise<{
  isSyncing: boolean;
  pending: number;
  synced: number;
  failed: number;
  conflicts: number;
}> {
  try {
    const stats = await getSyncStats();
    return stats;
  } catch (err) {
    console.error('[OfflineAPI] Error getting sync stats:', err);
    return {
      isSyncing: false,
      pending: 0,
      synced: 0,
      failed: 0,
      conflicts: 0,
    };
  }
}

/**
 * Manually trigger sync
 */
export async function triggerSync(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!navigator.onLine) {
      return {
        success: false,
        message: 'No internet connection',
      };
    }

    const syncEngine = getSyncEngine();
    const result = await syncEngine.syncPending();

    return {
      success: result.success,
      message: `Synced ${result.ordersSucceeded}/${result.ordersProcessed} orders`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[OfflineAPI] Sync error:', err);

    return {
      success: false,
      message: `Sync failed: ${errorMsg}`,
    };
  }
}

/**
 * Listen for online/offline changes and trigger sync when back online
 */
export function setupOfflineListener(
  onStatusChange?: (isOnline: boolean) => void
): () => void {
  const handleOnline = async () => {
    console.log('[OfflineAPI] Back online, triggering sync...');
    onStatusChange?.(true);
    await triggerSync();
  };

  const handleOffline = () => {
    console.log('[OfflineAPI] Going offline');
    onStatusChange?.(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Initialize offline mode in app
 */
export async function initializeOfflineMode(): Promise<void> {
  try {
    const syncEngine = getSyncEngine();

    // Start auto-sync every 30 seconds
    syncEngine.startAutoSync(30000);

    // Listen for online/offline changes
    setupOfflineListener();

    // Listen for sync status updates
    syncEngine.onSyncStatusChange('webapp-main', (status, data) => {
      console.log('[OfflineAPI] Sync status:', status, data);
      window.dispatchEvent(
        new CustomEvent('offline-sync-status', { detail: { status, data } })
      );
    });

    console.log('[OfflineAPI] Offline mode initialized');
  } catch (err) {
    console.error('[OfflineAPI] Error initializing offline mode:', err);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate temporary order ID
 */
function generateTempOrderId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `Ord_${timestamp.toString().slice(-4)}${random}`;
}

/**
 * Check if app is online
 */
export function isAppOnline(): boolean {
  return navigator.onLine;
}

/**
 * Format order for display
 */
export function formatOfflineOrderForDisplay(order: OfflineOrder) {
  return {
    id: order.cloudOrderId || order.tempOrderId,
    tempId: order.tempOrderId,
    items: order.items,
    total: order.totalAmount,
    status: order.syncStatus,
    createdAt: new Date(order.createdAt),
    isOffline: order.syncStatus !== 'synced',
    hasSyncError: order.syncStatus === 'failed',
    syncError: order.syncError,
  };
}

export default {
  placeOrder,
  getCustomerOrdersWithOffline,
  getSyncStatusForUI,
  triggerSync,
  setupOfflineListener,
  initializeOfflineMode,
  isAppOnline,
  formatOfflineOrderForDisplay,
};

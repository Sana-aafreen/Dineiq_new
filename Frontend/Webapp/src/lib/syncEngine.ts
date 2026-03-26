/**
 * Sync Engine - Manages offline order queue, retry, and conflict resolution
 * Bridges local IndexedDB ↔ Cloud API & Local Server
 */

import {
  OfflineOrder,
  SyncStatus,
  getAllPendingSyncOrders,
  getFailedOrders,
  markOrderSynced,
  markOrderSyncFailed,
  markOrderConflicted,
  recordConflict,
  resolveConflict,
  getUnresolvedConflicts,
} from './offlineOrderStore';

export interface SyncConfig {
  cloudApiBase: string;
  localServerBase?: string; // Optional: for local-first sync
  maxRetries: number;
  retryDelayMs: number;
  conflictStrategy: 'server' | 'client' | 'manual'; // Default resolution strategy
  enableLocalSync: boolean; // If true, try local server first
}

export interface SyncResult {
  success: boolean;
  ordersProcessed: number;
  ordersSucceeded: number;
  ordersFailed: number;
  conflicts: number;
  errors: SyncError[];
}

export interface SyncError {
  orderId: string;
  error: string;
  timestamp: number;
}

type SyncTarget = 'local' | 'cloud';

class SyncEngine {
  private config: SyncConfig;
  private isSyncing: boolean = false;
  private syncIntervalId?: NodeJS.Timeout;
  private listeners: Map<
    string,
    (status: 'syncing' | 'idle' | 'error', data?: any) => void
  > = new Map();

  constructor(config: SyncConfig) {
    this.config = config;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.cloudApiBase) {
      throw new Error('cloudApiBase is required');
    }
    if (this.config.maxRetries < 1) {
      throw new Error('maxRetries must be at least 1');
    }
  }

  /**
   * Start automatic sync polling
   */
  public startAutoSync(intervalMs: number = 5000): void {
    if (this.syncIntervalId) return;

    this.syncIntervalId = setInterval(() => {
      this.syncPending().catch((err) =>
        console.error('[SyncEngine] Auto-sync error:', err)
      );
    }, intervalMs);

    console.log(`[SyncEngine] Auto-sync started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop automatic sync polling
   */
  public stopAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
      console.log('[SyncEngine] Auto-sync stopped');
    }
  }

  /**
   * Main sync function - processes all pending orders
   */
  public async syncPending(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[SyncEngine] Sync already in progress, skipping');
      return {
        success: false,
        ordersProcessed: 0,
        ordersSucceeded: 0,
        ordersFailed: 0,
        conflicts: 0,
        errors: [],
      };
    }

    this.isSyncing = true;
    this.notify('syncing', { message: 'Starting sync...' });
    const result: SyncResult = {
      success: true,
      ordersProcessed: 0,
      ordersSucceeded: 0,
      ordersFailed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      const pendingOrders = await getAllPendingSyncOrders();
      const failedOrders = await getFailedOrders();
      const allToSync = [...pendingOrders, ...failedOrders];

      if (allToSync.length === 0) {
        console.log('[SyncEngine] No orders to sync');
        this.isSyncing = false;
        this.notify('idle');
        return result;
      }

      console.log(`[SyncEngine] Processing ${allToSync.length} orders for sync`);

      for (const order of allToSync) {
        result.ordersProcessed++;
        try {
          // If local server is available and order hasn't been synced yet
          if (this.config.enableLocalSync && !order.cloudOrderId) {
            const localSuccess = await this.syncToTarget(
              order,
              'local'
            );
            if (localSuccess) result.ordersSucceeded++;
            else result.ordersFailed++;
          } else {
            // Sync to cloud
            const cloudSuccess = await this.syncToTarget(
              order,
              'cloud'
            );
            if (cloudSuccess) result.ordersSucceeded++;
            else result.ordersFailed++;
          }
        } catch (err) {
          result.ordersFailed++;
          result.errors.push({
            orderId: order.tempOrderId,
            error: String(err),
            timestamp: Date.now(),
          });
          console.error(
            `[SyncEngine] Error syncing order ${order.tempOrderId}:`,
            err
          );
        }
      }

      // Handle unresolved conflicts
      const unresolvedConflicts = await getUnresolvedConflicts();
      result.conflicts = unresolvedConflicts.length;

      for (const conflict of unresolvedConflicts) {
        await resolveConflict(
          conflict.id!,
          this.config.conflictStrategy,
          conflict.localVersion
        );
      }

      result.success = result.ordersFailed === 0 && result.conflicts === 0;

      console.log(
        `[SyncEngine] Sync complete: ${result.ordersSucceeded} succeeded, ${result.ordersFailed} failed, ${result.conflicts} conflicts`
      );

      this.notify('idle', { result });
    } catch (err) {
      result.success = false;
      console.error('[SyncEngine] Critical sync error:', err);
      this.notify('error', { error: String(err) });
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Sync single order to target (local or cloud)
   */
  private async syncToTarget(
    order: OfflineOrder,
    target: SyncTarget
  ): Promise<boolean> {
    const apiBase =
      target === 'local'
        ? this.config.localServerBase
        : this.config.cloudApiBase;

    if (!apiBase) {
      console.warn(
        `[SyncEngine] No ${target} server configured, skipping sync`
      );
      return false;
    }

    let attempts = 0;
    let lastError: Error | undefined;

    while (attempts < this.config.maxRetries) {
      try {
        const response = await this.postOrder(apiBase, order);

        if (response.ok) {
          const data = await response.json();
          const cloudOrderId = data.order_id || data.orderId;

          await markOrderSynced(order.tempOrderId, cloudOrderId);
          console.log(
            `[SyncEngine] Order ${order.tempOrderId} synced to ${target}`
          );
          return true;
        }

        // Handle 409 Conflict
        if (response.status === 409) {
          console.warn(
            `[SyncEngine] Conflict detected for order ${order.tempOrderId}`
          );
          const conflictData = await response.json();
          await markOrderConflicted(order.tempOrderId, 'status');
          await recordConflict({
            orderId: order.tempOrderId,
            localVersion: order,
            serverVersion: conflictData.serverOrder,
            conflictType: 'status',
          });
          return false;
        }

        // Handle 4xx errors (don't retry)
        if (response.status >= 400 && response.status < 500) {
          const errorText = await response.text();
          throw new Error(
            `${response.status} Error: ${errorText || response.statusText}`
          );
        }

        // Handle 5xx errors (retry)
        if (response.status >= 500) {
          throw new Error(
            `Server error ${response.status}: ${response.statusText}`
          );
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempts++;

        if (attempts < this.config.maxRetries) {
          const delayMs = this.config.retryDelayMs * Math.pow(2, attempts - 1); // Exponential backoff
          console.warn(
            `[SyncEngine] Retry ${attempts}/${this.config.maxRetries} for order ${order.tempOrderId} in ${delayMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries exhausted
    const errorMsg = lastError?.message || 'Unknown error';
    await markOrderSyncFailed(order.tempOrderId, errorMsg);
    console.error(
      `[SyncEngine] Failed to sync order ${order.tempOrderId} after ${this.config.maxRetries} attempts: ${errorMsg}`
    );
    return false;
  }

  /**
   * Make the actual POST request to push order
   */
  private async postOrder(
    apiBase: string,
    order: OfflineOrder
  ): Promise<Response> {
    const endpoint = `${apiBase}/orders/place-order`;

    const payload = {
      customer_id: order.customerId,
      items: order.items.map((item) => ({
        item_id: item.itemId,
        quantity: item.quantity,
        customizations: item.customizations,
      })),
      total_amount: order.totalAmount,
      applied_discount: order.appliedDiscount,
      discount_reason: order.discountReason,
      payment_method: order.selectedPaymentMethod,
      special_instructions: order.specialInstructions,
    };

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
  }

  /**
   * Subscribe to sync status changes
   */
  public onSyncStatusChange(
    key: string,
    callback: (status: 'syncing' | 'idle' | 'error', data?: any) => void
  ): () => void {
    this.listeners.set(key, callback);
    return () => this.listeners.delete(key);
  }

  /**
   * Notify all listeners
   */
  private notify(
    status: 'syncing' | 'idle' | 'error',
    data?: any
  ): void {
    this.listeners.forEach((callback) => callback(status, data));
  }

  /**
   * Manually retry a specific failed order
   */
  public async retryOrder(orderId: string): Promise<boolean> {
    // Implementation for manual retry
    console.log(`[SyncEngine] Retrying order ${orderId}`);
    return this.syncPending().then((result) => result.success);
  }

  /**
   * Check if currently syncing
   */
  public isSyncingNow(): boolean {
    return this.isSyncing;
  }

  /**
   * Destroy sync engine
   */
  public destroy(): void {
    this.stopAutoSync();
    this.listeners.clear();
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

let globalSyncEngine: SyncEngine | null = null;

export function initSyncEngine(config: SyncConfig): SyncEngine {
  if (globalSyncEngine) {
    console.warn('[SyncEngine] Engine already initialized, destroying old one');
    globalSyncEngine.destroy();
  }

  globalSyncEngine = new SyncEngine(config);
  return globalSyncEngine;
}

export function getSyncEngine(): SyncEngine {
  if (!globalSyncEngine) {
    throw new Error(
      'SyncEngine not initialized. Call initSyncEngine() first.'
    );
  }
  return globalSyncEngine;
}

export function destroySyncEngine(): void {
  if (globalSyncEngine) {
    globalSyncEngine.destroy();
    globalSyncEngine = null;
  }
}

export default SyncEngine;

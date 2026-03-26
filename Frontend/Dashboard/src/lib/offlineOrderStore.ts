/**
 * IndexedDB-backed offline order store - Dashboard version
 * Caches orders for kitchen display and manager tracking
 */
import Dexie, { Table } from 'dexie';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type SyncStatus = 'synced' | 'pending_display' | 'stale';

export interface CachedOrder {
  id?: number;
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  estimatedTime: number;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  tableNumber?: string;
  specialInstructions?: string;
  lastUpdatedFromServer: number;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  status?: 'pending' | 'preparing' | 'ready';
  notes?: string;
}

export interface KitchenStatusUpdate {
  id?: number;
  orderId: string;
  itemId: string;
  status: 'pending' | 'preparing' | 'ready';
  timestamp: number;
  syncedToServer: boolean;
}

class DashboardOfflineDB extends Dexie {
  orders!: Table<CachedOrder>;
  statusUpdates!: Table<KitchenStatusUpdate>;

  constructor() {
    super('DineIQDashboardOfflineDB');
    this.version(1).stores({
      orders:
        '++id, orderId, status, createdAt, [customerId+status], lastUpdatedFromServer',
      statusUpdates: '++id, orderId, itemId, timestamp, syncedToServer',
    });
  }
}

const db = new DashboardOfflineDB();

// ============================================================================
// ORDER OPERATIONS
// ============================================================================

/**
 * Cache order from server
 */
export async function cacheOrder(
  order: Omit<CachedOrder, 'id' | 'updatedAt' | 'lastUpdatedFromServer'>
): Promise<CachedOrder> {
  const now = Date.now();
  const cachedOrder: CachedOrder = {
    ...order,
    updatedAt: now,
    lastUpdatedFromServer: now,
  };

  const id = await db.orders.add(cachedOrder);
  return { ...cachedOrder, id };
}

/**
 * Get cached order by orderId
 */
export async function getCachedOrder(
  orderId: string
): Promise<CachedOrder | undefined> {
  return db.orders.where('orderId').equals(orderId).first();
}

/**
 * Get all cached orders by status
 */
export async function getOrdersByStatus(
  status: OrderStatus
): Promise<CachedOrder[]> {
  return db.orders.where('status').equals(status).reverse().sortBy('createdAt');
}

/**
 * Get all active orders (not served or cancelled)
 */
export async function getActiveOrders(): Promise<CachedOrder[]> {
  return db.orders
    .where('status')
    .anyOf(['pending', 'confirmed', 'preparing', 'ready'])
    .reverse()
    .sortBy('createdAt');
}

/**
 * Get orders by customer
 */
export async function getCustomerOrders(
  customerId: string
): Promise<CachedOrder[]> {
  return db.orders
    .where('customerId')
    .equals(customerId)
    .reverse()
    .sortBy('createdAt');
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  syncToServer: boolean = false
): Promise<void> {
  const order = await getCachedOrder(orderId);
  if (order && order.id) {
    await db.orders.update(order.id, {
      status,
      updatedAt: Date.now(),
      syncStatus: syncToServer ? 'pending_display' : 'stale',
    });
  }
}

/**
 * Update item status within order
 */
export async function updateItemStatus(
  orderId: string,
  itemId: string,
  itemStatus: 'pending' | 'preparing' | 'ready'
): Promise<void> {
  const order = await getCachedOrder(orderId);
  if (order && order.id) {
    const updatedItems = order.items.map((item) =>
      item.itemId === itemId ? { ...item, status: itemStatus } : item
    );

    await db.orders.update(order.id, {
      items: updatedItems,
      updatedAt: Date.now(),
      syncStatus: 'pending_display',
    });

    // Record this status change for sync
    await recordStatusUpdate(orderId, itemId, itemStatus);
  }
}

/**
 * Mark order as synced to server
 */
export async function markOrderSynced(orderId: string): Promise<void> {
  const order = await getCachedOrder(orderId);
  if (order && order.id) {
    await db.orders.update(order.id, {
      syncStatus: 'synced',
      lastUpdatedFromServer: Date.now(),
    });
  }
}

/**
 * Delete cached order
 */
export async function deleteCachedOrder(orderId: string): Promise<void> {
  const order = await getCachedOrder(orderId);
  if (order && order.id) {
    await db.orders.delete(order.id);
  }
}

// ============================================================================
// STATUS UPDATE OPERATIONS (For Kitchen Display)
// ============================================================================

/**
 * Record a kitchen status update (local-first)
 */
export async function recordStatusUpdate(
  orderId: string,
  itemId: string,
  status: 'pending' | 'preparing' | 'ready'
): Promise<number> {
  return db.statusUpdates.add({
    orderId,
    itemId,
    status,
    timestamp: Date.now(),
    syncedToServer: false,
  });
}

/**
 * Get pending status updates to sync
 */
export async function getPendingStatusUpdates(): Promise<KitchenStatusUpdate[]> {
  return db.statusUpdates.where('syncedToServer').equals(false).toArray();
}

/**
 * Mark status update as synced
 */
export async function markStatusUpdateSynced(updateId: number): Promise<void> {
  await db.statusUpdates.update(updateId, {
    syncedToServer: true,
  });
}

/**
 * Batch mark multiple updates as synced
 */
export async function markMultipleStatusUpdatesSynced(
  updateIds: number[]
): Promise<void> {
  await db.statusUpdates.bulkUpdate(
    updateIds.map((id) => ({
      key: id,
      changes: { syncedToServer: true },
    }))
  );
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Cache multiple orders (for initial load)
 */
export async function cacheMultipleOrders(
  orders: Omit<CachedOrder, 'id' | 'updatedAt' | 'lastUpdatedFromServer'>[]
): Promise<void> {
  const now = Date.now();
  const cachedOrders = orders.map((order) => ({
    ...order,
    updatedAt: now,
    lastUpdatedFromServer: now,
  }));

  await db.orders.bulkAdd(cachedOrders);
}

/**
 * Clear stale orders (older than 24 hours and synced)
 */
export async function clearStaleOrders(): Promise<number> {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  return db.orders
    .where('lastUpdatedFromServer')
    .below(twentyFourHoursAgo)
    .and((order) => order.syncStatus === 'synced')
    .delete();
}

/**
 * Clear all offline data (for logout)
 */
export async function clearAllOfflineData(): Promise<void> {
  await db.orders.clear();
  await db.statusUpdates.clear();
}

// ============================================================================
// STATS & MONITORING
// ============================================================================

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<{
  total: number;
  pending: number;
  preparing: number;
  ready: number;
  pendingUpdates: number;
}> {
  const total = await db.orders.count();
  const pending = await db.orders
    .where('status')
    .equals('pending')
    .count();
  const preparing = await db.orders
    .where('status')
    .equals('preparing')
    .count();
  const ready = await db.orders
    .where('status')
    .equals('ready')
    .count();
  const pendingUpdates = await db.statusUpdates
    .where('syncedToServer')
    .equals(false)
    .count();

  return { total, pending, preparing, ready, pendingUpdates };
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<number | null> {
  const lastOrder = await db.orders
    .orderBy('lastUpdatedFromServer')
    .last();
  return lastOrder?.lastUpdatedFromServer ?? null;
}

export default db;

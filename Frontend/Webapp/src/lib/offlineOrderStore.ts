/**
 * IndexedDB-backed offline order store
 * Manages orders while offline, queues them for sync when online
 */
import Dexie, { Table } from 'dexie';

export type SyncStatus = 'pending_sync' | 'synced' | 'conflict' | 'failed';

export interface OfflineOrder {
  id?: number; // IndexedDB primary key
  tempOrderId: string; // Generated on client (Ord_0001 format)
  cloudOrderId?: string; // Assigned after cloud sync
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  appliedDiscount: number;
  discountReason?: string;
  selectedPaymentMethod: string;
  estimatedTime?: number;
  specialInstructions?: string;
  syncStatus: SyncStatus;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  lastSyncAttempt?: number;
  syncError?: string;
  conflictResolution?: 'server' | 'client' | 'manual';
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  customizations?: string[];
}

export interface SyncConflict {
  id?: number;
  orderId: string;
  localVersion: OfflineOrder;
  serverVersion: OfflineOrder;
  conflictType: 'quantity' | 'price' | 'status' | 'deleted';
  resolvedAt?: number;
}

export interface OfflineMediaAsset {
  key: string;
  sourceUrl: string;
  blob: Blob;
  contentType?: string;
  updatedAt: number;
}

class OfflineDB extends Dexie {
  orders!: Table<OfflineOrder>;
  conflicts!: Table<SyncConflict>;
  media!: Table<OfflineMediaAsset>;

  constructor() {
    super('DineIQOfflineDB');
    (this as Dexie).version(1).stores({
      orders:
        '++id, tempOrderId, customerId, syncStatus, createdAt, [customerId+syncStatus]',
      conflicts: '++id, orderId, conflictType, resolvedAt',
    });
    (this as Dexie).version(2).stores({
      orders:
        '++id, tempOrderId, customerId, syncStatus, createdAt, [customerId+syncStatus]',
      conflicts: '++id, orderId, conflictType, resolvedAt',
      media: '&key, sourceUrl, updatedAt',
    });
  }
}

const db = new OfflineDB();
const objectUrlCache = new Map<string, string>();

const getMediaKey = (url: string) => url.trim();
const isCacheableImageUrl = (url: string) =>
  Boolean(url) &&
  !url.startsWith('data:') &&
  !url.startsWith('blob:') &&
  !url.includes('placeholder');

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) return null;
    return await response.blob();
  } catch (error) {
    console.warn('[OfflineMedia] Failed to fetch image for cache:', url, error);
    return null;
  }
}

function getOrCreateObjectUrl(asset: OfflineMediaAsset): string {
  const existing = objectUrlCache.get(asset.key);
  if (existing) return existing;
  const objectUrl = URL.createObjectURL(asset.blob);
  objectUrlCache.set(asset.key, objectUrl);
  return objectUrl;
}

// ============================================================================
// ORDER OPERATIONS
// ============================================================================

/**
 * Create a new offline order
 */
export async function createOfflineOrder(
  order: Omit<OfflineOrder, 'id' | 'createdAt' | 'updatedAt'>
): Promise<OfflineOrder> {
  const now = Date.now();
  const newOrder: OfflineOrder = {
    ...order,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.orders.add(newOrder);
  return { ...newOrder, id };
}

/**
 * Get order by tempOrderId
 */
export async function getOfflineOrder(
  tempOrderId: string
): Promise<OfflineOrder | undefined> {
  return db.orders.where('tempOrderId').equals(tempOrderId).first();
}

/**
 * Get all pending sync orders for a customer
 */
export async function getPendingOrders(
  customerId: string
): Promise<OfflineOrder[]> {
  return db.orders
    .where('[customerId+syncStatus]')
    .equals([customerId, 'pending_sync'])
    .toArray();
}

/**
 * Get all orders for a customer (synced + pending)
 */
export async function getCustomerOrders(
  customerId: string
): Promise<OfflineOrder[]> {
  return db.orders
    .where('customerId')
    .equals(customerId)
    .reverse()
    .sortBy('createdAt');
}

/**
 * Update order sync status after cloud sync
 */
export async function markOrderSynced(
  tempOrderId: string,
  cloudOrderId: string
): Promise<void> {
  const order = await getOfflineOrder(tempOrderId);
  if (order) {
    await db.orders.update(order.id!, {
      syncStatus: 'synced',
      cloudOrderId,
      updatedAt: Date.now(),
      syncError: undefined,
    });
  }
}

/**
 * Mark order as failed to sync with error
 */
export async function markOrderSyncFailed(
  tempOrderId: string,
  error: string
): Promise<void> {
  const order = await getOfflineOrder(tempOrderId);
  if (order) {
    await db.orders.update(order.id!, {
      syncStatus: 'failed',
      updatedAt: Date.now(),
      syncError: error,
      lastSyncAttempt: Date.now(),
    });
  }
}

/**
 * Mark order as conflicted
 */
export async function markOrderConflicted(
  tempOrderId: string,
  conflictType: SyncConflict['conflictType']
): Promise<void> {
  const order = await getOfflineOrder(tempOrderId);
  if (order) {
    await db.orders.update(order.id!, {
      syncStatus: 'conflict',
      updatedAt: Date.now(),
    });
  }
}

/**
 * Update order (for editing during offline mode)
 */
export async function updateOfflineOrder(
  tempOrderId: string,
  updates: Partial<OfflineOrder>
): Promise<void> {
  const order = await getOfflineOrder(tempOrderId);
  if (order) {
    await db.orders.update(order.id!, {
      ...updates,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Delete offline order
 */
export async function deleteOfflineOrder(tempOrderId: string): Promise<void> {
  const order = await getOfflineOrder(tempOrderId);
  if (order && order.id) {
    await db.orders.delete(order.id);
  }
}

// ============================================================================
// CONFLICT OPERATIONS
// ============================================================================

/**
 * Record a sync conflict
 */
export async function recordConflict(
  conflict: Omit<SyncConflict, 'id'>
): Promise<number> {
  return db.conflicts.add(conflict);
}

/**
 * Get unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<SyncConflict[]> {
  return db.conflicts.where('resolvedAt').isUndefined().toArray();
}

/**
 * Resolve conflict with chosen strategy
 */
export async function resolveConflict(
  conflictId: number,
  resolution: 'server' | 'client' | 'manual',
  order?: OfflineOrder
): Promise<void> {
  await db.conflicts.update(conflictId, {
    resolvedAt: Date.now(),
  });

  if (order && resolution === 'client') {
    await updateOfflineOrder(order.tempOrderId, {
      syncStatus: 'pending_sync',
    });
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Get all orders ready to sync (pending_sync status)
 */
export async function getAllPendingSyncOrders(): Promise<OfflineOrder[]> {
  return db.orders.where('syncStatus').equals('pending_sync').toArray();
}

/**
 * Get orders with failed sync status (for retry UI)
 */
export async function getFailedOrders(): Promise<OfflineOrder[]> {
  return db.orders
    .where('syncStatus')
    .equals('failed')
    .and((order) => !order.lastSyncAttempt || Date.now() - order.lastSyncAttempt > 30000) // Retry if >30s old
    .toArray();
}

/**
 * Clear all synced orders (optional cleanup)
 */
export async function clearSyncedOrders(): Promise<number> {
  return db.orders.where('syncStatus').equals('synced').delete();
}

/**
 * Clear all offline data (for logout or reset)
 */
export async function clearAllOfflineData(): Promise<void> {
  await db.orders.clear();
  await db.conflicts.clear();
  await db.media.clear();
  objectUrlCache.forEach((value) => URL.revokeObjectURL(value));
  objectUrlCache.clear();
}

// ============================================================================
// STATS & MONITORING
// ============================================================================

/**
 * Get sync statistics
 */
export async function getSyncStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  failed: number;
  conflicts: number;
}> {
  const total = await db.orders.count();
  const pending = await db.orders
    .where('syncStatus')
    .equals('pending_sync')
    .count();
  const synced = await db.orders
    .where('syncStatus')
    .equals('synced')
    .count();
  const failed = await db.orders
    .where('syncStatus')
    .equals('failed')
    .count();
  const conflicts = await db.orders
    .where('syncStatus')
    .equals('conflict')
    .count();

  return { total, pending, synced, failed, conflicts };
}

export async function cacheImageForOffline(url: string): Promise<void> {
  if (!isCacheableImageUrl(url)) return;

  const key = getMediaKey(url);
  const existing = await db.media.get(key);
  if (existing) return;

  const blob = await fetchImageBlob(url);
  if (!blob) return;

  await db.media.put({
    key,
    sourceUrl: url,
    blob,
    contentType: blob.type,
    updatedAt: Date.now(),
  });
}

export async function cacheImagesForOffline(urls: string[]): Promise<void> {
  const uniqueUrls = Array.from(
    new Set(urls.map((url) => url?.trim()).filter((url): url is string => isCacheableImageUrl(url || '')))
  );

  await Promise.all(uniqueUrls.map((url) => cacheImageForOffline(url)));
}

export async function getOfflineMediaCoverage(urls: string[]): Promise<{
  cached: number;
  total: number;
}> {
  const uniqueUrls = Array.from(
    new Set(urls.map((url) => url?.trim()).filter((url): url is string => isCacheableImageUrl(url || "")))
  );

  if (uniqueUrls.length === 0) {
    return { cached: 0, total: 0 };
  }

  let cached = 0;
  for (const url of uniqueUrls) {
    const asset = await db.media.get(getMediaKey(url));
    if (asset?.blob) cached += 1;
  }

  return { cached, total: uniqueUrls.length };
}

export async function getOfflineImageUrl(url: string): Promise<string | null> {
  if (!isCacheableImageUrl(url)) return null;
  const key = getMediaKey(url);
  const asset = await db.media.get(key);
  if (!asset?.blob) return null;
  return getOrCreateObjectUrl(asset);
}

export async function cacheMenuPayloadForOffline(menuData: any): Promise<void> {
  const imageUrls: string[] = [];

  const sections = menuData?.menu_sections || {};
  Object.values(sections).forEach((items: any) => {
    if (!Array.isArray(items)) return;
    items.forEach((item: any) => {
      const imageUrl = item?.Image_URL || item?.image;
      if (imageUrl) imageUrls.push(String(imageUrl));
    });
  });

  await cacheImagesForOffline(imageUrls);
}

export async function cacheOfferPayloadForOffline(offersData: any): Promise<void> {
  const imageUrls = Array.isArray(offersData?.offers)
    ? offersData.offers
        .flatMap((offer: any) => [offer?.image, offer?.video])
        .filter((url): url is string => Boolean(url))
    : [];

  await cacheImagesForOffline(imageUrls);
}

export default db;

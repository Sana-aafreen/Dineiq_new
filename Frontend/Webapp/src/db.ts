// ─── DineIQ IndexedDB Utility ───
const DB_NAME    = "dineiq_db";
const DB_VERSION = 1;

const STORES = {
  menu:    "menu",
  offers:  "offers",
  orders:  "orders",
  profile: "profile",
} as const;

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });

export const dbSave = async (store: keyof typeof STORES, data: any) => {
  const db     = await openDB();
  const tx     = db.transaction(store, "readwrite");
  const obj    = tx.objectStore(store);
  const record = data?.id ? data : { id: store, ...data };
  obj.put(record);
  return new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
};

export const dbLoad = async (store: keyof typeof STORES, id?: string) => {
  const db  = await openDB();
  const tx  = db.transaction(store, "readonly");
  const obj = tx.objectStore(store);
  const req = obj.get(id || store);
  return new Promise<any>((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
};

export const dbLoadAll = async (store: keyof typeof STORES) => {
  const db  = await openDB();
  const tx  = db.transaction(store, "readonly");
  const obj = tx.objectStore(store);
  const req = obj.getAll();
  return new Promise<any[]>((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
};

export const isOnline = () => navigator.onLine;

export const smartFetch = async (
  store: keyof typeof STORES,
  fetchFn: () => Promise<any>,
  id?: string
): Promise<{ data: any; fromCache: boolean }> => {
  if (isOnline()) {
    try {
      const data = await fetchFn();
      if (data) {
        const record = id ? { id, ...data } : { id: store, ...data };
        await dbSave(store, record);
      }
      return { data, fromCache: false };
    } catch {
      // fall through to cache
    }
  }
  const cached = await dbLoad(store, id || store);
  return { data: cached, fromCache: true };
};
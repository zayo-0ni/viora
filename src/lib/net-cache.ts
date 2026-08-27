/**
 * What the app already knows, kept between launches.
 *
 * Every catalogue, every row and every set of details was fetched again from
 * nothing each time the app opened, even though almost none of it had changed
 * since the evening before. On a television on a home connection that is the
 * whole of the wait before the first screen is usable.
 *
 * So a copy of each answer is kept on disk. The next launch shows it straight
 * away and asks the network again in the background, which means the viewer
 * sees the app at once and the fresh copy is waiting for the launch after that.
 * That is the trade being made deliberately: what is on screen a moment after
 * opening may be a few hours old, and it is replaced as soon as the app is
 * opened again.
 *
 * IndexedDB rather than localStorage, and this matters. localStorage is
 * synchronous — every read and write stops the page — and this is the same
 * mistake that made reading settings the second hottest function on the device
 * earlier. IndexedDB does its work off the main thread and has room for far
 * more than a few megabytes.
 */

const DB_NAME = "viora-net";
const STORE = "responses";
const DB_VERSION = 1;

/**
 * A stored answer is always worth showing. This is only how old one has to be
 * before it is also refreshed quietly in the background.
 *
 * Nothing is thrown away for being old, and the measurements are why: the whole
 * of a well-used library — 567 answers covering the heroes, the films, the
 * series, the anime and their details — came to 4.8 MB against a 10 GB
 * allowance. That is five hundredths of one per cent. Expiring any of it would
 * buy space nobody needs at the cost of the very wait this exists to remove.
 *
 * So the viewer sees the app instantly, always; the network is asked afterwards
 * and only when the copy is a few hours old; and what comes back is there for
 * the next launch.
 */
const REVALIDATE_AFTER_MS = 6 * 60 * 60 * 1000;

/** A response larger than this is a download, not metadata. */
const MAX_BYTES = 1_000_000;

/**
 * Entries are dropped for being *unused*, not for being old.
 *
 * A title removed from a catalogue is simply never asked for again, and after a
 * month of that it goes. A title watched every week keeps its place however
 * long ago it was first stored — which is the difference between clearing out
 * what has gone and throwing away what is still wanted.
 */
const UNUSED_FOR_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = {
  url: string;
  body: string;
  savedAt: number;
  /** When this was last handed to the app, which is what the sweep judges by. */
  lastUsed: number;
  contentType: string;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "url" });
          store.createIndex("lastUsed", "lastUsed");
        }
      };
      req.onsuccess = () => resolve(req.result);
      // A browser that refuses to open the database is not a reason to fail a
      // request; the app simply goes to the network as it always did.
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

// Clearing out old entries is housekeeping, not work the viewer is waiting on,
// so it happens once, long after the app has settled, and only if the app is
// actually being used.
let sweepScheduled = false;
function scheduleSweep() {
  if (sweepScheduled) return;
  sweepScheduled = true;
  if (typeof window === "undefined") return;
  window.setTimeout(() => void sweepCache(), 45_000);
}

export async function readCached(url: string): Promise<Stored | null> {
  scheduleSweep();
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = tx(db, "readonly").get(url);
      req.onsuccess = () => {
        const v = req.result as Stored | undefined;
        if (!v || typeof v.body !== "string") return resolve(null);
        // Touched, so the sweep can tell what is still in use. Written without
        // being waited on: the answer is already on its way back.
        try {
          tx(db, "readwrite").put({ ...v, lastUsed: Date.now() } satisfies Stored);
        } catch {}
        resolve(v);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeCached(url: string, body: string, contentType: string): Promise<void> {
  if (body.length > MAX_BYTES) return;
  const db = await openDb();
  if (!db) return;
  try {
    const now = Date.now();
    tx(db, "readwrite").put({ url, body, savedAt: now, lastUsed: now, contentType } satisfies Stored);
  } catch {
    // A full or unavailable database is not worth reporting: the answer was
    // already delivered, and only the next launch loses the head start.
  }
}

/** Whether this copy is recent enough that the network need not be asked at all. */
export function isFresh(entry: Stored): boolean {
  return Date.now() - entry.savedAt < REVALIDATE_AFTER_MS;
}

/** Drops entries nothing has asked for in a month. Runs once, well after boot. */
export async function sweepCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const cutoff = Date.now() - UNUSED_FOR_MS;
    const index = db.transaction(STORE, "readwrite").objectStore(STORE).index("lastUsed");
    const req = index.openCursor(IDBKeyRange.upperBound(cutoff));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  } catch {
    return;
  }
}

/**
 * Whether an answer to this address is worth keeping.
 *
 * Catalogues and metadata only. Anything carrying a token, a session or a
 * viewer's own list is left alone — those are not the slow part, and a stored
 * copy of them would be both wrong and unwelcome.
 */
export function isCacheable(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const q = u.search.toLowerCase();
  if (/(access_token|refresh_token|session|password|authorization)/.test(q)) return false;
  const host = u.hostname;
  return (
    host === "api.themoviedb.org" ||
    host === "v3-cinemeta.strem.io" ||
    host.endsWith(".strem.io") ||
    host === "api.jikan.moe" ||
    host === "graphql.anilist.co" ||
    host === "kitsu.io" ||
    host.endsWith(".metahub.space")
  );
}

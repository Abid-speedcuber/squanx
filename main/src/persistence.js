const LARGE_KEYS = Object.freeze([
    'sq1TrainingJSONs',
    'sq1DevelopingJSONs',
    'sq1DevelopingRootNames',
    'sq1SelectedCasesByAlgset',
    'sq1SelectedCases',
    'sq1CaseTreeExpandedByAlgset',
    'sq1SessionTimes'
]);

const workerSource = `
const DB_NAME = 'squanx-persistence';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
let dbPromise = null;
let writing = false;
const latestWrites = new Map();

function openDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
        });
    }
    return dbPromise;
}

async function readKeys(keys) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const result = {};
        let remaining = keys.length;
        if (!remaining) resolve(result);
        for (const key of keys) {
            const request = store.get(key);
            request.onsuccess = () => {
                if (request.result) result[key] = request.result.value;
                remaining -= 1;
                if (remaining === 0) resolve(result);
            };
            request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
        }
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    });
}

async function writeBatch(entries) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const updatedAt = Date.now();
        for (const [key, value] of entries) store.put({ key, value, updatedAt });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
    });
}

async function drainWrites() {
    if (writing) return;
    writing = true;
    try {
        while (latestWrites.size) {
            const entries = [...latestWrites.entries()];
            latestWrites.clear();
            await writeBatch(entries);
        }
    } finally {
        writing = false;
        if (latestWrites.size) drainWrites();
    }
}

self.onmessage = async (event) => {
    const { id, type, keys, key, value, values } = event.data || {};
    try {
        if (type === 'load') {
            self.postMessage({ id, ok: true, values: await readKeys(keys || []) });
            return;
        }
        if (type === 'save') {
            latestWrites.set(key, value);
            drainWrites();
            return;
        }
        if (type === 'save-many') {
            for (const [entryKey, entryValue] of Object.entries(values || {})) latestWrites.set(entryKey, entryValue);
            drainWrites();
        }
    } catch (error) {
        self.postMessage({ id, ok: false, error: error?.message || String(error) });
    }
};
`;

let persistenceWorker = null;
let nextRequestId = 1;
const pendingRequests = new Map();
let workerAvailable = true;

function createPersistenceWorker() {
    if (persistenceWorker || !workerAvailable) return persistenceWorker;
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof indexedDB === 'undefined') {
        workerAvailable = false;
        return null;
    }
    try {
        const blob = new Blob([workerSource], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        persistenceWorker = new Worker(url);
        URL.revokeObjectURL(url);
        persistenceWorker.onmessage = (event) => {
            const { id, ok, values, error } = event.data || {};
            if (!id || !pendingRequests.has(id)) return;
            const { resolve, reject } = pendingRequests.get(id);
            pendingRequests.delete(id);
            if (ok) resolve(values);
            else reject(new Error(error || 'Persistence worker failed'));
        };
        persistenceWorker.onerror = (event) => {
            workerAvailable = false;
            for (const { reject } of pendingRequests.values()) reject(new Error(event.message || 'Persistence worker failed'));
            pendingRequests.clear();
        };
    } catch (error) {
        console.error('Could not start persistence worker:', error);
        workerAvailable = false;
        persistenceWorker = null;
    }
    return persistenceWorker;
}

function readLocalString(key, fallback = '') {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function writeLocalString(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch {
        // Storage can be unavailable in private or embedded contexts.
    }
}

function readLocalJSON(key, fallback = undefined) {
    const raw = readLocalString(key, '');
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeLocalJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Last-resort fallback only; normal large writes go to IndexedDB.
    }
}

function requestWorker(payload) {
    const worker = createPersistenceWorker();
    if (!worker) return null;
    const id = nextRequestId++;
    const promise = new Promise((resolve, reject) => pendingRequests.set(id, { resolve, reject }));
    worker.postMessage({ ...payload, id });
    return promise;
}

async function loadLargeValues(keys = LARGE_KEYS) {
    const workerRequest = requestWorker({ type: 'load', keys });
    if (!workerRequest) return Object.fromEntries(keys.map((key) => [key, readLocalJSON(key)]));
    try {
        const values = await workerRequest;
        const migratedValues = { ...values };
        const valuesToMigrate = {};
        for (const key of keys) {
            if (migratedValues[key] !== undefined) continue;
            const legacyValue = readLocalJSON(key);
            if (legacyValue !== undefined) {
                migratedValues[key] = legacyValue;
                valuesToMigrate[key] = legacyValue;
            }
        }
        if (Object.keys(valuesToMigrate).length) saveLargeValues(valuesToMigrate);
        return migratedValues;
    } catch (error) {
        console.error('IndexedDB load failed; using legacy storage:', error);
        return Object.fromEntries(keys.map((key) => [key, readLocalJSON(key)]));
    }
}

function saveLargeValue(key, value) {
    const worker = createPersistenceWorker();
    if (!worker) {
        writeLocalJSON(key, value);
        return;
    }
    try {
        worker.postMessage({ type: 'save', key, value });
    } catch (error) {
        console.error(`Could not queue ${key} for persistence:`, error);
        writeLocalJSON(key, value);
    }
}

function saveLargeValues(values) {
    const worker = createPersistenceWorker();
    if (!worker) {
        for (const [key, value] of Object.entries(values || {})) writeLocalJSON(key, value);
        return;
    }
    try {
        worker.postMessage({ type: 'save-many', values });
    } catch (error) {
        console.error('Could not queue values for persistence:', error);
        for (const [key, value] of Object.entries(values || {})) writeLocalJSON(key, value);
    }
}

export {
    LARGE_KEYS,
    loadLargeValues,
    readLocalJSON,
    readLocalString,
    saveLargeValue,
    saveLargeValues,
    writeLocalJSON,
    writeLocalString
};

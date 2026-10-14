const DB_NAME = "docnest-annotator";
const DB_VERSION = 1;
const DOCS = "docs";
const FILES = "files";

let dbPromise = null;
const memory = { docs: new Map(), files: new Map(), active: false };

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(name, mode, run) {
  if (memory.active) return run(null);
  try {
    const db = await openDb();
    const store = db.transaction(name, mode).objectStore(name);
    return await run(store);
  } catch (error) {
    memory.active = true;
    return run(null);
  }
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function listDocs() {
  return withStore(DOCS, "readonly", (store) => {
    if (!store) return [...memory.docs.values()].sort((a, b) => b.updated.localeCompare(a.updated));
    return requestAsPromise(store.getAll()).then((docs) =>
      docs.sort((a, b) => b.updated.localeCompare(a.updated))
    );
  });
}

export async function getDoc(id) {
  return withStore(DOCS, "readonly", (store) => {
    if (!store) return memory.docs.get(id) || null;
    return requestAsPromise(store.get(id));
  });
}

export async function saveDoc(doc) {
  doc.updated = new Date().toISOString();
  return withStore(DOCS, "readwrite", (store) => {
    if (!store) {
      memory.docs.set(doc.id, structuredClone(doc));
      return true;
    }
    return requestAsPromise(store.put(structuredClone(doc))).then(() => true);
  });
}

export async function deleteDoc(id) {
  await withStore(DOCS, "readwrite", (store) => {
    if (!store) {
      memory.docs.delete(id);
      return true;
    }
    return requestAsPromise(store.delete(id)).then(() => true);
  });
  await withStore(FILES, "readwrite", (store) => {
    if (!store) {
      memory.files.delete(id);
      return true;
    }
    return requestAsPromise(store.delete(id)).then(() => true);
  });
  return true;
}

export async function putFile(id, blob) {
  return withStore(FILES, "readwrite", (store) => {
    if (!store) {
      memory.files.set(id, blob);
      return true;
    }
    return requestAsPromise(store.put({ id, blob })).then(() => true);
  });
}

export async function getFile(id) {
  return withStore(FILES, "readonly", (store) => {
    if (!store) return memory.files.get(id) || null;
    return requestAsPromise(store.get(id)).then((record) => (record ? record.blob : null));
  });
}

export async function exportDoc(doc, blob) {
  const payload = structuredClone(doc);
  if (blob) {
    payload.file = {
      name: doc.fileName || "source",
      type: blob.type || "application/pdf",
      data: bytesToBase64(await blob.arrayBuffer()),
    };
  }
  const name = `${(doc.name || "docnest").replace(/[^\w.-]+/g, "-")}.docnest.json`;
  download(name, new Blob([JSON.stringify(payload)], { type: "application/json" }));
}

export async function importDoc(file) {
  const parsed = JSON.parse(await file.text());
  if (!parsed || !Array.isArray(parsed.pages)) throw new Error("Not a valid DocNest annotation file");
  parsed.id = parsed.id || `doc-${Date.now()}`;
  parsed.created = parsed.created || new Date().toISOString();
  parsed.updated = new Date().toISOString();
  if (parsed.file && parsed.file.data) {
    const bytes = base64ToBytes(parsed.file.data);
    const blob = new Blob([bytes], { type: parsed.file.type || "application/pdf" });
    parsed.fileName = parsed.file.name;
    parsed.fileType = parsed.file.type;
    await putFile(parsed.id, blob);
    delete parsed.file;
  }
  await saveDoc(parsed);
  return parsed;
}

import type { FeedWorkspace } from "./types";

const DATABASE = "serga-studio-demo";
const LEGACY_DATABASE = "social-studio-demo";
const STORE = "workspace";
let connection: Promise<IDBDatabase> | undefined;

function openDatabase() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        connection = undefined;
        reject(new Error("Feche outras abas do simulador e tente novamente."));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
    });
  }
  return connection;
}

async function loadLegacyWorkspace(): Promise<FeedWorkspace | undefined> {
  const databases = await indexedDB.databases();
  if (!databases.some((database) => database.name === LEGACY_DATABASE)) {
    return undefined;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DATABASE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.close();
        resolve(undefined);
        return;
      }
      const transaction = database.transaction(STORE, "readonly");
      const workspace = transaction.objectStore(STORE).get("current");
      transaction.oncomplete = () => {
        database.close();
        resolve(workspace.result as FeedWorkspace | undefined);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

export async function loadWorkspace(): Promise<FeedWorkspace | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get("current");
    request.onsuccess = () => {
      if (request.result !== undefined) {
        resolve(request.result as FeedWorkspace);
        return;
      }
      void loadLegacyWorkspace()
        .then(async (workspace) => {
          if (workspace) {
            await saveWorkspace(workspace);
          }
          resolve(workspace);
        })
        .catch(reject);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveWorkspace(workspace: FeedWorkspace): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(workspace, "current");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Não foi possível salvar."));
  });
}

export async function readImage(
  file: File,
  maxDimension = 1600,
): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use imagens JPG, PNG ou WebP.");
  }
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Cada imagem pode ter até 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const factor = Math.min(
      1,
      maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Não foi possível preparar a imagem neste navegador.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let optimized = canvas.toDataURL("image/webp", 0.86);
    for (const quality of [0.76, 0.66, 0.56]) {
      if (
        Math.ceil((optimized.split(",")[1].length * 3) / 4) <=
        5 * 1024 * 1024
      )
        break;
      optimized = canvas.toDataURL("image/webp", quality);
    }
    if (Math.ceil((optimized.split(",")[1].length * 3) / 4) > 5 * 1024 * 1024)
      throw new Error("Não foi possível reduzir esta imagem para 5 MB.");
    return optimized;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Não foi"))
      throw error;
    throw new Error(
      "Não foi possível abrir essa imagem. Escolha outro arquivo.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function normalizeWebsite(raw: string): string | undefined {
  if (!raw.trim()) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
    return ["https:", "http:"].includes(url.protocol) &&
      url.hostname.includes(".")
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

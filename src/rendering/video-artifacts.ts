import type { EngineRequestContextV1 } from "../engines/contracts";

export interface VideoArtifact extends EngineRequestContextV1 {
  filename: string;
  file: Blob;
  createdAt: number;
  duration: number;
  width: number;
  height: number;
}
const STORE = "last-successful-video";
const artifactKey = (context: Pick<EngineRequestContextV1, "projectId" | "sceneId">) => JSON.stringify([context.projectId, context.sceneId]);

/** A success signal is insufficient: require nonempty MP4 bytes and decodable video. */
export async function validateVideo(file: Blob, signal?: AbortSignal, timeoutMs = 15_000): Promise<Pick<VideoArtifact, "duration" | "width" | "height">> {
  signal?.throwIfAborted();
  if (!(file instanceof Blob) || file.size < 12 || file.size > 512 * 1024 * 1024) throw new Error("Результат экспорта отсутствует, пуст или превышает 512 МБ.");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...header.slice(4, 8)) !== "ftyp") throw new Error("Результат экспорта не является MP4-видео.");
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      video.onloadeddata = video.onerror = null;
      const metadata = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(metadata);
    };
    const abort = () => finish(signal?.reason instanceof Error ? signal.reason : new DOMException("Проверка видео отменена.", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Не удалось проверить видео: декодирование превысило время ожидания.")), timeoutMs);
    video.onerror = () => finish(new Error("Экспорт завершился, но браузер не может декодировать выходное видео."));
    video.onloadeddata = () => finish(Number.isFinite(video.duration) && video.duration > 0 && video.videoWidth > 0 && video.videoHeight > 0 ? undefined : new Error("Выходное видео не содержит корректной видеодорожки."));
    signal?.addEventListener("abort", abort, { once: true });
    video.preload = "auto"; video.muted = true; video.src = url;
    if (signal?.aborted) abort();
  });
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open("arhimed-render-artifacts-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => { if (blocked) { request.result.close(); return; } request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть хранилище видео."));
    request.onblocked = () => { blocked = true; reject(new Error("Хранилище видео заблокировано другой вкладкой.")); };
  });
}
export async function lastSuccessfulVideo(context: Pick<EngineRequestContextV1, "projectId" | "sceneId">): Promise<VideoArtifact | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(artifactKey(context));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export async function saveSuccessfulVideo(context: EngineRequestContextV1, filename: string, file: Blob, signal: AbortSignal): Promise<VideoArtifact> {
  const metadata = await validateVideo(file, signal);
  const db = await database();
  try { signal.throwIfAborted(); } catch (error) { db.close(); throw error; }
  const artifact: VideoArtifact = { ...context, filename, file, createdAt: Date.now(), ...metadata };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const abort = () => { try { tx.abort(); } catch { /* transaction already finished */ } };
    signal.addEventListener("abort", abort, { once: true });
    tx.objectStore(STORE).put(artifact, artifactKey(context));
    tx.oncomplete = () => { signal.removeEventListener("abort", abort); db.close(); resolve(artifact); };
    tx.onabort = tx.onerror = () => {
      signal.removeEventListener("abort", abort); db.close();
      reject(signal.aborted ? signal.reason : new Error(`Не удалось сохранить видео: ${tx.error?.message ?? "ошибка IndexedDB"}. Предыдущее успешное видео сохранено.`));
    };
  });
}
export function downloadVideoArtifact(artifact: Pick<VideoArtifact, "file" | "filename">) {
  const url = URL.createObjectURL(artifact.file);
  const link = document.createElement("a"); link.href = url; link.download = artifact.filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

import {
  ENGINE_ADAPTER_V1,
  type EngineAdapterV1,
  type EngineEventV1,
  type EngineMetadataV1,
  type EngineRequestContextV1,
  type EngineResult,
  type EngineSceneV1,
  type EngineSessionV1,
  unsupported,
} from "./contracts";

const PROTOCOL = "arhimed-runtime-v1";
/** Kept in lockstep with the isolated runtime; enough for a full authored lesson. */
const MAX_SOURCE_BYTES = 262_144;
const RUNTIME_URL = "https://arhimed-runtime.github.io/cross-origin-runtime.html";

interface RuntimeMessage {
  protocol?: string;
  sessionId?: string;
  revision?: number;
  requestId?: string;
  kind?: "ready" | "status" | "rendered" | "stopped" | "failed" | "rejected" | "export-progress" | "exported";
  detail?: string;
  /** Only present on `ready` and is deliberately capability-based for older runtimes. */
  capabilities?: { mp4Export?: boolean };
  /** A transferable MP4 file sent only in response to an authenticated export request. */
  data?: ArrayBuffer | Uint8Array | Blob;
  progress?: number;
}

interface PendingExport {
  resolve: (file: Blob) => void;
  reject: (reason: Error) => void;
  onProgress: (value: number) => void;
  timeout: number;
}

export interface ManimGXMp4ExportOptions {
  fps?: number;
  onProgress: (value: number) => void;
}

const MAX_EXPORT_BYTES = 512 * 1024 * 1024;
const MP4_EXPORT_TIMEOUT_MS = 5 * 60_000;

export interface ManimGXBrowserSessionV1 extends EngineSessionV1 {
  iframe: HTMLIFrameElement;
  port: MessagePort;
  revision: number;
  ready: Promise<void>;
  supportsMp4Export: boolean;
  /** The newest requested load, including calls waiting for initial runtime authentication. */
  requestSerial: number;
  /** The source revision actually sent to the runtime; never use the creation-time context for events. */
  activeContext?: EngineRequestContextV1;
  exports: Map<string, PendingExport>;
  disposed: boolean;
}

function isMp4(bytes: Uint8Array): boolean {
  // ISO BMFF starts with a box size followed by the `ftyp` brand marker.
  return bytes.byteLength >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
}

async function mp4Blob(data: RuntimeMessage["data"]): Promise<Blob> {
  if (data instanceof Blob && data.size > MAX_EXPORT_BYTES) throw new Error("MP4-файл превышает лимит экспорта 512 МБ.");
  const bytes = data instanceof Blob
    ? new Uint8Array(await data.arrayBuffer())
    : data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : data instanceof Uint8Array
        ? data
        : undefined;
  if (!bytes || !isMp4(bytes)) throw new Error("Изолированный runtime вернул некорректный MP4-файл.");
  if (bytes.byteLength > MAX_EXPORT_BYTES) throw new Error("MP4-файл превышает лимит экспорта 512 МБ.");
  // Copy into an ArrayBuffer-backed view: a transferred buffer may otherwise be a SharedArrayBuffer,
  // which the DOM Blob typing (correctly) does not accept as a BlobPart.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "video/mp4" });
}

/**
 * This adapter is deliberately not registered by default. Enabling it requires a Studio feature
 * decision after the Stage 1 runtime URL and CSP are available. It transfers only source code,
 * never projects, storage, LLM settings, API keys, or arbitrary resource URLs.
 */
export class ManimGXBrowserAdapterV1 implements EngineAdapterV1<ManimGXBrowserSessionV1, void> {
  readonly metadata: EngineMetadataV1 = {
    engineId: "manimgx-browser",
    adapterVersion: ENGINE_ADAPTER_V1,
    runtimeVersion: "manimgx-0.1.1-pyodide-v314.0.7-policy-v2",
    languages: ["python"],
    dialects: ["manimgx-0.1.1"],
    capabilities: {
      playback: true, seek: false, timeline: false, executeBlock: false, modelParameters: false, snapshot: false, export: false,
      publicationModes: ["browser", "video"],
    },
  };

  constructor(private readonly enabled = false, private readonly runtimeUrl = RUNTIME_URL) {}

  async probe(): Promise<EngineResult<{ available: boolean; detail?: string }>> {
    if (!this.enabled) return { ok: true, value: { available: false, detail: "ManimGX browser adapter is disabled by default." } };
    return { ok: true, value: { available: typeof window !== "undefined", detail: "Requires the accepted cross-origin runtime." } };
  }

  async createSession(context: EngineRequestContextV1, onEvent: (event: EngineEventV1) => void): Promise<EngineResult<ManimGXBrowserSessionV1>> {
    if (!this.enabled) return { ok: false, reason: "unavailable", message: "ManimGX browser adapter is disabled by default." };
    if (typeof document === "undefined") return { ok: false, reason: "unavailable", message: "Browser document is unavailable." };
    const origin = new URL(this.runtimeUrl).origin;
    const iframe = document.createElement("iframe");
    iframe.src = this.runtimeUrl;
    iframe.sandbox.add("allow-scripts", "allow-same-origin");
    // The runtime remains cross-origin and sandboxed.  The explicit Permissions Policy and
    // boolean allowFullscreen only delegate the user-initiated fullscreen capability to the
    // embedded player; they do not grant it access to Studio's origin or storage.
    iframe.allow = "webgpu; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "no-referrer";
    iframe.setAttribute("aria-label", "Isolated ManimGX runtime");
    iframe.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0";
    document.body.append(iframe);
    const channel = new MessageChannel();
    const sessionId = crypto.randomUUID();
    let resolveReady: () => void = () => undefined;
    let rejectReady: (error: Error) => void = () => undefined;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const timer = window.setTimeout(() => rejectReady(new Error("ManimGX runtime did not authenticate within 12 seconds.")), 12_000);
    const session: ManimGXBrowserSessionV1 = {
      id: sessionId,
      engineId: "manimgx-browser",
      iframe,
      port: channel.port1,
      revision: 0,
      ready,
      supportsMp4Export: false,
      requestSerial: 0,
      exports: new Map(),
      disposed: false,
      dispose: async () => {
        session.disposed = true;
        window.clearTimeout(timer);
        for (const pending of session.exports.values()) {
          window.clearTimeout(pending.timeout);
          pending.reject(new Error("Экспорт MP4 отменён: сессия ManimGX закрыта."));
        }
        session.exports.clear();
        channel.port1.close();
        iframe.remove();
      },
    };
    channel.port1.onmessage = ({ data }) => {
      const message = data as RuntimeMessage;
      if (message.protocol !== PROTOCOL || message.sessionId !== sessionId || typeof message.revision !== "number") return;
      if (session.disposed) return;
      if (message.kind === "ready") {
        if (message.revision !== 0 || message.requestId !== "connect") return;
        session.supportsMp4Export = message.capabilities?.mp4Export === true;
        window.clearTimeout(timer);
        resolveReady();
        return;
      }
      if (message.revision !== session.revision || !message.requestId) return;
      const pendingExport = session.exports.get(message.requestId);
      if (message.kind === "export-progress" && pendingExport) {
        pendingExport.onProgress(Math.max(0, Math.min(1, Number(message.progress) || 0)));
        return;
      }
      if (message.kind === "exported" && pendingExport) {
        session.exports.delete(message.requestId);
        window.clearTimeout(pendingExport.timeout);
        void mp4Blob(message.data).then(pendingExport.resolve, pendingExport.reject);
        return;
      }
      if (message.kind === "failed" || message.kind === "rejected") {
        if (pendingExport) {
          session.exports.delete(message.requestId);
          window.clearTimeout(pendingExport.timeout);
          pendingExport.reject(new Error(message.detail ?? "ManimGX не смог сформировать MP4-файл."));
          return;
        }
        if (session.activeContext?.requestId === message.requestId) {
          onEvent({ ...session.activeContext, type: "diagnostic", severity: "error", message: message.detail ?? "ManimGX runtime failed." });
        }
      } else if (session.activeContext?.requestId === message.requestId) {
        const current = session.activeContext;
        if (message.kind === "rendered") onEvent({ ...current, type: "result", result: "rendered", detail: message.detail });
        else if (message.kind === "stopped") onEvent({ ...current, type: "state", state: "stopped" });
      }
    };
    iframe.addEventListener("load", () => {
      if (!iframe.contentWindow || session.disposed) return;
      iframe.contentWindow.postMessage({ protocol: PROTOCOL, kind: "connect", sessionId }, origin, [channel.port2]);
    }, { once: true });
    onEvent({ ...context, type: "state", state: "loading" });
    return { ok: true, value: session };
  }

  async loadScene(session: ManimGXBrowserSessionV1, context: EngineRequestContextV1, scene: EngineSceneV1): Promise<EngineResult<void>> {
    if (session.disposed) return { ok: false, reason: "unavailable", message: "ManimGX session has been disposed." };
    if (scene.language !== "python" || scene.dialect !== "manimgx-0.1.1") return { ok: false, reason: "invalid-source", message: "ManimGX runtime accepts the manimgx-0.1.1 dialect only." };
    if (new TextEncoder().encode(scene.source).byteLength > MAX_SOURCE_BYTES) return { ok: false, reason: "invalid-source", message: "Scene source exceeds the 256 KiB runtime limit." };
    const serial = ++session.requestSerial;
    try { await session.ready; } catch (error) { await session.dispose(); return { ok: false, reason: "unavailable", message: error instanceof Error ? error.message : String(error) }; }
    if (session.disposed || serial !== session.requestSerial) {
      return { ok: false, reason: "unavailable", message: "Этот запуск ManimGX заменён более новой версией сцены." };
    }
    for (const pending of session.exports.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error("Экспорт отменён: исходник сцены изменился."));
    }
    session.exports.clear();
    session.activeContext = context;
    session.revision += 1;
    session.port.postMessage({ protocol: PROTOCOL, sessionId: session.id, revision: session.revision, requestId: context.requestId, kind: "run", source: scene.source });
    return { ok: true, value: undefined };
  }

  async stop(session: ManimGXBrowserSessionV1, context: EngineRequestContextV1): Promise<EngineResult<void>> {
    if (session.disposed) return { ok: true, value: undefined };
    ++session.requestSerial;
    await session.ready.catch(() => undefined);
    if (session.disposed) return { ok: true, value: undefined };
    session.activeContext = context;
    session.revision += 1;
    session.port.postMessage({ protocol: PROTOCOL, sessionId: session.id, revision: session.revision, requestId: context.requestId, kind: "cancel" });
    return { ok: true, value: undefined };
  }

  /**
   * MP4 is encoded inside the cross-origin runtime, not by recording the iframe in Studio.
   * That keeps the sandbox boundary intact and avoids a misleading .mp4 extension on WebM data.
   */
  async exportMp4(session: ManimGXBrowserSessionV1, context: EngineRequestContextV1, options: ManimGXMp4ExportOptions): Promise<Blob> {
    if (session.disposed) throw new Error("Сессия ManimGX уже закрыта.");
    await session.ready;
    if (!session.supportsMp4Export) {
      throw new Error("Подключённый ManimGX runtime ещё не поддерживает экспорт MP4. Обновите runtime до версии с протоколом export-mp4.");
    }
    const requestId = context.requestId;
    if (session.exports.has(requestId)) throw new Error("Экспорт MP4 уже выполняется.");
    return new Promise<Blob>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        const pending = session.exports.get(requestId);
        if (!pending) return;
        session.exports.delete(requestId);
        reject(new Error("ManimGX не сформировал MP4 за отведённое время."));
      }, MP4_EXPORT_TIMEOUT_MS);
      session.exports.set(requestId, { resolve, reject, onProgress: options.onProgress, timeout });
      // The runtime owns the rendered canvas and returns a transferable MP4 byte buffer.
      // Source code is not resent here; this command exports the currently rendered revision.
      session.port.postMessage({
        protocol: PROTOCOL,
        sessionId: session.id,
        revision: session.revision,
        requestId,
        kind: "export-mp4",
        fps: options.fps ?? 30,
      });
    });
  }

  unsupported<T>(_context: EngineRequestContextV1, operation: string): EngineResult<T> { return unsupported(operation); }
}

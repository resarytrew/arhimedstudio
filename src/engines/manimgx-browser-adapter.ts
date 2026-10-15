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
const MAX_SOURCE_BYTES = 16_384;
const RUNTIME_URL = "https://arhimed-runtime.github.io/cross-origin-runtime.html";

interface RuntimeMessage {
  protocol?: string;
  sessionId?: string;
  revision?: number;
  requestId?: string;
  kind?: "ready" | "status" | "rendered" | "stopped" | "failed" | "rejected";
  detail?: string;
}

export interface ManimGXBrowserSessionV1 extends EngineSessionV1 {
  iframe: HTMLIFrameElement;
  port: MessagePort;
  revision: number;
  ready: Promise<void>;
  disposed: boolean;
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
    runtimeVersion: "manimgx-0.1.1-pyodide-v314.0.7",
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
      disposed: false,
      dispose: async () => {
        session.disposed = true;
        window.clearTimeout(timer);
        channel.port1.close();
        iframe.remove();
      },
    };
    channel.port1.onmessage = ({ data }) => {
      const message = data as RuntimeMessage;
      if (message.protocol !== PROTOCOL || message.sessionId !== sessionId || typeof message.revision !== "number") return;
      if (message.kind === "ready") { window.clearTimeout(timer); resolveReady(); return; }
      if (message.revision !== session.revision || !message.requestId) return;
      if (message.kind === "failed" || message.kind === "rejected") {
        onEvent({ ...context, type: "diagnostic", severity: "error", message: message.detail ?? "ManimGX runtime failed." });
      } else if (message.kind === "rendered") {
        onEvent({ ...context, type: "result", result: "rendered", detail: message.detail });
      } else if (message.kind === "stopped") {
        onEvent({ ...context, type: "state", state: "stopped" });
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
    if (new TextEncoder().encode(scene.source).byteLength > MAX_SOURCE_BYTES) return { ok: false, reason: "invalid-source", message: "Scene source exceeds the 16 KiB runtime limit." };
    try { await session.ready; } catch (error) { await session.dispose(); return { ok: false, reason: "unavailable", message: error instanceof Error ? error.message : String(error) }; }
    session.revision += 1;
    session.port.postMessage({ protocol: PROTOCOL, sessionId: session.id, revision: session.revision, requestId: context.requestId, kind: "run", source: scene.source });
    return { ok: true, value: undefined };
  }

  async stop(session: ManimGXBrowserSessionV1, context: EngineRequestContextV1): Promise<EngineResult<void>> {
    if (session.disposed) return { ok: true, value: undefined };
    session.revision += 1;
    session.port.postMessage({ protocol: PROTOCOL, sessionId: session.id, revision: session.revision, requestId: context.requestId, kind: "cancel" });
    return { ok: true, value: undefined };
  }

  unsupported<T>(_context: EngineRequestContextV1, operation: string): EngineResult<T> { return unsupported(operation); }
}

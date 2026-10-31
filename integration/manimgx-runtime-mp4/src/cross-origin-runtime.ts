import "manimgx-locked";
import { settings } from "manimgx-locked";
import { CROSS_ORIGIN_MAX_SOURCE_BYTES, CROSS_ORIGIN_PROTOCOL, type RuntimeCommand, type RuntimeEvent } from "./cross-origin-protocol";
import "./sandbox.css";
import { exportManimGXMp4 } from "./mp4-export";

const status = document.querySelector<HTMLOutputElement>("#status")!;
const root = document.querySelector<HTMLElement>("#player-root")!;
const allowedParents = new Set(["http://127.0.0.1:4184", "https://resarytrew.github.io"]);
const simulatedNoWebGpu = new URLSearchParams(location.search).get("simulateNoWebGpu") === "1";
let port: MessagePort | undefined;
let sessionId = "";
let revision = 0;
let active: HTMLElement | undefined;
let renderedRevision = 0;
let exportAbort: AbortController | undefined;
let watchTimer: number | undefined;

// The patched v0.1.1 director receives this as its immutable asset base. It derives all
// package URLs from here, and never sends a package name to a resolver.
settings.pyodide = new URL("./runtime-assets/pyodide/", window.location.href).href;
settings.manimgx = "manimgx==0.1.1";
if (simulatedNoWebGpu) Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });

function reply(command: Pick<RuntimeCommand, "requestId" | "revision">, kind: RuntimeEvent["kind"], detail: string, data?: RuntimeEvent["data"]) {
  port?.postMessage({ protocol: CROSS_ORIGIN_PROTOCOL, sessionId, revision: command.revision, requestId: command.requestId, kind, detail, data } satisfies RuntimeEvent);
}

async function probe() {
  const report: Record<string, boolean | number | string | null> = { webgpuPresent: typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined" };
  try { report.parentDomBlocked = parent.document.documentElement.dataset.crossOriginControl !== "PARENT_DOM_ONLY_9bc1"; } catch { report.parentDomBlocked = true; }
  try { report.parentStorageBlocked = parent.localStorage.getItem("arhimed-cross-origin-control") !== "PARENT_LOCAL_STORAGE_ONLY_9bc1"; } catch { report.parentStorageBlocked = true; }
  try { report.parentOpenRouterKeyBlocked = parent.localStorage.getItem("arhimed-openrouter-key") !== "SYNTHETIC_OPENROUTER_KEY_NEVER_SENT_9bc1"; } catch { report.parentOpenRouterKeyBlocked = true; }
  try { report.parentIndexedDbBlocked = parent.indexedDB !== undefined; } catch { report.parentIndexedDbBlocked = true; }
  try {
    const worker = new Worker(URL.createObjectURL(new Blob(["postMessage('module worker ok')"], { type: "text/javascript" })), { type: "module" });
    report.moduleWorkerStarted = await new Promise<boolean>((resolve) => { worker.onmessage = () => { worker.terminate(); resolve(true); }; worker.onerror = () => resolve(false); });
  } catch { report.moduleWorkerStarted = false; }
  try {
    const worker = new Worker(URL.createObjectURL(new Blob(["fetch('https://example.invalid/').then(() => postMessage(false)).catch(() => postMessage(true))"], { type: "text/javascript" })), { type: "module" });
    report.workerEgressBlocked = await new Promise<boolean>((resolve) => {
      worker.onmessage = ({ data }) => { worker.terminate(); resolve(data === true); };
      worker.onerror = () => { worker.terminate(); resolve(true); };
    });
  } catch { report.workerEgressBlocked = true; }
  try { await fetch("http://127.0.0.1:9/"); report.localhostBlocked = false; } catch { report.localhostBlocked = true; }
  try { await fetch("https://example.invalid/"); report.egressBlocked = false; } catch { report.egressBlocked = true; }
  return report;
}

function watch(command: RuntimeCommand) {
  const watchedPlayer = active;
  const started = performance.now();
  if (watchTimer !== undefined) window.clearInterval(watchTimer);
  const timer = window.setInterval(() => {
    if (active !== watchedPlayer || revision !== command.revision) {
      window.clearInterval(timer);
      return;
    }
    const message = active?.shadowRoot?.querySelector("p")?.textContent ?? "";
    if (/could not start|can't draw/i.test(message)) {
      window.clearInterval(timer);
      reply(command, "failed", `ManimGX failed after ${Math.round(performance.now() - started)} ms: ${message}`);
      return;
    }
    const canvas = active?.shadowRoot?.querySelector("canvas") as HTMLCanvasElement | null;
    const player = active as (HTMLElement & { duration?: number }) | undefined;
    if (canvas && !message && canvas.width > 0 && canvas.height > 0 && Number.isFinite(player?.duration)) {
      window.clearInterval(timer);
      renderedRevision = command.revision;
      reply(command, "rendered", `WebGPU player reported a rendered scene in ${Math.round(performance.now() - started)} ms.`, { canvasWidth: canvas.width, canvasHeight: canvas.height, duration: player?.duration ?? null });
    }
  }, 50);
  watchTimer = timer;
}

function handle(command: RuntimeCommand) {
  if (command.protocol !== CROSS_ORIGIN_PROTOCOL || command.sessionId !== sessionId || !Number.isSafeInteger(command.revision) || !command.requestId) return;
  // Export operates on the currently rendered revision. It is not a source update.
  if (command.kind === "export-mp4") {
    if (command.revision !== revision || renderedRevision !== revision || !active) {
      reply(command, "rejected", "Wait for the current ManimGX scene to finish rendering.");
      return;
    }
    if (exportAbort) {
      reply(command, "rejected", "Another MP4 export is already active.");
      return;
    }
    const player = active;
    const controller = new AbortController();
    exportAbort = controller;
    void (async () => {
      try {
        const data = await exportManimGXMp4(player, {
          fps: command.fps ?? 30,
          signal: controller.signal,
          onProgress(value) {
            if (revision !== command.revision || active !== player || controller.signal.aborted) return;
            port?.postMessage({
              protocol: CROSS_ORIGIN_PROTOCOL, sessionId,
              revision: command.revision, requestId: command.requestId,
              kind: "export-progress", detail: "Encoding ManimGX frames.", progress: value,
            } satisfies RuntimeEvent);
          },
        });
        if (controller.signal.aborted || active !== player || revision !== command.revision) return;
        port?.postMessage({
          protocol: CROSS_ORIGIN_PROTOCOL, sessionId,
          revision: command.revision, requestId: command.requestId,
          kind: "exported", detail: "H.264 MP4 export complete.", data,
        } satisfies RuntimeEvent, [data]);
      } catch (error) {
        if (!controller.signal.aborted && active === player && revision === command.revision) {
          reply(command, "failed", error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (exportAbort === controller) exportAbort = undefined;
      }
    })();
    return;
  }
  if (command.revision <= revision) return;
  // New commands invalidate a previous export and any previous rendered revision.
  exportAbort?.abort();
  renderedRevision = 0;
  revision = command.revision;
  if (command.kind === "probe") { void probe().then((data) => reply(command, "probe", "Cross-origin isolation probes completed.", data)); return; }
  if (command.kind === "cancel") {
    if (watchTimer !== undefined) window.clearInterval(watchTimer);
    active?.remove();
    active = undefined;
    status.textContent = "Player context removed by authenticated parent command.";
    reply(command, "stopped", status.textContent);
    return;
  }
  if (typeof command.source !== "string" || new TextEncoder().encode(command.source).byteLength > CROSS_ORIGIN_MAX_SOURCE_BYTES) {
    reply(command, "rejected", "Source exceeds the 256 KiB fixed-runtime limit.");
    return;
  }
  if (watchTimer !== undefined) window.clearInterval(watchTimer);
  active?.remove();
  active = document.createElement("manimgx-player");
  active.setAttribute("autoplay", "");
  (active as HTMLElement & { source: string }).source = command.source;
  root.append(active);
  status.textContent = `ManimGX ${command.label ?? "scene"} boot requested.`;
  reply(command, "status", status.textContent);
  watch(command);
}

window.addEventListener("message", (message) => {
  const connect = message.data as { protocol?: string; kind?: string; sessionId?: string };
  if (connect.protocol !== CROSS_ORIGIN_PROTOCOL || connect.kind !== "connect" || typeof connect.sessionId !== "string" || !allowedParents.has(message.origin) || message.source !== parent || message.ports.length !== 1 || port) return;
  sessionId = connect.sessionId;
  port = message.ports[0];
  port.onmessage = ({ data }) => handle(data as RuntimeCommand);
  port.start();
  // Only advertise MP4 when this browser can encode H.264. Older browsers keep
  // ManimGX playback but Studio leaves the MP4 button disabled.
  void (async () => {
    let mp4Export = false;
    if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
      for (const codec of ["avc1.640028", "avc1.4d4028", "avc1.42001f"]) {
        try {
          const result = await VideoEncoder.isConfigSupported({
            codec, width: 1280, height: 720, framerate: 30,
            bitrate: 8_000_000,
          });
          if (result.supported) { mp4Export = true; break; }
        } catch { /* unsupported encoder profile */ }
      }
    }
    port?.postMessage({
      protocol: CROSS_ORIGIN_PROTOCOL, sessionId, revision: 0,
      requestId: "connect", kind: "ready",
      detail: "Authenticated MessageChannel connected.",
      capabilities: { mp4Export },
    } satisfies RuntimeEvent);
  })();
});

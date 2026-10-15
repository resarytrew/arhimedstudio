import { runScript, ScriptError, type Timeline } from "../engine/interpreter";
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

export interface CanvasSessionV1 extends EngineSessionV1 {
  timeline: Timeline | null;
  disposed: boolean;
  onEvent: (event: EngineEventV1) => void;
}

const canvasCapabilities = {
  playback: true,
  seek: true,
  timeline: true,
  executeBlock: false,
  modelParameters: false,
  snapshot: true,
  export: true,
  publicationModes: ["browser", "video"] as const,
};

export class ArhimedCanvasAdapterV1 implements EngineAdapterV1<CanvasSessionV1, Timeline> {
  readonly metadata: EngineMetadataV1 = {
    engineId: "arhimed-canvas",
    adapterVersion: ENGINE_ADAPTER_V1,
    runtimeVersion: "canvas-interpreter-v1",
    languages: ["python"],
    dialects: ["arhimed-manimx-v1"],
    capabilities: canvasCapabilities,
  };

  async probe(): Promise<EngineResult<{ available: boolean; detail?: string }>> {
    return { ok: true, value: { available: typeof document !== "undefined", detail: "Canvas interpreter is bundled with Studio." } };
  }

  async createSession(context: EngineRequestContextV1, onEvent: (event: EngineEventV1) => void): Promise<EngineResult<CanvasSessionV1>> {
    onEvent({ ...context, type: "state", state: "loading" });
    const session: CanvasSessionV1 = {
      id: `canvas-${context.requestId}`,
      engineId: "arhimed-canvas",
      timeline: null,
      disposed: false,
      onEvent,
      dispose: async () => {
        session.disposed = true;
        session.timeline = null;
      },
    };
    onEvent({ ...context, type: "state", state: "ready" });
    return { ok: true, value: session };
  }

  async loadScene(session: CanvasSessionV1, context: EngineRequestContextV1, scene: EngineSceneV1): Promise<EngineResult<Timeline>> {
    if (session.disposed) return { ok: false, reason: "unavailable", message: "Canvas session has been disposed." };
    if (scene.language !== "python" || scene.dialect !== "arhimed-manimx-v1") {
      return { ok: false, reason: "invalid-source", message: "Canvas accepts Python in the arhimed-manimx-v1 dialect only." };
    }
    session.onEvent({ ...context, type: "state", state: "running" });
    try {
      const timeline = runScript(scene.source);
      session.timeline = timeline;
      session.onEvent({ ...context, type: "result", result: "loaded", detail: `${timeline.segments.length} timeline segments.` });
      session.onEvent({ ...context, type: "state", state: "ready" });
      return { ok: true, value: timeline };
    } catch (error) {
      const line = error instanceof ScriptError ? error.line : undefined;
      session.onEvent({ ...context, type: "diagnostic", severity: "error", message: error instanceof Error ? error.message : String(error), line });
      return { ok: false, reason: "failed", message: error instanceof Error ? error.message : String(error) };
    }
  }

  async stop(session: CanvasSessionV1, context: EngineRequestContextV1): Promise<EngineResult<void>> {
    session.timeline = null;
    return { ok: true, value: undefined };
  }

  unsupported<T>(_context: EngineRequestContextV1, operation: string): EngineResult<T> {
    return unsupported(operation);
  }
}

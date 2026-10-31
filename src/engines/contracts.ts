export const ENGINE_ADAPTER_V1 = "1" as const;

export type EngineId = "arhimed-canvas" | "manimgx-browser" | "manim-community" | "manimgl" | "javascript-model" | "declarative-model";

export interface EngineCapabilitiesV1 {
  playback: boolean;
  seek: boolean;
  timeline: boolean;
  executeBlock: boolean;
  modelParameters: boolean;
  snapshot: boolean;
  export: boolean;
  publicationModes: readonly ("browser" | "video" | "interactive")[];
}

export interface EngineMetadataV1 {
  engineId: EngineId;
  adapterVersion: typeof ENGINE_ADAPTER_V1;
  runtimeVersion: string;
  languages: readonly string[];
  dialects: readonly string[];
  capabilities: EngineCapabilitiesV1;
}

export interface EngineRequestContextV1 {
  projectId: string;
  sceneId: string;
  revision: string;
  requestId: string;
}

export type EngineEventV1 =
  | (EngineRequestContextV1 & { type: "log"; stream: "stdout" | "stderr"; text: string })
  | (EngineRequestContextV1 & { type: "state"; state: "idle" | "loading" | "ready" | "running" | "stopped" | "disposed" })
  | (EngineRequestContextV1 & { type: "diagnostic"; severity: "info" | "warning" | "error"; message: string; line?: number })
  | (EngineRequestContextV1 & { type: "progress"; value: number; detail?: string })
  | (EngineRequestContextV1 & { type: "result"; result: "loaded" | "rendered" | "stopped" | "unsupported"; detail?: string });

export type EngineResult<T> = { ok: true; value: T } | { ok: false; reason: "unsupported" | "unavailable" | "invalid-source" | "failed"; message: string };

export interface EngineSceneV1 {
  source: string;
  language: "python" | "typescript" | "javascript" | "json";
  dialect: string;
  entrypoint: string;
}

export interface EngineSessionV1 {
  id: string;
  engineId: EngineId;
  dispose(): Promise<void>;
}

export interface EngineAdapterV1<TSession extends EngineSessionV1 = EngineSessionV1, TLoaded = unknown> {
  readonly metadata: EngineMetadataV1;
  probe(): Promise<EngineResult<{ available: boolean; detail?: string }>>;
  createSession(context: EngineRequestContextV1, onEvent: (event: EngineEventV1) => void): Promise<EngineResult<TSession>>;
  loadScene(session: TSession, context: EngineRequestContextV1, scene: EngineSceneV1): Promise<EngineResult<TLoaded>>;
  stop(session: TSession, context: EngineRequestContextV1): Promise<EngineResult<void>>;
  unsupported<T>(context: EngineRequestContextV1, operation: string): EngineResult<T>;
}

export const unsupported = <T>(operation: string): EngineResult<T> => ({
  ok: false,
  reason: "unsupported",
  message: `Операция «${operation}» не поддерживается этим движком.`,
});

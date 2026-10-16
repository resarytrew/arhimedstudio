import { useEffect, useState } from "react";
import type { EngineId } from "../engines/contracts";
import type { AiCandidateValidationV1 } from "../ai/validation";
import { WELCOME_CODE } from "./templates";
import { DEFAULT_LLM_PREFERENCES, type LLMPreferences } from "./assistant";
import { emptyLessonPlan, emptyLessonProgress, type LessonPlan, type LessonProgress, type SecurityEvent, type TrustState } from "./lesson";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  code?: string;
  baseRevision?: string;
  candidateRevision?: string;
  validation?: AiCandidateValidationV1;
  ts: number;
  error?: boolean;
}

export interface SceneRevision {
  id: string;
  number: number;
  kind: "initial" | "manual" | "ai-candidate" | "accepted-ai";
  source: string;
  baseRevision?: string;
  createdAt: number;
  trustState?: TrustState;
  verifiedAt?: number;
  verificationDetail?: string;
}

export interface Scene {
  id: string;
  engineId: EngineId;
  engineVersion: string;
  language: "python" | "typescript" | "javascript" | "json";
  dialect: string;
  entrypoint: string;
  source: string;
  currentRevision: string;
  revisions: SceneRevision[];
  resources: { id: string; sha256: string }[];
}

export interface Project {
  schemaVersion: 2;
  id: string;
  title: string;
  /** Retained for the current Canvas editor and exports. It mirrors the active scene source. */
  code: string;
  messages: Message[];
  scenes: Scene[];
  activeSceneId: string;
  updatedAt: number;
  /** Optional fields keep all v2 projects backward compatible and local-first. */
  lesson?: LessonPlan;
  lessonProgress?: LessonProgress;
  securityLog?: SecurityEvent[];
}

interface LegacyProject {
  id: string;
  title: string;
  code: string;
  messages?: Message[];
  updatedAt?: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function initialScene(source: string, now = Date.now()): Scene {
  const revisionId = uid();
  return {
    id: uid(),
    engineId: "arhimed-canvas",
    engineVersion: "canvas-interpreter-v1",
    language: "python",
    dialect: "arhimed-manimx-v1",
    entrypoint: "Scene.construct",
    source,
    currentRevision: revisionId,
    revisions: [{ id: revisionId, number: 1, kind: "initial", source, createdAt: now, trustState: "draft" }],
    resources: [],
  };
}

/** A user-created project starts without a scene. The separately seeded demo keeps WELCOME_CODE. */
export function newProject(title = "Новое видео", code = ""): Project {
  const scene = initialScene(code);
  return { schemaVersion: 2, id: uid(), title, code, messages: [], scenes: [scene], activeSceneId: scene.id, updatedAt: Date.now(), lesson: emptyLessonPlan(), lessonProgress: emptyLessonProgress(), securityLog: [] };
}

export function activeScene(project: Project): Scene {
  return project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];
}

export function normalizeProject(value: Project | LegacyProject): Project {
  if ("schemaVersion" in value && value.schemaVersion === 2 && Array.isArray(value.scenes) && value.scenes.length > 0) {
    const scene = value.scenes.find((candidate) => candidate.id === value.activeSceneId) ?? value.scenes[0];
    return { ...value, code: scene.source, activeSceneId: scene.id, lesson: value.lesson ?? emptyLessonPlan(), lessonProgress: value.lessonProgress ?? emptyLessonProgress(), securityLog: value.securityLog ?? [] };
  }
  const legacy = value as LegacyProject;
  const scene = initialScene(legacy.code, legacy.updatedAt ?? Date.now());
  return {
    schemaVersion: 2,
    id: legacy.id,
    title: legacy.title,
    code: legacy.code,
    messages: legacy.messages ?? [],
    scenes: [scene],
    activeSceneId: scene.id,
    updatedAt: legacy.updatedAt ?? Date.now(), lesson: emptyLessonPlan(), lessonProgress: emptyLessonProgress(), securityLog: [],
  };
}

export function updateSceneSource(project: Project, source: string): Project {
  const scene = activeScene(project);
  if (scene.source === source) return project;
  const revision: SceneRevision = {
    id: uid(), number: scene.revisions.length + 1, kind: "manual", source, baseRevision: scene.currentRevision, createdAt: Date.now(), trustState: "draft",
  };
  const nextScene = { ...scene, source, currentRevision: revision.id, revisions: [...scene.revisions, revision] };
  return { ...project, code: source, scenes: project.scenes.map((candidate) => (candidate.id === scene.id ? nextScene : candidate)), updatedAt: Date.now() };
}

export function setActiveSceneEngine(project: Project, engineId: Extract<EngineId, "arhimed-canvas" | "manimgx-browser">): Project {
  const scene = activeScene(project);
  if (scene.engineId === engineId) return project;
  // Changing runtimes is never an implicit source conversion. Keep the existing scene and
  // start a new scene with an independent initial revision; the author can then write GX code
  // or invoke a future, explicitly reviewed conversion command.
  const now = Date.now();
  const revisionId = uid();
  const nextScene: Scene = engineId === "arhimed-canvas"
    ? { ...scene, id: uid(), engineId, engineVersion: "canvas-interpreter-v1", language: "python", dialect: "arhimed-manimx-v1", entrypoint: "Scene.construct", currentRevision: revisionId, revisions: [{ id: revisionId, number: 1, kind: "initial", source: scene.source, createdAt: now, trustState: "draft" }] }
    : { ...scene, id: uid(), engineId, engineVersion: "manimgx-0.1.1-pyodide-v314.0.7", language: "python", dialect: "manimgx-0.1.1", entrypoint: "Scene.construct", currentRevision: revisionId, revisions: [{ id: revisionId, number: 1, kind: "initial", source: scene.source, createdAt: now, trustState: "draft" }] };
  return { ...project, code: nextScene.source, scenes: [...project.scenes, nextScene], activeSceneId: nextScene.id, updatedAt: now };
}

export function addAiCandidate(project: Project, source: string, baseRevision: string, trustState: TrustState = "draft"): { project: Project; candidate: SceneRevision } {
  const scene = activeScene(project);
  const candidate: SceneRevision = {
    id: uid(), number: scene.revisions.length + 1, kind: "ai-candidate", source, baseRevision, createdAt: Date.now(), trustState,
  };
  const nextScene = { ...scene, revisions: [...scene.revisions, candidate] };
  return { project: { ...project, scenes: project.scenes.map((value) => (value.id === scene.id ? nextScene : value)), updatedAt: Date.now() }, candidate };
}

export function acceptAiCandidate(project: Project, candidateId: string): { project: Project; accepted: SceneRevision } | null {
  const scene = activeScene(project);
  const candidate = scene.revisions.find((revision) => revision.id === candidateId && revision.kind === "ai-candidate");
  if (!candidate || candidate.baseRevision !== scene.currentRevision) return null;
  const accepted: SceneRevision = {
    id: uid(), number: scene.revisions.length + 1, kind: "accepted-ai", source: candidate.source, baseRevision: candidate.baseRevision, createdAt: Date.now(), trustState: candidate.trustState ?? "draft", verifiedAt: candidate.verifiedAt, verificationDetail: candidate.verificationDetail,
  };
  const nextScene = { ...scene, source: candidate.source, currentRevision: accepted.id, revisions: [...scene.revisions, accepted] };
  return {
    accepted,
    project: { ...project, code: candidate.source, scenes: project.scenes.map((value) => (value.id === scene.id ? nextScene : value)), updatedAt: Date.now() },
  };
}

export function updateLesson(project: Project, lesson: LessonPlan, progress = project.lessonProgress ?? emptyLessonProgress()): Project {
  return { ...project, lesson, lessonProgress: progress, updatedAt: Date.now() };
}

export function addSecurityEvent(project: Project, type: SecurityEvent["type"], detail: string): Project {
  const event: SecurityEvent = { id: uid(), at: Date.now(), type, detail };
  return { ...project, securityLog: [...(project.securityLog ?? []), event].slice(-100), updatedAt: Date.now() };
}

export function clearSecurityLog(project: Project): Project {
  return { ...project, securityLog: [], updatedAt: Date.now() };
}

/** Runtime success changes only candidate metadata; it never applies its source. */
export function markRevisionRuntimeVerified(project: Project, revisionId: string, detail: string): Project {
  const scene = activeScene(project);
  const revisions = scene.revisions.map((revision) => revision.id === revisionId
    ? { ...revision, trustState: "runtime-verified" as const, verifiedAt: Date.now(), verificationDetail: detail }
    : revision);
  return { ...project, scenes: project.scenes.map((value) => value.id === scene.id ? { ...scene, revisions } : value), updatedAt: Date.now() };
}

/** Imported packages always receive fresh IDs and start as untrusted local copies. */
export function importProjectAsLocalCopy(value: Project): Project {
  const project = normalizeProject(value);
  const sceneIds = new Map(project.scenes.map((scene) => [scene.id, uid()]));
  const scenes = project.scenes.map((scene) => {
    const revisionIds = new Map(scene.revisions.map((revision) => [revision.id, uid()]));
    return {
      ...scene,
      id: sceneIds.get(scene.id)!,
      currentRevision: revisionIds.get(scene.currentRevision) ?? uid(),
      revisions: scene.revisions.map((revision) => ({ ...revision, id: revisionIds.get(revision.id)!, baseRevision: revision.baseRevision ? revisionIds.get(revision.baseRevision) : undefined, trustState: "untrusted-import" as const, verifiedAt: undefined, verificationDetail: undefined })),
    };
  });
  const activeSceneId = sceneIds.get(project.activeSceneId) ?? scenes[0].id;
  return { ...project, id: uid(), title: `${project.title} · восстановлено`, code: scenes.find((scene) => scene.id === activeSceneId)?.source ?? scenes[0].source, scenes, activeSceneId, updatedAt: Date.now(), securityLog: [] };
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function usePersistent<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => load(key, initial()));
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable or full */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export const LEGACY_PROJECTS_KEY = "arhimed.projects.v1";
export const PROJECTS_KEY = "arhimed.projects.v2";
export const ACTIVE_KEY = "arhimed.active.v2";
export const LEGACY_ACTIVE_KEY = "arhimed.active.v1";
export const THEME_KEY = "arhimed.theme.v1";
export const LLM_KEY = "arhimed.llm.v2";

export function initialProjects(): Project[] {
  const legacy = load<LegacyProject[]>(LEGACY_PROJECTS_KEY, []);
  return legacy.length ? legacy.map(normalizeProject) : [newProject("Пример видео", WELCOME_CODE)];
}

export function initialActiveProjectId(): string {
  return load<string>(LEGACY_ACTIVE_KEY, "");
}

export function initialLLM(): LLMPreferences {
  return { ...DEFAULT_LLM_PREFERENCES };
}

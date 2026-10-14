import { useEffect, useState } from "react";
import { WELCOME_CODE } from "./templates";
import { DEFAULT_LLM, type LLMSettings } from "./assistant";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  code?: string;
  ts: number;
  error?: boolean;
}

export interface Project {
  id: string;
  title: string;
  code: string;
  messages: Message[];
  updatedAt: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newProject(title = "Новое видео", code = WELCOME_CODE): Project {
  return { id: uid(), title, code, messages: [], updatedAt: Date.now() };
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function usePersistent<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => load(key, initial()));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export const PROJECTS_KEY = "arhimed.projects.v1";
export const ACTIVE_KEY = "arhimed.active.v1";
export const THEME_KEY = "arhimed.theme.v1";
export const LLM_KEY = "arhimed.llm.v1";

export function initialProjects(): Project[] {
  return [newProject("Пример видео")];
}
export function initialLLM(): LLMSettings {
  return { ...DEFAULT_LLM };
}

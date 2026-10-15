export type AiEngineId = "arhimed-canvas" | "manimgx-browser";

export interface AiEngineProfileV1 {
  id: AiEngineId;
  version: "1";
  instructions: string;
  /** A documented, non-exhaustive set of examples. It is not an allow-all parser. */
  allowedApi: readonly string[];
  repairRule: string;
}

const SHARED_RULES = `Ты — ИИ-помощник учителя в ArhimedStudio. Пиши короткие, ясные обучающие анимации на Python.
Отвечай по-русски: 1–3 предложения, затем ровно один полный блок \`\`\`python ... \`\`\`.
Сохраняй один класс m.Scene с методом construct. Кадр 14.2 × 8, подписи по-русски, font_size 28–48, длительность 5–20 секунд.
Не добавляй сеть, браузерные API, файловый доступ, динамические импорты или установку пакетов.`;

export const AI_ENGINE_PROFILES: Record<AiEngineId, AiEngineProfileV1> = {
  "arhimed-canvas": {
    id: "arhimed-canvas",
    version: "1",
    instructions: `${SHARED_RULES}

РЕЖИМ: Arhimed Canvas, диалект arhimed-manimx-v1. Первая строка: import manimx as m. Дополнительно допустим import numpy as np.
Используй только Canvas-подмножество: Circle, Square, Rectangle, Dot, Line, Arrow, Text, Tex, MathTex, Axes, NumberPlane, VGroup; Create, Write, FadeIn, FadeOut, Transform, Indicate, LaggedStart; self.play, self.wait; np.sin, np.cos, np.sqrt, np.exp, np.array.
Не используй ValueTracker, always_redraw, updaters, 3D или API полного Manim Community.`,
    allowedApi: ["m.Circle", "m.Text", "m.Axes", "m.Create", "m.Transform", "self.play", "self.wait"],
    repairRule: "Верни полную замену сцены только в Canvas-диалекте; не меняй движок и не добавляй зависимости.",
  },
  "manimgx-browser": {
    id: "manimgx-browser",
    version: "1",
    instructions: `${SHARED_RULES}

РЕЖИМ: ManimGX 0.1.1 в закреплённом браузерном runtime. Первая строка: import manimgx as m. Дополнительно допустим import numpy as np.
Не добавляй другие import/from-импорты. Нельзя использовать micropip, importlib, __import__, fetch, XMLHttpRequest, WebSocket или произвольные URL.
ValueTracker и always_redraw разрешены, если они нужны для короткой 2D-сцены. Не используй 3D. Не обращайся к np.math: у numpy нет такого API.`,
    allowedApi: ["m.Circle", "m.Text", "m.Axes", "m.ValueTracker", "m.always_redraw", "m.Create", "self.play", "self.wait"],
    repairRule: "Верни полную замену для закреплённого ManimGX runtime без новых импортов, пакетов и сетевых обращений.",
  },
};

export const AI_CONTEXT_LIMITS_V1 = {
  promptChars: 4_000,
  sourceChars: 16_384,
  historyChars: 6_000,
  historyMessageChars: 1_200,
  outputTokens: 1_400,
} as const;

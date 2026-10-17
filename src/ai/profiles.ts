export type AiEngineId = "arhimed-canvas" | "manimgx-browser";

export interface AiEngineProfileV1 {
  id: AiEngineId;
  version: "1" | "2";
  instructions: string;
  /** A documented, non-exhaustive set of examples. It is not an allow-all parser. */
  allowedApi: readonly string[];
  repairRule: string;
}

const SHARED_RULES = `Ты — ИИ-помощник учителя в ArhimedStudio. Пиши содержательные, ясные обучающие анимации на Python.
Отвечай по-русски: 1–3 предложения, затем ровно один полный блок \`\`\`python ... \`\`\`. Не экранируй обратные кавычки: перед ограждением не должно быть символа \\.

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА КОДА И ХРОНОМЕТРАЖА:
- Верни полный исполнимый исходник, а не фрагмент, псевдокод или пояснения внутри блока. Ровно один класс сцены с методом construct(self); не объявляй второй Scene и не вызывай render(), print() или main().
- Целевая суммарная длительность ролика — от 7.0 до 10.0 секунд, оптимально 8–9 секунд. Сложи длительности всех self.play(..., run_time=...) и self.wait(...): результат обязан попасть в этот диапазон.
- У КАЖДОГО self.play явно указывай именованный run_time в той же строке вызова. У КАЖДОГО self.wait явно указывай число секунд. Не полагайся на значения по умолчанию, rate_func и не используй отрицательные или нулевые длительности.
- Сделай 4–6 коротких смысловых этапов и 2–4 паузы: заголовок/вопрос → построение → наблюдение → вывод. Не выводи все объекты одновременно и не растягивай ролик искусственными ожиданиями.
- Не добавляй сеть, браузерные API, файловый доступ, динамические импорты или установку пакетов.

Кадр 14.2 × 8, подписи по-русски.

КОМПОЗИЦИЯ И ЧИТАЕМОСТЬ:
- Держи каждый видимый объект внутри безопасной области: x от -6.1 до 6.1, y от -3.1 до 3.1. Оставляй свободный край не менее 0.45 единицы и нижний запас 0.65 для элементов видеоплеера.
- Заголовок: до 42 символов, font_size 32–40; обычные подписи 22–30; формулы 26–36. Не используй font_size больше 48 и не масштабируй текст крупнее 1.0.
- Длинный текст дели на две строки или заменяй краткой формулой. Для групп используй VGroup и arrange; не размещай формулы или подписи у нижней границы без явного buff.
- Показывай одну смысловую идею за шаг; оставляй контекст после преобразования, чтобы ученик понимал вывод.
- Цвет должен иметь смысл: один акцент для изучаемой величины, второй для сравнения, нейтральные оси и подписи. После каждого преобразования сохраняй в кадре достаточно контекста, чтобы ученик понял результат.
`;

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
    version: "2",
    instructions: `${SHARED_RULES}

РЕЖИМ: полный документированный API ManimGX 0.1.1 в закреплённом браузерном runtime. Это не Canvas-подмножество и не Manim Community с выдуманными заменами.
Обычный вариант импорта для генерируемого кода: import manimgx as m; при вычислениях можно добавить import numpy as np или import math. Runtime также принимает документированные варианты import manimgx, from manimgx import ..., from manimgx import * и безопасные закреплённые математические модули Python. Выбирай один ясный стиль и согласованно используй его в классе сцены.
Используй реальные имена ManimGX 0.1.1: Text, Tex, MathTex; Mobject, VMobject, Group, VGroup; геометрию, координатные системы Axes/NumberPlane/ComplexPlane и plot; Transform/ReplacementTransform/TransformMatchingTex, AnimationGroup/Succession/LaggedStart; ValueTracker, always_redraw, add_updater. Допустим обычный Python: функции, циклы, comprehensions, *args/**kwargs, распаковка, lambda, dataclasses и математические вычисления. 3D-сцены, камера и поверхности пока не генерируй: для них нужен отдельный опубликованный browser-прогон, а не предположение по API.
Не используй micropip, importlib, __import__, js/pyodide bridge, браузерные API, файловую систему, сеть, URL или установку пакетов. Не обращайся к np.math: используй math или сам numpy. В браузере не создавай видеофайлы, не загружай локальные ресурсы и не вызывай внешние audio/voice-провайдеры.`,
    allowedApi: ["Text", "Tex", "MathTex", "Axes", "NumberPlane", "ComplexPlane", "VGroup", "TransformMatchingTex", "ValueTracker", "always_redraw", "add_updater", "self.play"],
    repairRule: "Верни полную замену для ManimGX 0.1.1, сохранив документированный API и закреплённые безопасные импорты; не добавляй пакеты, сеть или доступ к файлам.",
  },
};

export const AI_CONTEXT_LIMITS_V1 = {
  promptChars: 4_000,
  // Python is independently bounded by the isolated runtime.  This limit is for the LLM
  // request body, where 64 KiB leaves useful room for prompt and revision history.
  sourceChars: 65_536,
  historyChars: 6_000,
  historyMessageChars: 1_200,
  outputTokens: 6_000,
} as const;

import { genericCode, TEMPLATES } from "./templates";
import type { AiEngineId } from "../ai/profiles";

export interface AssistantReply {
  text: string;
  code?: string;
  title?: string;
}

export interface LLMSettings {
  provider: "offline" | "openrouter" | "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
  rememberKey: boolean;
}

export interface LLMPreferences extends Omit<LLMSettings, "apiKey"> {}

export const DEFAULT_LLM_PREFERENCES: LLMPreferences = {
  provider: "offline",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  rememberKey: false,
};

export const DEFAULT_LLM: LLMSettings = { ...DEFAULT_LLM_PREFERENCES, apiKey: "" };

/**
 * Providers occasionally escape Markdown fences (\\`\\`\\`) even though the requested
 * response is otherwise valid. Keep prose and source separate so a scene is always reviewed
 * through the candidate-revision flow rather than being dumped into chat.
 */
export function parseAssistantContent(content: string): AssistantReply {
  const normalized = content.replace(/\\`/g, "`").replace(/\r\n/g, "\n");
  const fenced = /```(?:python|py)?[ \t]*\n([\s\S]*?)```/i.exec(normalized);
  if (fenced) {
    const text = `${normalized.slice(0, fenced.index)}${normalized.slice((fenced.index ?? 0) + fenced[0].length)}`.trim() || "Готово — подготовил кандидатную ревизию.";
    return { text, code: fenced[1].trim() + "\n" };
  }

  // Last-resort recovery for providers that omit fences but do return a complete scene.
  const sourceStart = normalized.search(/^\s*(?:import\s+(?:manimx|manimgx)(?:\s+as\s+\w+)?\b|from\s+manimgx(?:\.\w+)*\s+import\s+)/m);
  if (sourceStart >= 0) {
    const source = normalized.slice(sourceStart).trim();
    if (/class\s+\w+\s*\(\s*(?:(?:m|manimgx)\.Scene|Scene)\s*\)\s*:/.test(source)) {
      const text = normalized.slice(0, sourceStart).trim() || "Готово — подготовил кандидатную ревизию.";
      return { text, code: source + "\n" };
    }
  }
  return { text: normalized.trim() || "Провайдер не вернул содержательный ответ." };
}

function completionUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) throw new Error("Укажите адрес OpenAI-совместимого API.");
  return /\/chat\/completions$/i.test(normalized) ? normalized : `${normalized}/chat/completions`;
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (!value || typeof value !== "object") return "";
  const part = value as { text?: unknown; content?: unknown; value?: unknown; output_text?: unknown; parts?: unknown };
  return textContent(part.text) || textContent(part.content) || textContent(part.value) || textContent(part.output_text) || textContent(part.parts);
}

/**
 * Accept the chat-completions response plus the response envelopes commonly returned by
 * OpenAI-compatible gateways.  In particular, some gateways proxy Responses API output,
 * Gemini's `candidates[].content.parts`, native `content`/`outputs`, or wrap the
 * completion in `data`/`result`.
 */
function providerContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    choices?: { message?: { content?: unknown }; delta?: { content?: unknown }; text?: unknown; content?: unknown }[];
    output?: { content?: unknown; text?: unknown }[];
    output_text?: unknown;
    candidates?: { content?: { parts?: unknown }; text?: unknown }[];
    result?: { alternatives?: { message?: { text?: unknown; content?: unknown }; text?: unknown }[] };
    message?: { content?: unknown; text?: unknown };
    response?: unknown;
    generated_text?: unknown;
    content?: unknown;
    outputs?: unknown;
    answer?: unknown;
    completion?: unknown;
    data?: unknown;
  };
  const choice = response.choices?.[0];
  const content = textContent(choice?.message?.content) || textContent(choice?.delta?.content) || textContent(choice?.content) || textContent(choice?.text)
    || textContent(response.output_text)
    || response.output?.map((item) => textContent(item.content) || textContent(item.text)).join("")
    || response.candidates?.map((candidate) => textContent(candidate.content?.parts) || textContent(candidate.text)).join("")
    || response.result?.alternatives?.map((alternative) => textContent(alternative.message?.text) || textContent(alternative.message?.content) || textContent(alternative.text)).join("")
    || textContent(response.message?.content) || textContent(response.message?.text)
    || textContent(response.content) || textContent(response.outputs)
    || textContent(response.response) || textContent(response.generated_text)
    || textContent(response.answer) || textContent(response.completion);
  return content || (response.data && response.data !== payload ? providerContent(response.data) : "");
}

function providerResponseSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "неизвестная структура";
  const response = payload as { choices?: { finish_reason?: unknown; message?: { refusal?: unknown; tool_calls?: unknown } }[] };
  const keys = Object.keys(response).slice(0, 8).join(", ") || "нет полей";
  const choice = response.choices?.[0];
  const reason = typeof choice?.finish_reason === "string" ? `; причина завершения: ${choice.finish_reason}` : "";
  const refusal = choice?.message?.refusal ? "; модель отказалась сформировать ответ" : "";
  const tools = choice?.message?.tool_calls ? "; модель вернула вызов инструмента вместо текста" : "";
  return `поля ответа: ${keys}${reason}${refusal}${tools}`;
}

/** Some compatible gateways put an API error in a successful HTTP envelope. */
function providerErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error.slice(0, 320);
  if (!error || typeof error !== "object" || Array.isArray(error)) return "";
  const details = error as { message?: unknown; detail?: unknown; code?: unknown; type?: unknown };
  const message = typeof details.message === "string"
    ? details.message
    : typeof details.detail === "string"
      ? details.detail
      : "";
  const labels = [typeof details.code === "string" || typeof details.code === "number" ? String(details.code) : "", typeof details.type === "string" ? details.type : ""].filter(Boolean);
  return [labels.join(" / "), message].filter(Boolean).join(": ").slice(0, 320);
}

function decodeProviderResponse(raw: string): unknown {
  const body = raw.replace(/^\uFEFF/, "").trim();
  try { return JSON.parse(body); } catch {
    // A few OpenAI-compatible gateways send Server-Sent Events even when stream=false.
    const events = body.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((data) => data && data !== "[DONE]");
    if (!events.length) throw new Error("Провайдер вернул не JSON. Проверьте адрес API: ожидается базовый URL вида …/v1 или полный …/chat/completions.");
    const decoded = events.map((event) => JSON.parse(event));
    const content = decoded.map(providerContent).join("");
    if (!content) throw new Error("Провайдер вернул поток без текстового ответа.");
    return { choices: [{ message: { content } }] };
  }
}

const COLOR_WORDS: [RegExp, string, string][] = [
  [/красн/, "RED", "красный"],
  [/син(ий|им|ее|яя|ей|ие|его|юю|ими)(?![а-я])|голуб/, "BLUE", "синий"],
  [/зел[её]н/, "GREEN", "зелёный"],
  [/ж[её]лт/, "YELLOW", "жёлтый"],
  [/оранж/, "ORANGE", "оранжевый"],
  [/фиолет|пурпур/, "PURPLE", "фиолетовый"],
  [/розов/, "PINK", "розовый"],
  [/бирюз/, "TEAL", "бирюзовый"],
  [/золот/, "GOLD", "золотой"],
  [/бел/, "WHITE", "белый"],
];

function modifySpeed(code: string, factor: number) {
  return code
    .split("\n")
    .map((line) => {
      let l = line.replace(/self\.wait\(([\d.]+)\)/g, (_, n) => `self.wait(${+(parseFloat(n) * factor).toFixed(2)})`);
      if (/self\.play\(/.test(l)) {
        if (/run_time\s*=\s*[\d.]+/.test(l)) {
          l = l.replace(/run_time\s*=\s*([\d.]+)/, (_, n) => `run_time=${+(parseFloat(n) * factor).toFixed(2)}`);
        } else if (/\)\s*$/.test(l)) {
          l = l.replace(/\)\s*$/, `, run_time=${+factor.toFixed(2)})`);
        }
      }
      return l;
    })
    .join("\n");
}

/** Keep offline-created scenes aligned with the same 7–10 second contract as the hosted assistant. */
function estimatedDuration(code: string): number {
  const plays = (code.match(/self\.play\s*\(/g) ?? []).length;
  const explicit = [...code.matchAll(/run_time\s*=\s*(\d+(?:\.\d+)?)/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  const waits = [...code.matchAll(/self\.wait\s*\(\s*(\d+(?:\.\d+)?)?\s*\)/g)].reduce((sum, match) => sum + Number(match[1] ?? 1), 0);
  return explicit + waits + Math.max(0, plays - (code.match(/run_time\s*=/g) ?? []).length);
}

function fitShortVideo(code: string): string {
  const duration = estimatedDuration(code);
  return duration >= 7 && duration <= 10 ? code : modifySpeed(code, 8.5 / Math.max(duration, 0.1));
}

function setBackground(code: string, color: string) {
  const lines = code.split("\n");
  const existing = lines.findIndex((l) => /self\.camera\.background_color/.test(l));
  if (existing >= 0) {
    lines[existing] = lines[existing].replace(/=\s*.+$/, `= ${color}`);
    return lines.join("\n");
  }
  const idx = lines.findIndex((l) => /def\s+construct/.test(l));
  if (idx < 0) return code;
  const indent = (lines[idx].match(/^\s*/)?.[0] ?? "") + "    ";
  lines.splice(idx + 1, 0, `${indent}self.camera.background_color = ${color}`);
  return lines.join("\n");
}

/** Local "assistant": understands typical lesson topics and simple edits. */
function gxStarterCode(topic: string) {
  const safeTitle = topic.replace(/["\\]/g, "'").slice(0, 42) || "Новая сцена";
  return `import manimgx as m

class LessonScene(m.Scene):
    def construct(self):
        title = m.Text("${safeTitle}", font_size=36).to_edge(m.UP, buff=0.45)
        question = m.Text("Как устроена эта идея?", font_size=26, color=m.TEAL).next_to(title, m.DOWN, buff=0.28)
        model = m.Circle(radius=1.05, color=m.TEAL, fill_opacity=0.16).shift(1.25 * m.LEFT + 0.15 * m.DOWN)
        input_arrow = m.Arrow(m.LEFT * 4.5, m.LEFT * 2.35 + 0.15 * m.DOWN, color=m.BLUE, buff=0.15)
        output_arrow = m.Arrow(m.RIGHT * 0.15 + 0.15 * m.DOWN, m.RIGHT * 2.35 + 0.15 * m.DOWN, color=m.YELLOW, buff=0.15)
        input_label = m.Text("данные", font_size=25, color=m.BLUE).next_to(input_arrow, m.UP, buff=0.18)
        output_label = m.Text("результат", font_size=25, color=m.YELLOW).next_to(output_arrow, m.UP, buff=0.18)
        observation = m.Text("Построим модель и проследим изменение", font_size=25).to_edge(m.DOWN, buff=0.72)
        conclusion = m.Text("Вывод: связь видна на каждом шаге", font_size=25, color=m.TEAL).to_edge(m.DOWN, buff=0.72)
        self.play(m.Write(title), run_time=0.9)
        self.wait(0.3)
        self.play(m.Write(question), run_time=0.8)
        self.wait(0.3)
        self.play(m.Create(model), m.Create(input_arrow), m.Write(input_label), m.Create(output_arrow), m.Write(output_label), run_time=1.3)
        self.wait(0.6)
        self.play(m.Write(observation), run_time=0.9)
        self.play(m.Transform(observation, conclusion), run_time=1.0)
        self.wait(1.1)
`;
}

function gxTaylorSineCode() {
  return `import manimgx as m
import numpy as np

class TaylorSine(m.Scene):
    def construct(self):
        title = m.Text("sin(x) и полином Тейлора", font_size=36).to_edge(m.UP, buff=0.42)
        subtitle = m.Text("Сравним приближения около нуля", font_size=24, color=m.TEAL).next_to(title, m.DOWN, buff=0.22)
        axes = m.Axes(x_range=[-3.2, 3.2, 1], y_range=[-1.5, 1.5, 1], x_length=8.6, y_length=3.8, tips=False).shift(0.18 * m.DOWN)
        sine = axes.plot(lambda x: np.sin(x), x_range=[-3.0, 3.0], color=m.TEAL)
        linear = axes.plot(lambda x: x, x_range=[-1.6, 1.6], color=m.BLUE)
        cubic = axes.plot(lambda x: x - x**3 / 6, x_range=[-2.35, 2.35], color=m.YELLOW)
        fifth = axes.plot(lambda x: x - x**3 / 6 + x**5 / 120, x_range=[-3.0, 3.0], color=m.ORANGE)
        sine_label = m.Text("точный sin(x)", font_size=23, color=m.TEAL).next_to(axes.c2p(2.05, 0.7), m.UP, buff=0.16)
        formula = m.Text("x − x³/6 + x⁵/120", font_size=26, color=m.ORANGE).to_edge(m.DOWN, buff=0.68)
        self.play(m.Write(title), run_time=0.7)
        self.wait(0.25)
        self.play(m.Write(subtitle), m.Create(axes), run_time=0.9)
        self.wait(0.3)
        self.play(m.Create(sine), m.Write(sine_label), run_time=0.9)
        self.wait(0.35)
        self.play(m.Create(linear), run_time=0.7)
        self.wait(0.35)
        self.play(m.Transform(linear, cubic), run_time=0.8)
        self.play(m.Transform(linear, fifth), m.Write(formula), run_time=1.0)
        self.wait(1.0)
`;
}

function canvasStarterCode(topic: string) {
  const safeTitle = topic.replace(/["\\\n]/g, " ").trim().slice(0, 42) || "Новая сцена";
  return `import manimx as m

class LessonScene(m.Scene):
    def construct(self):
        title = m.Text("${safeTitle}", font_size=36).to_edge(m.UP, buff=0.48)
        question = m.Text("Как работает эта идея?", font_size=25, color=m.TEAL).next_to(title, m.DOWN, buff=0.25)
        source = m.Circle(radius=0.82, color=m.BLUE, fill_opacity=0.22).shift(3.0 * m.LEFT + 0.12 * m.DOWN)
        model = m.Square(side_length=1.65, color=m.TEAL, fill_opacity=0.18).shift(0.12 * m.DOWN)
        result = m.Circle(radius=0.82, color=m.YELLOW, fill_opacity=0.22).shift(3.0 * m.RIGHT + 0.12 * m.DOWN)
        arrow_a = m.Arrow(2.1 * m.LEFT + 0.12 * m.DOWN, 0.95 * m.LEFT + 0.12 * m.DOWN, color=m.LIGHT_GRAY, buff=0.16)
        arrow_b = m.Arrow(0.95 * m.RIGHT + 0.12 * m.DOWN, 2.1 * m.RIGHT + 0.12 * m.DOWN, color=m.LIGHT_GRAY, buff=0.16)
        label_a = m.Text("вход", font_size=23, color=m.BLUE).next_to(source, m.DOWN, buff=0.24)
        label_b = m.Text("модель", font_size=23, color=m.TEAL).next_to(model, m.DOWN, buff=0.24)
        label_c = m.Text("результат", font_size=23, color=m.YELLOW).next_to(result, m.DOWN, buff=0.24)
        observation = m.Text("Проследим путь величины по шагам", font_size=24).to_edge(m.DOWN, buff=0.72)
        conclusion = m.Text("Вывод: модель связывает вход и результат", font_size=24, color=m.TEAL).to_edge(m.DOWN, buff=0.72)
        self.play(m.Write(title), run_time=0.75)
        self.wait(0.25)
        self.play(m.Write(question), run_time=0.7)
        self.wait(0.25)
        self.play(m.Create(source), m.Write(label_a), m.Create(arrow_a), m.Create(model), m.Write(label_b), run_time=1.2)
        self.wait(0.4)
        self.play(m.Create(arrow_b), m.Create(result), m.Write(label_c), m.Write(observation), run_time=0.95)
        self.wait(0.5)
        self.play(m.Indicate(model), run_time=0.8)
        self.play(m.Transform(observation, conclusion), run_time=0.9)
        self.wait(0.55)
`;
}

export function localAssistant(prompt: string, currentCode: string, isFirst: boolean, engine: AiEngineId = "arhimed-canvas"): AssistantReply {
  const p = prompt.toLowerCase();

  if (engine === "manimgx-browser" && /(тейлор|taylor).*(син|sin)|(син|sin).*(тейлор|taylor)/.test(p)) {
    return {
      text: "Построил sin(x) и его приближение полиномом Тейлора пятой степени. В коде используются только закреплённые импорты ManimGX и numpy.",
      code: fitShortVideo(gxTaylorSineCode()),
      title: isFirst ? "Ряд Тейлора" : undefined,
    };
  }

  // --- edits of the current scene ---
  if (/медленн|помедлен|slower/.test(p)) {
    return { text: "Замедлил анимацию примерно в 1.6 раза: увеличил паузы и длительность каждого шага. Так ученикам будет проще следить за ходом мысли.", code: modifySpeed(currentCode, 1.6) };
  }
  if (/быстр|ускор|faster/.test(p) && !/алгоритм|сортир/.test(p)) {
    return { text: "Ускорил анимацию: сократил паузы и длительность шагов примерно на 40%.", code: modifySpeed(currentCode, 0.6) };
  }
  if (/фон/.test(p)) {
    const bg: [RegExp, string, string][] = [
      [/т[её]мно-син|ночн|сини/, '"#0f172a"', "тёмно-синий"],
      [/сер/, '"#1f2933"', "графитовый"],
      [/фиолет/, '"#1e1033"', "тёмно-фиолетовый"],
      [/зел[её]н|доск/, '"#1d3b2a"', "«школьная доска»"],
      [/ч[её]рн/, "m.BLACK", "чёрный"],
    ];
    const hit = bg.find(([re]) => re.test(p)) ?? bg[3];
    return { text: `Поменял фон сцены на ${hit[2]}. Светлые фигуры и текст на нём хорошо читаются даже на проекторе.`, code: setBackground(currentCode, hit[1]) };
  }
  const colorHit = COLOR_WORDS.find(([re]) => re.test(p));
  if (colorHit && /(цвет|сделай|покрас|измени|поменяй|замени)/.test(p)) {
    const used = currentCode.match(/m\.(RED|BLUE|GREEN|YELLOW|ORANGE|PURPLE|PINK|TEAL|GOLD)\b|"rgb\([^)]*\)"/);
    if (used) {
      const from = used[0];
      const code = currentCode.split(from).join(`m.${colorHit[1]}`);
      return { text: `Заменил основной цвет (${from.replace("m.", "")}) на ${colorHit[2]} во всех объектах сцены.`, code };
    }
  }
  const titleM = prompt.match(/(?:заголов\w*|назван\w*|подпис\w*)\s*(?:на|:)?\s*[«"“]?([^»"”]+)[»"”]?\s*$/i);
  if (titleM && /(Text|Tex)\("/.test(currentCode)) {
    const newTitle = titleM[1].trim().replace(/"/g, "'");
    const code = currentCode.replace(/((?:Text|Tex)\(")([^"]*)(")/, `$1${newTitle}$3`);
    return { text: `Обновил заголовок сцены на «${newTitle}».`, code };
  }

  // --- new scene from template ---
  let best: { t: (typeof TEMPLATES)[number]; score: number } | null = null;
  for (const t of TEMPLATES) {
    let score = 0;
    if (t.prompt.toLowerCase() === p) score += 100;
    for (const k of t.keywords) if (p.includes(k)) score += k.length > 4 ? 2 : 1;
    if (score > 0 && (!best || score > best.score)) best = { t, score };
  }
  if (best && engine === "arhimed-canvas") {
    return { text: best.t.reply, code: fitShortVideo(best.t.code), title: isFirst ? best.t.title : undefined };
  }

  const topic = prompt.trim().replace(/^(покажи|нарисуй|создай|сделай|объясни|визуализируй)\s+/i, "");
  const nice = topic.charAt(0).toUpperCase() + topic.slice(1);
  return {
    text:
      `Подготовил стартовую сцену-заготовку по теме «${nice}»: заголовок, акцентная линия и набор фигур, которые можно превратить в иллюстрацию. Уточните, что именно показать (например, формулу, график или шаги решения), — и я дострою анимацию. В офлайн-режиме я лучше всего знаю темы: кинематика, графы, линейная алгебра, ряды, геометрия, тригонометрия и производные. Подключите языковую модель в настройках, чтобы генерировать любые сцены.`,
    code: fitShortVideo(engine === "manimgx-browser" ? gxStarterCode(nice) : canvasStarterCode(nice)),
    title: isFirst ? nice.slice(0, 32) : undefined,
  };
}

export async function llmAssistant(
  settings: LLMSettings,
  history: { role: "user" | "assistant"; content: string }[],
  prompt: string,
  currentCode: string,
  signal: AbortSignal | undefined,
  systemPrompt: string,
  maxOutputTokens: number,
): Promise<AssistantReply> {
  if (settings.provider === "offline") throw new Error("Выбран офлайн-ассистент.");
  if (!settings.apiKey) throw new Error("Введите API-ключ для выбранного провайдера.");
  if (prompt.length > 4_000 || currentCode.length > 65_536) throw new Error("Запрос или исходник превышает безопасный лимит контекста.");
  const url = completionUrl(settings.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.4,
      max_tokens: maxOutputTokens,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        {
          role: "user",
          content: `Текущий код сцены:\n\`\`\`python\n${currentCode}\n\`\`\`\n\nЗапрос учителя: ${prompt}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Провайдер отклонил API-ключ.");
    if (res.status === 402) throw new Error("Недостаточно средств у провайдера.");
    if (res.status === 429) throw new Error("Провайдер ограничил число запросов. Повторите позже.");
    const t = await res.text();
    throw new Error(`Ошибка API (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = decodeProviderResponse(await res.text());
  const content = providerContent(data);
  const providerError = providerErrorMessage(data);
  if (providerError) throw new Error(`Ошибка провайдера: ${providerError}`);
  if (!content) throw new Error(`Провайдер вернул ответ без текста (${providerResponseSummary(data)}). Проверьте модель или пришлите эту диагностику разработчику.`);
  const reply = parseAssistantContent(content);
  // Hosted models occasionally miss the timing budget by a few tenths of a second.
  // Explicit durations can be safely scaled before the candidate reaches validation.
  return reply.code ? { ...reply, code: fitShortVideo(reply.code) } : reply;
}

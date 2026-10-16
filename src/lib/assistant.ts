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
  const sourceStart = normalized.search(/^\s*import\s+(?:manimx|manimgx)\s+as\s+m\b/m);
  if (sourceStart >= 0) {
    const source = normalized.slice(sourceStart).trim();
    if (/class\s+\w+\s*\(\s*m\.Scene\s*\)\s*:/.test(source)) {
      const text = normalized.slice(0, sourceStart).trim() || "Готово — подготовил кандидатную ревизию.";
      return { text, code: source + "\n" };
    }
  }
  return { text: normalized.trim() || "Провайдер не вернул содержательный ответ." };
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
        self.play(m.Write(title), run_time=1.1)
        self.wait(0.6)
        self.play(m.Write(question), run_time=1.0)
        self.wait(0.6)
        self.play(m.Create(model), m.Create(input_arrow), m.Write(input_label), run_time=1.4)
        self.play(m.Create(output_arrow), m.Write(output_label), run_time=1.25)
        self.wait(0.8)
        self.play(m.Write(observation), run_time=1.2)
        self.wait(0.9)
        self.play(m.Transform(observation, conclusion), run_time=1.3)
        self.wait(1.9)
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
        observation = m.Text("Больше членов — точнее кривая", font_size=24).to_edge(m.DOWN, buff=0.68)
        self.play(m.Write(title), run_time=1.1)
        self.wait(0.55)
        self.play(m.Write(subtitle), m.Create(axes), run_time=1.35)
        self.wait(0.55)
        self.play(m.Create(sine), m.Write(sine_label), run_time=1.25)
        self.wait(0.65)
        self.play(m.Create(linear), run_time=1.2)
        self.wait(0.75)
        self.play(m.Transform(linear, cubic), run_time=1.35)
        self.wait(0.75)
        self.play(m.Transform(linear, fifth), m.Write(formula), run_time=1.45)
        self.wait(0.8)
        self.play(m.Transform(formula, observation), run_time=1.15)
        self.wait(1.35)
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
        self.play(m.Write(title), run_time=1.1)
        self.wait(0.6)
        self.play(m.Write(question), run_time=1.0)
        self.wait(0.55)
        self.play(m.Create(source), m.Write(label_a), run_time=1.15)
        self.play(m.Create(arrow_a), m.Create(model), m.Write(label_b), run_time=1.35)
        self.wait(0.65)
        self.play(m.Create(arrow_b), m.Create(result), m.Write(label_c), run_time=1.3)
        self.play(m.Write(observation), run_time=1.1)
        self.wait(0.85)
        self.play(m.Indicate(model), run_time=1.1)
        self.play(m.Transform(observation, conclusion), run_time=1.2)
        self.wait(1.55)
`;
}

export function localAssistant(prompt: string, currentCode: string, isFirst: boolean, engine: AiEngineId = "arhimed-canvas"): AssistantReply {
  const p = prompt.toLowerCase();

  if (engine === "manimgx-browser" && /(тейлор|taylor).*(син|sin)|(син|sin).*(тейлор|taylor)/.test(p)) {
    return {
      text: "Построил sin(x) и его приближение полиномом Тейлора пятой степени. В коде используются только закреплённые импорты ManimGX и numpy.",
      code: gxTaylorSineCode(),
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
    return { text: best.t.reply, code: best.t.code, title: isFirst ? best.t.title : undefined };
  }

  const topic = prompt.trim().replace(/^(покажи|нарисуй|создай|сделай|объясни|визуализируй)\s+/i, "");
  const nice = topic.charAt(0).toUpperCase() + topic.slice(1);
  return {
    text:
      `Подготовил стартовую сцену-заготовку по теме «${nice}»: заголовок, акцентная линия и набор фигур, которые можно превратить в иллюстрацию. Уточните, что именно показать (например, формулу, график или шаги решения), — и я дострою анимацию. В офлайн-режиме я лучше всего знаю темы: кинематика, графы, линейная алгебра, ряды, геометрия, тригонометрия и производные. Подключите языковую модель в настройках, чтобы генерировать любые сцены.`,
    code: engine === "manimgx-browser" ? gxStarterCode(nice) : canvasStarterCode(nice),
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
  const url = settings.baseUrl.replace(/\/$/, "") + "/chat/completions";
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
  let data: unknown;
  try { data = await res.json(); } catch { throw new Error("Провайдер вернул повреждённый ответ."); }
  const content: string = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content as string ?? "";
  if (!content || typeof content !== "string") throw new Error("Провайдер не вернул текст ответа.");
  return parseAssistantContent(content);
}

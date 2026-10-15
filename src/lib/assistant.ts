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
  const safeTitle = topic.replace(/["\\]/g, "'").slice(0, 72) || "Новая сцена";
  return `import manimgx as m

class LessonScene(m.Scene):
    def construct(self):
        title = m.Text("${safeTitle}", font_size=38).to_edge(m.UP)
        circle = m.Circle(radius=1.25, color=m.TEAL, fill_opacity=0.2)
        caption = m.Text("Настроим сцену вместе", font_size=28).next_to(circle, m.DOWN)
        self.play(m.Write(title), m.Create(circle), run_time=1.0)
        self.play(m.Write(caption), run_time=0.8)
        self.wait(1.0)
`;
}

function gxTaylorSineCode() {
  return `import manimgx as m
import numpy as np

class TaylorSine(m.Scene):
    def construct(self):
        title = m.Text("sin(x) и полином Тейлора", font_size=38).to_edge(m.UP)
        axes = m.Axes(x_range=[-3.2, 3.2, 1], y_range=[-1.5, 1.5, 1], x_length=9.2, y_length=4.8, tips=False)
        sine = axes.plot(lambda x: np.sin(x), x_range=[-3.0, 3.0], color=m.TEAL)
        taylor = axes.plot(lambda x: x - x**3 / 6 + x**5 / 120, x_range=[-3.0, 3.0], color=m.YELLOW)
        sine_label = m.Text("sin(x)", font_size=26, color=m.TEAL).next_to(axes.c2p(2.3, 0.7), m.UP)
        taylor_label = m.Text("x − x³/6 + x⁵/120", font_size=23, color=m.YELLOW).next_to(axes.c2p(0.0, -1.15), m.DOWN)
        self.play(m.Write(title), m.Create(axes), run_time=1.2)
        self.play(m.Create(sine), m.Write(sine_label), run_time=1.2)
        self.play(m.Create(taylor), m.Write(taylor_label), run_time=1.4)
        self.wait(1.0)
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
    code: engine === "manimgx-browser" ? gxStarterCode(nice) : genericCode(nice),
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
  if (prompt.length > 4_000 || currentCode.length > 16_384) throw new Error("Запрос или исходник превышает безопасный лимит контекста.");
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
  const m = content.match(/```(?:python|py)?\s*\n([\s\S]*?)```/);
  const text = content.replace(/```[\s\S]*?```/g, "").trim() || "Готово — обновил сцену.";
  return { text, code: m ? m[1].trim() + "\n" : undefined };
}

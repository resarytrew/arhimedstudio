import { genericCode, TEMPLATES } from "./templates";

export interface AssistantReply {
  text: string;
  code?: string;
  title?: string;
}

export interface LLMSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_LLM: LLMSettings = {
  enabled: false,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

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
export function localAssistant(prompt: string, currentCode: string, isFirst: boolean): AssistantReply {
  const p = prompt.toLowerCase();

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
  if (best) {
    return { text: best.t.reply, code: best.t.code, title: isFirst ? best.t.title : undefined };
  }

  const topic = prompt.trim().replace(/^(покажи|нарисуй|создай|сделай|объясни|визуализируй)\s+/i, "");
  const nice = topic.charAt(0).toUpperCase() + topic.slice(1);
  return {
    text:
      `Подготовил стартовую сцену-заготовку по теме «${nice}»: заголовок, акцентная линия и набор фигур, которые можно превратить в иллюстрацию. Уточните, что именно показать (например, формулу, график или шаги решения), — и я дострою анимацию. В офлайн-режиме я лучше всего знаю темы: кинематика, графы, линейная алгебра, ряды, геометрия, тригонометрия и производные. Подключите языковую модель в настройках, чтобы генерировать любые сцены.`,
    code: genericCode(nice),
    title: isFirst ? nice.slice(0, 32) : undefined,
  };
}

const SYSTEM_PROMPT = `Ты — ИИ-помощник учителя в веб-приложении ArhimedStudio. Ты пишешь короткие обучающие анимации на Python в стиле Manim (модуль импортируется как "import manimx as m").
Отвечай по-русски: 1–3 предложения о том, что показывает сцена, затем ОДИН блок кода \`\`\`python ... \`\`\`.
Поддерживаемое подмножество (используй только его):
- Объекты: m.Circle, m.Square, m.Rectangle, m.RoundedRectangle, m.Triangle, m.RegularPolygon, m.Polygon, m.Dot, m.Line, m.DashedLine, m.Arrow, m.DoubleArrow, m.Vector, m.Arc, m.Ellipse, m.Text, m.Tex, m.MathTex (простая LaTeX-разметка), m.Axes, m.NumberPlane, m.NumberLine, m.FunctionGraph, m.ParametricFunction, m.VGroup, m.SurroundingRectangle, m.BackgroundRectangle, m.Brace, m.DecimalNumber.
- Методы: shift, move_to, scale, rotate, set_color, set_fill, set_stroke, set_opacity, next_to, to_edge, to_corner, arrange, get_center/get_top/get_end, copy, apply_matrix, axes.c2p, axes.plot(lambda x: ..., x_range=[a,b], color=...), axes.get_axis_labels, axes.get_area.
- Анимации: m.Create, m.Write, m.FadeIn(shift=, scale=), m.FadeOut, m.Transform, m.ReplacementTransform, m.TransformFromCopy, m.GrowFromCenter, m.GrowArrow, m.Indicate, m.Circumscribe, m.Rotate, m.MoveAlongPath, m.LaggedStart, m.AnimationGroup, m.Succession, obj.animate.<метод>(...).
- self.play(..., run_time=, rate_func=m.linear), self.wait(t), self.add, self.remove.
- Константы: UP, DOWN, LEFT, RIGHT, UL, UR, DL, DR, ORIGIN, PI, TAU, DEGREES, цвета (RED, BLUE, GREEN, YELLOW, ORANGE, PURPLE, PINK, TEAL, GOLD, WHITE, GREY, LIGHT_GRAY, BLUE_E ...). Математика: np.sin, np.cos, np.sqrt, np.exp, np.array.
- Поддерживаются циклы for, if/else, лямбды, словари и списки. НЕ используй list comprehension, updaters, ValueTracker, always_redraw, 3D.
Кадр 14.2 × 8 единиц, центр (0,0). Подписи делай по-русски, шрифт font_size 28–48. Сцена — 5–20 секунд.`;

export async function llmAssistant(
  settings: LLMSettings,
  history: { role: "user" | "assistant"; content: string }[],
  prompt: string,
  currentCode: string
): Promise<AssistantReply> {
  const url = settings.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-6),
        {
          role: "user",
          content: `Текущий код сцены:\n\`\`\`python\n${currentCode}\n\`\`\`\n\nЗапрос учителя: ${prompt}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ошибка API (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const m = content.match(/```(?:python|py)?\s*\n([\s\S]*?)```/);
  const text = content.replace(/```[\s\S]*?```/g, "").trim() || "Готово — обновил сцену.";
  return { text, code: m ? m[1].trim() + "\n" : undefined };
}

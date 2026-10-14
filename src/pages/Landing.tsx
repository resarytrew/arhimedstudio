import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadEngineFonts } from "../engine/fonts";
import { ArrowRight, Braces, Clapperboard, MessagesSquare, Maximize2, X, Download, Plus, ArrowUp, PanelLeft, MessageSquarePlus, Sun, User } from "lucide-react";
import { Logo } from "../components/Logo";
import { Player } from "../components/Player";
import { highlight } from "../components/CodeEditor";
import { runScript, type Timeline } from "../engine/interpreter";
import { WELCOME_CODE, SUGGESTED_PROMPTS } from "../lib/templates";

const HAND_BLUE = "#2f55e4";
const HAND_VIOLET = "#5b21d6";

function useWelcomeTimeline() {
  const [tl, setTl] = useState<Timeline | null>(null);
  useEffect(() => {
    loadEngineFonts().then(() => {
      try {
        setTl(runScript(WELCOME_CODE));
      } catch {
        /* noop */
      }
    });
  }, []);
  return tl;
}

function MockStudio() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  const tl = useWelcomeTimeline();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 980));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hdr = "flex h-8 items-center gap-1.5 border-b border-white/5 px-3 text-[11px] font-medium text-slate-200";

  return (
    <div ref={wrapRef} className="relative w-full" style={{ aspectRatio: "980 / 580" }}>
      <div
        className="dark absolute left-0 top-0 flex gap-1.5 rounded-[18px] bg-[#0a101c] p-1.5 shadow-[0_40px_80px_-20px_rgba(30,27,75,0.55),0_0_0_1px_rgba(255,255,255,0.06)]"
        style={{ width: 980, height: 580, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {/* sidebar */}
        <div className="flex w-[180px] flex-col rounded-xl bg-[#111a2b] p-3 text-slate-300">
          <div className="flex items-center justify-between text-white">
            <Logo size="sm" className="scale-90 origin-left" />
            <PanelLeft size={13} className="text-slate-500" />
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
            Видео <Plus size={11} />
          </div>
          <div className="mt-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] text-white">Пример видео</div>
          <div className="mt-1 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400">Ряд Тейлора</div>
          <div className="mt-1 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400">Алгоритм Дейкстры</div>
          <div className="mt-auto space-y-2 text-[10.5px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><MessageSquarePlus size={11} /> Обратная связь</span>
              <Sun size={11} />
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10"><User size={11} /></span>
              <span>
                <span className="block text-white">Войти</span>
                <span className="block text-[9px] text-slate-500">Google или GitHub</span>
              </span>
            </div>
          </div>
        </div>
        {/* chat */}
        <div className="flex w-[330px] flex-col rounded-xl bg-[#111a2b]">
          <div className={hdr}>
            <MessagesSquare size={11} className="text-slate-400" /> Чат
            <span className="ml-auto flex gap-2 text-slate-500"><Maximize2 size={10} /><X size={11} /></span>
          </div>
          <div className="flex flex-1 flex-col justify-center px-5">
            <div className="mb-1 px-2 text-[10px] text-slate-500">Идеи для начала</div>
            {SUGGESTED_PROMPTS.slice(0, 4).map((s) => (
              <div key={s} className="border-b border-white/5 px-2 py-2.5 text-[11px] text-slate-300 last:border-0">
                {s}
              </div>
            ))}
          </div>
          <div className="m-2 rounded-xl bg-[#1a2540] p-3">
            <div className="h-10 text-[10.5px] text-slate-500">Опишите идею для урока…</div>
            <div className="flex justify-end gap-2 text-slate-400">
              <Plus size={13} />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white"><ArrowUp size={11} /></span>
            </div>
          </div>
        </div>
        {/* right */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-col overflow-hidden rounded-xl bg-[#111a2b]">
            <div className={hdr}>
              <Clapperboard size={11} className="text-slate-400" /> Превью
              <span className="ml-auto flex gap-2 text-slate-500"><Download size={10} /><Maximize2 size={10} /><X size={11} /></span>
            </div>
            <div className="aspect-video bg-black">
              {tl ? (
                <Player timeline={tl} controls={false} loop autoPlay />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[10px] text-slate-400">
                  <span className="text-[8.5px] uppercase tracking-[0.2em] text-slate-500">Подготовка превью</span>
                  <span>Загрузка движка анимаций</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-[#111a2b]">
            <div className={hdr}>
              <Braces size={11} className="text-slate-400" /> Код Manim
              <span className="ml-auto flex gap-2 text-slate-500"><Maximize2 size={10} /><X size={11} /></span>
            </div>
            <div className="code-theme flex min-h-0 flex-1 overflow-hidden py-1.5">
              <div className="w-7 shrink-0 select-none pr-2 text-right font-mono text-[9.5px] leading-[15px] text-slate-600">
                {WELCOME_CODE.split("\n").slice(0, 14).map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre
                className="m-0 overflow-hidden whitespace-pre font-mono text-[9.5px] leading-[15px] text-slate-200"
                dangerouslySetInnerHTML={{ __html: highlight(WELCOME_CODE) }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Note({ n, title, text, icon, className }: { n: number; title: string; text: string; icon: ReactNode; className?: string }) {
  return (
    <div className={`pointer-events-none absolute hidden font-hand lg:block ${className ?? ""}`}>
      <div className="flex items-center gap-2" style={{ color: HAND_VIOLET }}>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[20px] font-bold leading-none"
          style={{ borderColor: HAND_VIOLET }}
        >
          {n}
        </span>
        <span className="text-[34px] font-semibold leading-none">{title}</span>
        <span className="ml-1 text-slate-800">{icon}</span>
      </div>
      <p className="ml-10 mt-1 max-w-[210px] text-[21px] leading-[1.1] text-slate-800">{text}</p>
    </div>
  );
}

const handStroke = { fill: "none", stroke: HAND_BLUE, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-full overflow-hidden bg-white text-slate-900">
      <header className="relative z-10 mx-auto flex max-w-[1400px] items-center justify-between px-6 pt-8 sm:px-12 lg:px-20">
        <Logo size="lg" />
        <nav className="flex items-center gap-6 text-[14px] text-slate-600">
          <a href="#how" className="hidden hover:text-slate-900 sm:block">Как это работает</a>
          <button onClick={onStart} className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50">
            Открыть студию
          </button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1400px] items-center gap-10 px-6 pb-10 pt-10 sm:px-12 lg:min-h-[calc(100vh-170px)] lg:grid-cols-[0.8fr_1.2fr] lg:px-20 lg:pt-0">
        {/* left */}
        <div className="relative">
          <h1 className="font-hand text-[64px] font-semibold leading-[0.92] tracking-tight sm:text-[84px] xl:text-[98px]">
            <span className="relative inline-block">
              От идеи
              <svg className="absolute -right-14 -top-10 h-14 w-14" viewBox="0 0 60 60">
                <path d="M14 8 L20 26" {...handStroke} strokeWidth={4} className="draw-path" />
                <path d="M34 6 L28 24" {...handStroke} strokeWidth={4} className="draw-path" style={{ animationDelay: "0.2s" }} />
                <path d="M30 34 L48 30" {...handStroke} strokeWidth={4} className="draw-path" style={{ animationDelay: "0.4s" }} />
              </svg>
            </span>
            <br />
            к{" "}
            <span className="relative inline-block" style={{ color: HAND_BLUE }}>
              живым
              <svg className="absolute -bottom-4 left-[-4%] h-7 w-[112%]" viewBox="0 0 300 30" preserveAspectRatio="none">
                <path d="M4 14 C 80 6, 180 6, 296 12" {...handStroke} strokeWidth={4} className="draw-path" style={{ animationDelay: "0.5s" }} />
                <path d="M40 24 C 110 18, 200 18, 260 22" {...handStroke} strokeWidth={3} className="draw-path" style={{ animationDelay: "0.8s" }} />
              </svg>
            </span>
            <br />
            анимациям урока.
          </h1>
          <p className="mt-8 max-w-md text-[16.5px] leading-relaxed text-slate-600">
            Опишите тему словами — ИИ-помощник напишет код анимации, а ArhimedStudio сразу превратит его в видео для объяснения физики,
            математики и информатики.
          </p>

          <div className="relative mt-10 inline-block">
            <button
              onClick={onStart}
              className="group relative z-10 flex items-center gap-3 rounded-full bg-gradient-to-b from-blue-500 to-blue-600 px-8 py-4 text-[17px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(37,99,235,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-8px_rgba(37,99,235,0.8)]"
            >
              Начать
              <ArrowRight size={19} className="transition group-hover:translate-x-1" />
            </button>
            <svg className="absolute -bottom-7 -left-2 h-8 w-[230px]" viewBox="0 0 230 30">
              <path d="M4 12 C 70 6, 150 6, 226 9" fill="none" stroke="#7c3aed" strokeWidth={5} strokeLinecap="round" className="draw-path" style={{ animationDelay: "1s" }} />
              <path d="M30 20 C 90 15, 150 15, 200 18" fill="none" stroke="#7c3aed" strokeWidth={4} strokeLinecap="round" opacity={0.8} className="draw-path" style={{ animationDelay: "1.2s" }} />
            </svg>
            <svg className="absolute -bottom-36 left-[200px] hidden h-36 w-24 sm:block" viewBox="0 0 90 140">
              <path
                d="M10 135 C 60 120, 70 90, 45 80 C 25 72, 25 100, 50 98 C 80 95, 75 50, 40 20"
                {...handStroke}
                className="draw-path"
                style={{ animationDelay: "1.4s" }}
              />
              <path d="M30 26 L40 18 L44 32" {...handStroke} className="draw-path" style={{ animationDelay: "2s" }} />
            </svg>
          </div>
        </div>

        {/* right */}
        <div className="relative lg:py-24">
          {/* swirl backdrop */}
          <svg className="pointer-events-none absolute -left-[15%] top-[2%] h-[110%] w-[125%]" viewBox="0 0 800 600" aria-hidden>
            <defs>
              <radialGradient id="glow" cx="50%" cy="55%" r="55%">
                <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0" />
              </radialGradient>
              <filter id="soft">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
            </defs>
            <ellipse cx="430" cy="330" rx="380" ry="250" fill="url(#glow)" />
            <g filter="url(#soft)" fill="none" strokeLinecap="round">
              {Array.from({ length: 14 }, (_, i) => (
                <path
                  key={i}
                  d={`M ${120 + i * 4} ${470 - i * 3} C ${40 + i * 6} ${300 + i * 5}, ${260 + i * 8} ${150 - i * 4}, ${560 + i * 5} ${170 + i * 3} S ${760 - i * 4} ${430 + i * 2}, ${520 + i * 3} ${520 - i * 2}`}
                  stroke={i % 3 === 0 ? "#a5b4fc" : "#c4b5fd"}
                  strokeOpacity={0.18 + (i % 4) * 0.05}
                  strokeWidth={6 + (i % 5) * 3}
                />
              ))}
            </g>
          </svg>

          <div className="float-slow relative" style={{ perspective: "2000px" }}>
            <div
              className="relative"
              style={{ transform: "rotateY(-14deg) rotateX(7deg) rotateZ(-2.5deg)", transformStyle: "preserve-3d" }}
            >
              <MockStudio />
            </div>
          </div>

          <Note
            n={1}
            title="ИИ-чат"
            text="Опишите идею, и ИИ соберёт её вместе с вами."
            className="left-[18%] top-[-2%]"
            icon={
              <svg width="44" height="34" viewBox="0 0 44 34">
                <path d="M4 4 H30 V20 H14 L8 26 V20 H4 Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
                <path d="M34 10 H40 V26 H36 V31 L31 26 H20 V23" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
              </svg>
            }
          />
          <svg className="pointer-events-none absolute left-[34%] top-[11%] hidden h-20 w-16 lg:block" viewBox="0 0 60 80">
            <path d="M6 8 C 40 6, 52 30, 44 70" {...handStroke} className="draw-path" style={{ animationDelay: "1.6s" }} />
            <path d="M36 60 L44 72 L52 60" {...handStroke} className="draw-path" style={{ animationDelay: "2.1s" }} />
          </svg>

          <Note
            n={2}
            title="Живое превью"
            text="Анимация оживает мгновенно."
            className="right-[2%] top-[-5%]"
            icon={
              <svg width="30" height="28" viewBox="0 0 30 28">
                <rect x="2" y="3" width="26" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth={2} />
                <path d="M2 9 H28" stroke="currentColor" strokeWidth={2} />
                <path d="M12 13 L19 17 L12 21 Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
              </svg>
            }
          />
          <svg className="pointer-events-none absolute right-[-1%] top-[9%] hidden h-24 w-14 lg:block" viewBox="0 0 50 90">
            <path d="M20 4 C 48 20, 50 60, 18 82" {...handStroke} className="draw-path" style={{ animationDelay: "1.8s" }} />
            <path d="M16 70 L16 84 L30 84" {...handStroke} className="draw-path" style={{ animationDelay: "2.3s" }} />
          </svg>

          <Note
            n={3}
            title="Полный код Manim"
            text="Тонкая настройка — прямо в коде."
            className="bottom-[-4%] right-[6%]"
            icon={<span className="font-sans text-[24px] font-light">&lt;/&gt;</span>}
          />
          <svg className="pointer-events-none absolute bottom-[8%] right-[-2%] hidden h-24 w-14 lg:block" viewBox="0 0 50 90">
            <path d="M24 86 C 50 60, 44 20, 12 8" {...handStroke} className="draw-path" style={{ animationDelay: "2s" }} />
            <path d="M12 22 L10 8 L24 6" {...handStroke} className="draw-path" style={{ animationDelay: "2.5s" }} />
          </svg>
        </div>
      </main>

      <section id="how" className="relative z-10 mx-auto max-w-[1400px] px-6 pb-16 sm:px-12 lg:px-20">
        <div className="grid gap-4 border-t border-slate-100 pt-10 sm:grid-cols-3">
          {[
            { n: "01", t: "Опишите тему", d: "«Покажи, как точка на окружности рисует синусоиду» — обычным языком, как ученикам." },
            { n: "02", t: "ИИ пишет код", d: "Ассистент генерирует сцену на Manim: формулы, графики, фигуры и анимации." },
            { n: "03", t: "Скачайте видео", d: "Правьте код или просите изменения в чате, затем сохраните ролик для урока." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl p-5 transition hover:bg-slate-50">
              <div className="font-hand text-[28px] font-semibold" style={{ color: HAND_BLUE }}>{s.n}</div>
              <div className="mt-1 text-[16px] font-semibold text-slate-900">{s.t}</div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-[1400px] flex-wrap gap-8 px-6 pb-8 text-[13.5px] text-slate-500 sm:px-12 lg:px-20">
        <a href="#" className="hover:text-slate-800">Тарифы</a>
        <a href="#" className="hover:text-slate-800">Условия использования</a>
        <a href="#" className="hover:text-slate-800">Политика конфиденциальности</a>
        <span className="ml-auto">© {new Date().getFullYear()} ArhimedStudio</span>
      </footer>
    </div>
  );
}

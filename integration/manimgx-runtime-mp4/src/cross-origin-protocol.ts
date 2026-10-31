export const CROSS_ORIGIN_PROTOCOL = "arhimed-runtime-v1" as const;
/** Large enough for authored lessons, while still bounding a MessageChannel command. */
export const CROSS_ORIGIN_MAX_SOURCE_BYTES = 262_144;

export type RuntimeCommand = {
  protocol: typeof CROSS_ORIGIN_PROTOCOL;
  sessionId: string;
  revision: number;
  requestId: string;
  kind: "probe" | "run" | "cancel" | "export-mp4";
  fps?: number;
  source?: string;
  label?: "simple" | "reactive" | "restart";
};

export type RuntimeEvent = {
  protocol: typeof CROSS_ORIGIN_PROTOCOL;
  sessionId: string;
  revision: number;
  requestId: string;
  kind: "ready" | "status" | "probe" | "rendered" | "stopped" | "failed" | "rejected" | "export-progress" | "exported";
  detail: string;
  data?: Record<string, boolean | number | string | null> | ArrayBuffer;
  progress?: number;
  capabilities?: { mp4Export: boolean };
};

export const SIMPLE_SCENE = `import manimgx as m

class CrossOriginScene(m.Scene):
    def construct(self):
        circle = m.Circle(color=m.BLUE, fill_opacity=0.3)
        label = m.Text("Cross-origin ManimGX").next_to(circle, m.DOWN)
        self.play(m.Create(circle), m.Write(label), run_time=0.2)
        self.wait(0.1)
`;

export const REACTIVE_SCENE = `import manimgx as m

class ReactiveScene(m.Scene):
    def construct(self):
        value = m.ValueTracker(0)
        dot = m.always_redraw(lambda: m.Dot(point=[value.get_value() - 1, 0, 0], color=m.YELLOW))
        self.add(dot)
        self.play(value.animate.set_value(2), run_time=0.25)
        self.wait(0.1)
`;

/** Exercises browser-supported documented 0.1.1 features, not just the Stage 1 demo. */
export const DOCUMENTED_SCENE = `from manimgx import *
import math
import numpy as np

class DocumentedApiScene(Scene):
    def construct(self):
        title = Text("ManimGX: формула и график", font_size=34).to_edge(UP)
        axes = Axes(x_range=[-3, 3, 1], y_range=[-1.5, 1.5, 1], x_length=8, y_length=3.8, tips=False)
        curve = axes.plot(lambda x: math.sin(x), x_range=[-3, 3], color=TEAL)
        formula = MathTex(r"f(x)=\\sin(x)", color=YELLOW).next_to(title, DOWN)
        tracker = ValueTracker(-2.4)
        marker = always_redraw(lambda: Dot(axes.c2p(tracker.get_value(), np.sin(tracker.get_value())), color=YELLOW))
        samples = VGroup(*(Dot(axes.c2p(x, math.sin(x)), radius=0.045, color=BLUE) for x in [-2, -1, 0, 1, 2]))
        self.play(Write(title), Create(axes), run_time=0.15)
        self.play(Create(curve), Write(formula), LaggedStart(*[FadeIn(dot) for dot in samples], lag_ratio=0.08), run_time=0.2)
        self.add(marker)
        self.play(tracker.animate.set_value(2.4), TransformMatchingTex(formula, MathTex(r"f(x)=\\sin(x)", color=TEAL).next_to(title, DOWN)), run_time=0.25)
        self.wait(0.1)
`;

import { expect, test } from "@playwright/test";

const publishedStudio = "https://resarytrew.github.io/arhimedstudio/#/studio";
const gxScene = `from manimgx import *
import math
import numpy as np

class FullBrowserScene(Scene):
    def construct(self):
        title = Text("MathTex и динамический график", font_size=34).to_edge(UP)
        axes = Axes(x_range=[-3, 3, 1], y_range=[-1.5, 1.5, 1], x_length=8.5, y_length=4.2, tips=False)
        sine = axes.plot(lambda x: math.sin(x), x_range=[-3, 3], color=TEAL)
        formula = MathTex(r"f(x)=\\sin(x)", color=YELLOW).next_to(title, DOWN)
        value = ValueTracker(-2.4)
        marker = always_redraw(lambda: Dot(axes.c2p(value.get_value(), np.sin(value.get_value())), color=YELLOW))
        samples = VGroup(*(Dot(axes.c2p(x, math.sin(x)), radius=0.045, color=BLUE) for x in [-2, -1, 0, 1, 2]))
        self.play(Write(title), Create(axes), run_time=0.2)
        self.play(Create(sine), Write(formula), LaggedStart(*[FadeIn(dot) for dot in samples], lag_ratio=0.08), run_time=0.25)
        self.add(marker)
        self.play(value.animate.set_value(2.4), TransformMatchingTex(formula, MathTex(r"f(x)=\\sin(x)", color=TEAL).next_to(title, DOWN)), run_time=0.3)
        self.wait(0.1)
`;

test("published Studio completes a documented ManimGX scene on the isolated runtime origin", async ({ page }) => {
  await page.goto(publishedStudio);
  const engine = page.getByLabel("Движок сцены");
  await engine.selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(gxScene);
  const runtimeFrame = page.getByLabel("Isolated ManimGX runtime");
  await expect(runtimeFrame).toBeVisible({ timeout: 45_000 });
  const runtime = runtimeFrame.contentFrame();
  await expect.poll(async () => runtime.locator("manimgx-player").evaluate((player) => player.shadowRoot?.querySelector("canvas")?.width ?? 0)).toBeGreaterThan(0);
  await expect.poll(async () => runtime.locator("manimgx-player").evaluate((player) => {
    const view = player as HTMLElement & { currentTime: number; duration: number };
    return Number.isFinite(view.duration) && view.currentTime >= view.duration;
  }), { timeout: 30_000 }).toBe(true);
  await expect(page.getByText("ManimGX отрисовал сцену в изолированном runtime.")).toBeHidden();
  const scenes = await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem("arhimed.projects.v2") ?? "[]");
    return projects[0]?.scenes ?? [];
  });
  expect(scenes).toHaveLength(2);
  expect(scenes[0]).toMatchObject({ engineId: "arhimed-canvas", source: expect.stringContaining("import manimx as m") });
  expect(scenes[1]).toMatchObject({ engineId: "manimgx-browser", source: gxScene });
  await expect(runtimeFrame).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(runtimeFrame).toHaveAttribute("sandbox", /allow-same-origin/);
  await expect(runtimeFrame).toHaveAttribute("allow", /fullscreen/);
  await expect(runtimeFrame).toHaveJSProperty("allowFullscreen", true);
  await expect.poll(async () => runtime.locator("manimgx-player").evaluate((player) => {
    const height = player.getBoundingClientRect().height;
    return Math.round(height) === Math.round(window.innerHeight);
  })).toBe(true);
});

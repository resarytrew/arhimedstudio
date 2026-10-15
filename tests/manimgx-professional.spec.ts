import { expect, test } from "@playwright/test";

test("the professional ManimGX lesson renders in the isolated runtime", async ({ page }) => {
  await page.goto("https://resarytrew.github.io/arhimedstudio/?stage2=4bec489#/studio");
  const code = `import manimgx as m
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
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(code);
  const runtimeFrame = page.getByLabel("Isolated ManimGX runtime");
  await expect(runtimeFrame).toBeVisible({ timeout: 45_000 });
  const runtime = runtimeFrame.contentFrame();
  await expect.poll(async () => runtime.locator("manimgx-player").evaluate((player) => player.shadowRoot?.querySelector("canvas")?.width ?? 0), { timeout: 60_000 }).toBeGreaterThan(0);
});

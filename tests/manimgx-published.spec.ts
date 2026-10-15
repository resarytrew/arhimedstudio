import { expect, test } from "@playwright/test";

const publishedStudio = "https://resarytrew.github.io/arhimedstudio/?stage2=4bec489#/studio";
const gxScene = `import manimgx as m

class CrossOriginScene(m.Scene):
    def construct(self):
        circle = m.Circle(color=m.BLUE, fill_opacity=0.3)
        label = m.Text("ArhimedStudio ManimGX").next_to(circle, m.DOWN)
        self.play(m.Create(circle), m.Write(label), run_time=0.2)
        self.wait(0.1)
`;

test("published Studio renders an explicitly authored ManimGX scene on the isolated runtime origin", async ({ page }) => {
  await page.goto(publishedStudio);
  const engine = page.getByLabel("Движок сцены");
  await engine.selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(gxScene);
  const runtimeFrame = page.getByLabel("Isolated ManimGX runtime");
  await expect(runtimeFrame).toBeVisible({ timeout: 45_000 });
  const runtime = runtimeFrame.contentFrame();
  await expect.poll(async () => runtime.locator("manimgx-player").evaluate((player) => player.shadowRoot?.querySelector("canvas")?.width ?? 0)).toBeGreaterThan(0);
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

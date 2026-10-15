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
  await expect(page.getByText("ManimGX отрисовал сцену в изолированном runtime.")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel("Isolated ManimGX runtime")).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(page.getByLabel("Isolated ManimGX runtime")).toHaveAttribute("sandbox", /allow-same-origin/);
});

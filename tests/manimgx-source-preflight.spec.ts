import { expect, test } from "@playwright/test";

test("ManimGX preflight catches incomplete snippets, unprefixed animation and invalid frame config", async ({ page }) => {
  await page.goto("/#/studio");
  const checks = await page.evaluate(async () => {
    const { inspectManimGXSource } = await import("/src/lib/manimgx-source-preflight.ts");
    const bare = [
      "import manimgx as m",
      "m.config.pixel_width = 1080",
      "m.config.pixel_height = 1920",
      "m.config.frame_height = 16",
      "m.config.frame_width = 9",
      "class Lesson(m.Scene):",
      "    def construct(self) -> None:",
      "        thing = m.Dot()",
      "        thing.move_to([5, 0, 0])",
      "        self.play(Create(thing))",
    ].join("\n");
    return {
      errors: inspectManimGXSource(bare),
      fragment: inspectManimGXSource("    x_length=6.0,\n"),
      canvas: inspectManimGXSource("import manimx as m\nclass Lesson(m.Scene):\n    def construct(self):\n        self.wait(1)\n"),
      valid: inspectManimGXSource("from manimgx import *\nclass Lesson(Scene):\n    def construct(self) -> None:\n        self.play(Create(Dot()))\n"),
      commented: inspectManimGXSource('import manimgx as m\n# Create(circle)\nclass Lesson(m.Scene):\n    def construct(self):\n        x = "Create(circle)"\n        self.play(m.Create(m.Circle()))\n'),
    };
  });
  expect(checks.errors.map((x: {code: string}) => x.code)).toEqual(["readonly-frame-width", "offscreen-center", "bare-animation"]);
  expect(checks.fragment.map((x: {code: string}) => x.code)).toContain("fragment-indent");
  expect(checks.canvas.map((x: {code: string}) => x.code)).toContain("missing-gx-import");
  expect(checks.valid).toEqual([]);
  expect(checks.commented).toEqual([]);
});

test("preflight panel reports a real authoring mistake without blocking edits", async ({ page }) => {
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  const editor = page.locator("textarea.code-area");
  await editor.fill("import manimgx as m\nclass Lesson(m.Scene):\n    def construct(self):\n        self.play(Create(m.Circle()))\n");
  await page.getByTitle("Проверить Python-сцену").click();
  const panel = page.getByTestId("manimgx-preflight");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Строка 4");
  await expect(panel).toContainText("m.Create");
  await expect(panel).toContainText("Наложения объектов");
  await editor.fill("import manimgx as m\nclass Lesson(m.Scene):\n    def construct(self):\n        self.play(m.Create(m.Circle()))\n");
  await expect(panel).toContainText("Типичных ошибок не найдено.");
  await page.getByTitle("Проверить Python-сцену").click();
  await expect(panel).toHaveCount(0);
});

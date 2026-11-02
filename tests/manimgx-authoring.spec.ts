import { expect, test } from "@playwright/test";

test("ManimGX accepts long educational scenes and documented 3D API", async ({ page }) => {
  await page.goto("/#/studio");
  const result = await page.evaluate(async () => {
    const { validateAiCandidate } = await import("/src/ai/validation.ts");
    const { AI_ENGINE_PROFILES } = await import("/src/ai/profiles.ts");
    const source = `import manimgx as m
m.config.pixel_width = 1080
m.config.pixel_height = 1920

class ThreeDimensionalLesson(m.ThreeDScene):
    def construct(self):
        axes = m.ThreeDAxes()
        title = m.Text("Геометрия", font_size=78)
        self.add(axes)
        self.play(m.Write(title))
        self.play(m.FadeOut(title), run_time=5)
        self.wait(100)
`;
    return {
      gx: validateAiCandidate(source, "manimgx-browser"),
      canvas: validateAiCandidate(source, "arhimed-canvas"),
      gxPrompt: AI_ENGINE_PROFILES["manimgx-browser"].instructions,
      canvasPrompt: AI_ENGINE_PROFILES["arhimed-canvas"].instructions,
    };
  });
  expect(result.gx.status).toBe("warning"); // Large font is a layout warning, not a fatal API error.
  expect(result.gx.diagnostics).toHaveLength(1);
  expect(result.gx.diagnostics[0].message).toContain("Крупный текст");
  expect(result.canvas.status).toBe("rejected");
  expect(result.gxPrompt).toContain("30–120 секунд");
  expect(result.gxPrompt).toContain("config.pixel_width");
  expect(result.gxPrompt).toContain("ThreeDScene");
  expect(result.canvasPrompt).toContain("7–10 секунд");
});

test("ManimGX still rejects forbidden imports and invalid playback durations", async ({ page }) => {
  await page.goto("/#/studio");
  const result = await page.evaluate(async () => {
    const { validateAiCandidate } = await import("/src/ai/validation.ts");
    const start = `import manimgx as m
class Lesson(m.Scene):
    def construct(self):
`;
    return {
      network: validateAiCandidate(start + "        import requests\n        self.wait(2)\n", "manimgx-browser").status,
      eval: validateAiCandidate(start + "        import js\n        self.wait(2)\n", "manimgx-browser").status,
      negative: validateAiCandidate(start + "        self.play(m.Write(m.Text('ok')), run_time=-2)\n", "manimgx-browser").status,
      simple: validateAiCandidate(start + "        self.play(m.Write(m.Text('ok')))\n        self.wait(70)\n", "manimgx-browser").status,
    };
  });
  expect(result).toEqual({ network: "rejected", eval: "rejected", negative: "rejected", simple: "passed" });
});

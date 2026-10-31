import { expect, test } from "@playwright/test";

test("scientific Python examples are offered, validated and selected by the GX assistant", async ({ page }) => {
  await page.goto("/#/studio");
  const results = await page.evaluate(async () => {
    const { SCIENCE_TEMPLATES } = await import("/src/lib/scientific-libraries.ts");
    const { localAssistant } = await import("/src/lib/assistant.ts");
    const { validateAiCandidate } = await import("/src/ai/validation.ts");
    return SCIENCE_TEMPLATES.map(template => {
      const reply = localAssistant(template.prompt, "", true, "manimgx-browser");
      return { id: template.id, title: reply.title, validation: validateAiCandidate(reply.code!, "manimgx-browser"), originalValid: validateAiCandidate(template.code, "manimgx-browser"), canvas: validateAiCandidate(template.code, "arhimed-canvas").status, source: reply.code };
    });
  });
  expect(results).toHaveLength(6);
  for (const result of results) {
    expect(result.validation.status, JSON.stringify(result.validation.diagnostics)).toBe("passed");
    expect(result.originalValid.status, JSON.stringify(result.originalValid.diagnostics)).toBe("passed");
    expect(result.canvas).toBe("rejected");
    expect(result.title).toBeTruthy();
    expect(result.source).toContain("import manimgx as m");
  }
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.getByTitle("Готовые темы").click();
  await expect(page.getByRole("button", { name: "Электроника · RC-цепь", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Биология · от ДНК к белку", exact: true })).toBeVisible();
});

test("adding scientific imports does not allow arbitrary packages or bridge imports", async ({ page }) => {
  await page.goto("/#/studio");
  const results = await page.evaluate(async () => {
    const { validateAiCandidate } = await import("/src/ai/validation.ts");
    return ["requests", "micropip", "js", "os", "subprocess"].map(root => validateAiCandidate(`import manimgx as m\nimport ${root}\nclass Lesson(m.Scene):\n    def construct(self):\n        self.wait(8)\n`, "manimgx-browser").status);
  });
  expect(results.every(status => status === "rejected")).toBe(true);
});

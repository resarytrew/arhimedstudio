import { expect, test } from "@playwright/test";

test("official ManimGX 0.1.1 examples are selectable without rescaling", async ({ page }) => {
  await page.goto("/#/studio");
  const results = await page.evaluate(async () => {
    const { PRO_ANIMATION_TEMPLATES } = await import("/src/lib/pro-animations.ts");
    const { localAssistant } = await import("/src/lib/assistant.ts");
    const { validateAiCandidate } = await import("/src/ai/validation.ts");
    return PRO_ANIMATION_TEMPLATES.map(t => ({
      id: t.id,
      title: t.title,
      hasAttribution: t.code.includes("academa-labs/manimgx v0.1.1"),
      hasScene: /class\\s+\\w+\\s*\\(m\\.Scene\\)/.test(t.code),
      returnedUnmodified: localAssistant(t.prompt, "", true, "manimgx-browser").code === t.code,
      validation: validateAiCandidate(t.code, "manimgx-browser").status,
      canvas: validateAiCandidate(t.code, "arhimed-canvas").status,
    }));
  });
  expect(results).toHaveLength(3);
  for (const result of results) {
    expect(result.hasAttribution).toBe(true);
    expect(result.hasScene).toBe(true);
    expect(result.returnedUnmodified).toBe(true);
    expect(result.validation, result.id).not.toBe("rejected");
    expect(result.canvas).toBe("rejected");
  }
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.getByTitle("Готовые темы").click();
  await expect(page.getByRole("button", { name: "Профессиональная анимация · площадь круга", exact: true })).toBeVisible();
});

import { test, expect } from "@playwright/test";

test("Canvas executes comprehensions, generator arguments, while, defaults and deep inequality", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the browser-only interpreter module.
    const { runScript } = await import("/src/engine/interpreter.ts");
    const timeline = runScript(`import manimx as m
class LanguageFeatures(m.Scene):
    def construct(self):
        points = [x for x in range(5) if x > 1]
        dots = m.VGroup(m.Dot([x, 0, 0]) for x in points)
        self.add(dots)
        equal = [1, 2] == [1, 2]
        different = [1, 2] != [1, 2]
        count = 0
        while count < 2:
            count += 1
        def offset(p=[0, 0, 0]):
            return [p[0] + count, p[1], p[2]]
        mark = m.Dot(offset())
        if equal and not different:
            self.add(mark)
        self.play(m.Create(mark), run_time=0.5)
`);
    return { duration: timeline.duration, count: timeline.final.length };
  });
  expect(result.duration).toBe(0.5);
  expect(result.count).toBeGreaterThan(0);
});

test("syntax highlighting escapes markup and rejects injected color values", async ({ page }) => {
  await page.goto("/");
  const html = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the browser-only editor module.
    const { highlight } = await import("/src/components/CodeEditor.tsx");
    return highlight(`value = "rgb(0,0,0);\" onmouseover=\"alert(1)<img src=x onerror=alert(2)>"`);
  });
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img");
  expect(html).toContain("&quot;rgb(0,0,0);");
  expect(html).not.toMatch(/style="[^"]*(?:onmouseover|onerror)/);
});

test("typing bursts keep a stable current revision id and a bounded history", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the browser-only store module.
    const { newProject, updateSceneSource, activeScene } = await import("/src/lib/store.ts");
    const project = newProject("Revision test", "initial");
    const first = updateSceneSource(project, "first edit");
    const firstId = activeScene(first).currentRevision;
    const second = updateSceneSource(first, "second edit");
    return {
      currentIdStable: activeScene(second).currentRevision === firstId,
      revisions: activeScene(second).revisions.length,
      currentSource: activeScene(second).source,
    };
  });
  expect(result).toEqual({ currentIdStable: true, revisions: 2, currentSource: "second edit" });
});

test("pending project edits flush to storage on a fast page reload", async ({ page }) => {
  await page.goto("/#/studio");
  const editor = page.locator("textarea.code-area");
  await expect(editor).toBeVisible();
  const source = "import manimx as m\n\nclass FastSave(m.Scene):\n    def construct(self):\n        self.wait(1)\n";
  await editor.fill(source);
  await page.reload();
  await expect(page.locator("textarea.code-area")).toHaveValue(source);
});


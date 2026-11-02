import { expect, test } from "@playwright/test";

const RUNTIME_URL = "https://arhimed-runtime.github.io/cross-origin-runtime.html";

const fakePythonError = String.raw`<!doctype html><html><body><script>
  addEventListener("message", event => {
    if (event.data?.protocol !== "arhimed-runtime-v1" ||
        event.data?.kind !== "connect" || event.ports.length !== 1) return;
    const port = event.ports[0], sessionId = event.data.sessionId;
    port.onmessage = ({data}) => {
      if (data.kind !== "run") return;
      port.postMessage({
        protocol: "arhimed-runtime-v1", sessionId,
        revision: data.revision, requestId: data.requestId, kind: "failed",
        detail: 'Traceback (most recent call last):\n  File "/home/pyodide/films/1/scene.py", line 81, in construct\n    bad_method()\nNameError: name bad_method is not defined'
      });
    };
    port.start();
    port.postMessage({
      protocol: "arhimed-runtime-v1", sessionId, revision: 0,
      requestId: "connect", kind: "ready", capabilities: { mp4Export: false }
    });
  });
</script></body></html>`;

test("Python diagnostic parser targets the author's last scene frame", async ({ page }) => {
  await page.goto("/#/studio");
  const lines = await page.evaluate(async () => {
    const { sceneLineFromTraceback } = await import("/src/lib/python-diagnostics.ts");
    return {
      error: sceneLineFromTraceback('  File "/home/pyodide/films/1/scene.py", line 71\nNameError'),
      nested: sceneLineFromTraceback('File "/home/pyodide/films/1/scene.py", line 3\n  File "/home/pyodide/films/1/scene.py", line 82'),
      internal: sceneLineFromTraceback('File "/home/pyodide/site-packages/manimgx/scene.py", line 30'),
      invalid: sceneLineFromTraceback('runtime crashed without Python traceback')
    };
  });
  expect(lines).toEqual({ error: 71, nested: 82, internal: undefined, invalid: undefined });
});

test("ManimGX traceback scrolls the editor to its authored line", async ({ page }) => {
  await page.route(RUNTIME_URL, route => route.fulfill({
    status: 200, contentType: "text/html", body: fakePythonError,
  }));
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  const editor = page.locator("textarea.code-area");
  const python = [
    "import manimgx as m",
    "class Lesson(m.Scene):",
    "    def construct(self):",
    ...Array.from({ length: 100 }, (_, i) => "        # author line " + (i + 4)),
  ].join("\n");
  await editor.fill(python);
  await expect(page.getByText(/NameError: name bad_method is not defined/).first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => editor.evaluate(el => (el as HTMLTextAreaElement).scrollTop)).toBeGreaterThan(0);
});

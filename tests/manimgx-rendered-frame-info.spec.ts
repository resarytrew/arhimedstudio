import { expect, test } from "@playwright/test";

const RUNTIME_URL = "https://arhimed-runtime.github.io/cross-origin-runtime.html";

const mockRuntime = String.raw`<!doctype html><html><body><script>
  addEventListener("message", event => {
    if (event.data?.protocol !== "arhimed-runtime-v1" ||
        event.data.kind !== "connect" || event.ports.length !== 1) return;
    const port = event.ports[0], sessionId = event.data.sessionId;
    port.onmessage = ({data: command}) => {
      if (command.kind !== "run") return;
      port.postMessage({
        protocol: "arhimed-runtime-v1", sessionId, revision: command.revision,
        requestId: command.requestId, kind: "rendered", detail: "Mock scene complete",
        data: {canvasWidth: 720, canvasHeight: 1280, duration: 97.5}
      });
    };
    port.start();
    port.postMessage({
      protocol: "arhimed-runtime-v1", sessionId, revision: 0,
      requestId: "connect", kind: "ready", capabilities: {mp4Export: false}
    });
  });
</script></body></html>`;

test("rendered metadata parser validates runtime dimensions and duration", async ({ page }) => {
  await page.goto("/#/studio");
  const results = await page.evaluate(async () => {
    const { renderedFrameInfo } = await import("/src/engines/manimgx-browser-adapter.ts");
    return [
      renderedFrameInfo({ canvasWidth: 1080, canvasHeight: 1920, duration: 90 }),
      renderedFrameInfo({ canvasWidth: 0, canvasHeight: 1920, duration: 90 }),
      renderedFrameInfo({ canvasWidth: 1280, canvasHeight: 720, duration: NaN }),
      renderedFrameInfo(new ArrayBuffer(12)),
    ];
  });
  expect(results).toEqual([{ width: 1080, height: 1920, duration: 90 }, undefined, undefined, undefined]);
});

test("Studio displays the actual WebGPU preview properties from the isolated runtime", async ({ page }) => {
  await page.route(RUNTIME_URL, route => route.fulfill({
    status: 200, contentType: "text/html", body: mockRuntime,
  }));
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  const editor = page.locator("textarea.code-area");
  await editor.fill("import manimgx as m\nclass Lesson(m.Scene):\n    def construct(self):\n        self.wait(1)\n");
  const info = page.getByTestId("rendered-frame-info");
  await expect(info).toContainText("720×1280", { timeout: 20_000 });
  await expect(info).toContainText("97.5 с");
  await expect(info).toContainText("MP4");
  await editor.fill("import manimgx as m\nclass Lesson2(m.Scene):\n    def construct(self):\n        self.wait(2)\n");
  await expect(info).toContainText("720×1280", { timeout: 20_000 });
  await page.getByLabel("Движок сцены").selectOption("arhimed-canvas");
  await expect(info).toHaveCount(0);
});

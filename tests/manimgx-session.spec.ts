import { expect, test } from "@playwright/test";

const RUNTIME_URL = "https://arhimed-runtime.github.io/cross-origin-runtime.html";

/**
 * The fake runtime exercises only the authenticated adapter lifecycle.
 * It never claims that hardware WebGPU or 3D scene rendering succeeded.
 */
const mockRuntime = String.raw`<!doctype html>
<html><body><script>
  window.receivedRuns = [];
  let connected = false;
  window.addEventListener("message", (event) => {
    if (connected || event.data?.protocol !== "arhimed-runtime-v1" ||
        event.data?.kind !== "connect" || event.ports.length !== 1) return;
    connected = true;
    const sessionId = event.data.sessionId;
    const port = event.ports[0];
    port.onmessage = ({ data: command }) => {
      if (command.protocol !== "arhimed-runtime-v1" || command.sessionId !== sessionId) return;
      if (command.kind === "run") {
        window.receivedRuns.push({ source: command.source, revision: command.revision });
        port.postMessage({
          protocol: "arhimed-runtime-v1", sessionId, revision: command.revision,
          requestId: command.requestId, kind: "rendered", detail: "Mock render finished",
        });
        // A response for a superseded revision must not disrupt the new scene.
        setTimeout(() => port.postMessage({
          protocol: "arhimed-runtime-v1", sessionId, revision: command.revision,
          requestId: command.requestId, kind: "failed", detail: "stale-revision-error",
        }), 250);
      }
    };
    port.start();
    port.postMessage({
      protocol: "arhimed-runtime-v1", sessionId, revision: 0,
      requestId: "connect", kind: "ready", detail: "Authenticated mock runtime",
    });
  });
</script></body></html>`;

test("ManimGX keeps one authenticated runtime across Python source edits", async ({ page }) => {
  let boots = 0;
  await page.route(RUNTIME_URL, async (route) => {
    boots += 1;
    await route.fulfill({ status: 200, contentType: "text/html", body: mockRuntime });
  });

  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  const editor = page.locator("textarea.code-area");
  const frame = page.getByLabel("Isolated ManimGX runtime");
  const source1 = "import manimgx as m\nclass First(m.Scene):\n    def construct(self):\n        self.add(m.Circle())\n";
  const source2 = "import manimgx as m\nclass Second(m.ThreeDScene):\n    def construct(self):\n        self.add(m.Cube())\n";

  await editor.fill(source1);
  await expect(frame).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => frame.contentFrame().locator("body").evaluate(
    (body) => (body.ownerDocument.defaultView as Window & { receivedRuns?: unknown[] }).receivedRuns?.length ?? 0,
  )).toBeGreaterThan(0);

  await frame.evaluate((element) => element.setAttribute("data-stable-runtime", "kept"));
  await editor.fill(source2);

  await expect.poll(async () => frame.contentFrame().locator("body").evaluate(
    (body) => (body.ownerDocument.defaultView as Window & { receivedRuns?: Array<{ source: string }> }).receivedRuns?.at(-1)?.source ?? "",
  )).toBe(source2);
  await expect(frame).toHaveAttribute("data-stable-runtime", "kept");
  await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(frame).toHaveAttribute("sandbox", /allow-same-origin/);
  await page.waitForTimeout(500);
  await expect(page.getByText("stale-revision-error")).toHaveCount(0);
  expect(boots).toBe(1);
});

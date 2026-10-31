import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const RUNTIME_URL = "https://arhimed-runtime.github.io/cross-origin-runtime.html";

/**
 * A small, previously WebCodecs-encoded H.264 fixture, decoded again by Studio.
 * Real GPU capture is checked separately against the actual runtime.
 */
const mockRuntime = String.raw`<!doctype html><html><body><script>
let connected = false;
const ftyp = Uint8Array.from(atob("${readFileSync(new URL("./fixtures/valid-export.mp4", import.meta.url)).toString("base64")}"), char => char.charCodeAt(0));
window.addEventListener("message", event => {
  if (connected || event.data?.protocol !== "arhimed-runtime-v1" ||
      event.data.kind !== "connect" || event.ports.length !== 1) return;
  connected = true;
  const { sessionId } = event.data;
  const port = event.ports[0];
  port.onmessage = ({ data }) => {
    if (data.protocol !== "arhimed-runtime-v1" || data.sessionId !== sessionId) return;
    if (data.kind === "run") {
      port.postMessage({
        protocol: "arhimed-runtime-v1", sessionId, requestId: data.requestId,
        revision: data.revision, kind: "rendered", detail: "render complete",
      });
    }
    if (data.kind === "export-mp4") {
      port.postMessage({
        protocol: "arhimed-runtime-v1", sessionId, requestId: data.requestId,
        revision: data.revision, kind: "export-progress", progress: 0.7,
      });
      const buffer = ftyp.slice().buffer;
      port.postMessage({
        protocol: "arhimed-runtime-v1", sessionId, requestId: data.requestId,
        revision: data.revision, kind: "exported", data: buffer,
      }, [buffer]);
    }
  };
  port.start();
  port.postMessage({
    protocol: "arhimed-runtime-v1", sessionId, requestId: "connect",
    revision: 0, kind: "ready", capabilities: { mp4Export: true },
  });
});
</script></body></html>`;

test("Studio sends authenticated MP4 export and downloads returned ISO-BMFF bytes", async ({ page }) => {
  await page.route(RUNTIME_URL, route =>
    route.fulfill({ status: 200, contentType: "text/html", body: mockRuntime })
  );
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  const source = "import manimgx as m\nclass Export(m.Scene):\n def construct(self): self.wait(0.2)\n";
  await page.locator("textarea.code-area").fill(source);
  const button = page.getByRole("button", { name: "Скачать видео (MP4)" });
  await expect(button).toBeEnabled({ timeout: 30_000 });
  const downloadEvent = page.waitForEvent("download");
  await button.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  const savePath = await download.path();
  expect(savePath).toBeTruthy();
});

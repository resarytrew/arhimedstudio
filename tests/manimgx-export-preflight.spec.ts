import { expect, test } from "@playwright/test";

test("MP4 preflight enforces pinned runtime duration, frame and pixel limits", async ({ page }) => {
  await page.goto("/#/studio");
  const cases = await page.evaluate(async () => {
    const { getMp4ExportPreflight } = await import("/src/lib/manimgx-export-preflight.ts");
    const ids = (width: number, height: number, duration: number, fps = 30) =>
      getMp4ExportPreflight({ width, height, duration }, fps).map(x => ({ code: x.code, blocking: x.blocking }));
    return {
      ok: ids(1280, 720, 90),
      portrait: ids(1080, 1920, 180),
      tooLong: ids(1280, 720, 181),
      tooManyFrames: ids(1280, 720, 180, 60),
      tooLarge: ids(3840, 2160, 40),
      odd: ids(721, 1281, 1),
      small: ids(640, 360, 2),
      none: getMp4ExportPreflight(null),
    };
  });
  expect(cases.ok).toEqual([]);
  expect(cases.portrait).toEqual([]);
  expect(cases.tooLong).toContainEqual({ code: "duration", blocking: true });
  expect(cases.tooManyFrames).toEqual([]); // 180 sec at 60 fps equals the 10,800-frame limit.
  expect(cases.tooLarge).toContainEqual({ code: "canvas-size", blocking: true });
  expect(cases.odd).toContainEqual({ code: "odd-size", blocking: false });
  expect(cases.small).toContainEqual({ code: "small-preview", blocking: false });
  expect(cases.none).toEqual([]);
});

const runtime = String.raw`<!doctype html><html><body><script>
  addEventListener("message", event => {
    if (event.data?.protocol !== "arhimed-runtime-v1" ||
        event.data.kind !== "connect" || event.ports.length !== 1) return;
    const port = event.ports[0], sessionId = event.data.sessionId;
    port.onmessage = ({data: command}) => {
      if (command.kind !== "run") return;
      port.postMessage({
        protocol: "arhimed-runtime-v1", sessionId, revision: command.revision,
        requestId: command.requestId, kind: "rendered", detail: "Mock scene",
        data: {canvasWidth: 1280, canvasHeight: 720, duration: 190}
      });
    };
    port.start();
    port.postMessage({
      protocol: "arhimed-runtime-v1", sessionId, revision: 0,
      requestId: "connect", kind: "ready", capabilities: {mp4Export: true}
    });
  });
</script></body></html>`;

test("Studio warns before export when runtime would reject a too-long scene", async ({ page }) => {
  await page.route("https://arhimed-runtime.github.io/cross-origin-runtime.html",
    route => route.fulfill({ status: 200, contentType: "text/html", body: runtime }));
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(
    "import manimgx as m\nclass Lesson(m.Scene):\n    def construct(self):\n        self.wait(190)\n"
  );
  const info = page.getByTestId("mp4-export-preflight");
  await expect(info).toContainText("180 с", { timeout: 20_000 });
  await expect(info).toContainText("Экспорт MP4 недоступен");
  await expect(page.getByTitle("Скачать видео (MP4)")).toBeDisabled();
});

import { expect, test } from "@playwright/test";

const enabled = process.env.ARHIMED_TEST_MP4_ENCODER === "1";
test.skip(!enabled, "Runs against the patched ManimGX runtime Vite server at localhost:4185.");

test("runtime MP4 exporter writes a real H.264 video decodable by Chrome", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("http://127.0.0.1:4185/mp4-encoding-test.html", route =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>MP4 encoding fixture</body></html>" }),
  );
  await page.goto("http://127.0.0.1:4185/mp4-encoding-test.html");

  const result = await page.evaluate(async () => {
    if (typeof VideoEncoder === "undefined") {
      return { supported: false, reason: "VideoEncoder unavailable" };
    }
    const supported = await Promise.all(["avc1.640028", "avc1.4d4028", "avc1.42001f"].map(
      codec => VideoEncoder.isConfigSupported({
        codec, width: 640, height: 360, framerate: 30, bitrate: 1_500_000,
      }).then(result => result.supported).catch(() => false),
    ));
    if (!supported.some(Boolean)) return { supported: false, reason: "H.264 encoder unavailable" };

    const { exportManimGXMp4 } = await import("http://127.0.0.1:4185/src/mp4-export.ts");
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    shadow.append(canvas);
    const ctx = canvas.getContext("2d")!;
    let time = 0;
    let paused = true;
    Object.defineProperties(host, {
      duration: { value: 0.4 },
      paused: { get: () => paused },
      currentTime: {
        get: () => time,
        set: (value: number) => {
          time = value;
          requestAnimationFrame(() => {
            ctx.fillStyle = time > 0.2 ? "#19b5fe" : "#e63d6a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          });
        },
      },
      pause: { value: () => { paused = true; } },
      play: { value: () => { paused = false; } },
    });
    const progress: number[] = [];
    const file = await exportManimGXMp4(host, {
      fps: 30,
      signal: new AbortController().signal,
      onProgress: value => progress.push(value),
    });
    const bytes = new Uint8Array(file);
    const brand = String.fromCharCode(...bytes.slice(4, 8));
    const video = document.createElement("video");
    video.preload = "auto";
    video.src = URL.createObjectURL(new Blob([file], { type: "video/mp4" }));
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Chrome rejected generated H.264 MP4"));
      setTimeout(() => reject(new Error("MP4 metadata decode timeout")), 12_000);
    });
    const data = {
      supported: true, brand, bytes: bytes.length, seconds: video.duration,
      width: video.videoWidth, height: video.videoHeight, progress: progress.at(-1),
    };
    URL.revokeObjectURL(video.src);
    return data;
  });

  // A machine without an H.264 encoder cannot prove video export.
  test.skip(result.supported === false, result.reason ?? "Encoder not available");
  expect(result.brand).toBe("ftyp");
  expect(result.bytes).toBeGreaterThan(500);
  expect(result.seconds).toBeGreaterThan(0.3);
  expect(result.width).toBe(640);
  expect(result.height).toBe(360);
  expect(result.progress).toBe(1);
});

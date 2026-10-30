import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const enabled = process.env.ARHIMED_MANIMGX_3D === "1";
test.skip(!enabled, "Requires real WebGPU hardware and access to the published cross-origin ManimGX runtime.");

test("ManimGX 0.1.1 renders a genuine 3D MEMS scene with moving camera and MathTex", async ({ page }) => {
  test.setTimeout(180_000);
  // This is the accepted parent origin in the published runtime's strict allowlist.
  await page.goto("https://resarytrew.github.io/arhimedstudio/#/studio");
  const code = readFileSync("examples/manimgx/mems-capacitive-accelerometer.py", "utf8");

  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(code);

  const frame = page.getByLabel("Isolated ManimGX runtime");
  await expect(frame).toBeVisible({ timeout: 45_000 });
  await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(frame).toHaveAttribute("sandbox", /allow-same-origin/);
  const player = frame.contentFrame().locator("manimgx-player");

  // The player exposes duration=NaN until Python has produced a real film.
  // A successful shader/camera/surface setup must then play the whole sequence.
  await expect.poll(() => player.evaluate((element) => {
    const view = element as HTMLElement & { duration: number };
    return view.duration;
  }), { timeout: 120_000 }).toBeGreaterThan(8);

  await expect.poll(() => player.evaluate((element) => {
    const view = element as HTMLElement & { duration: number; currentTime: number };
    return Number.isFinite(view.duration) && view.currentTime >= view.duration;
  }), { timeout: 45_000 }).toBe(true);

  await expect.poll(() => player.evaluate((element) => {
    const canvas = element.shadowRoot?.querySelector("canvas");
    const message = element.shadowRoot?.querySelector("p")?.textContent ?? "";
    return Boolean(canvas && canvas.width > 0 && canvas.height > 0 && !/can't draw|could not start/i.test(message));
  })).toBe(true);
});

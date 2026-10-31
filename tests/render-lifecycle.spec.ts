import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const encoded = readFileSync(new URL("./fixtures/valid-export.mp4", import.meta.url)).toString("base64");
const runtimeUrl = "https://arhimed-runtime.github.io/cross-origin-runtime.html";
const source = "import manimgx as m\nclass Lesson(m.Scene):\n def construct(self): self.wait(1)\n";
function runtime(modes: string[]) {
  return `<!doctype html><body><script>
  let count=0;
  addEventListener('message',event=>{
    if(event.data?.kind!=='connect'||event.ports.length!==1)return;
    const port=event.ports[0], sessionId=event.data.sessionId;
    const send=(command,kind,extra={})=>port.postMessage({protocol:'arhimed-runtime-v1',sessionId,revision:command.revision,requestId:command.requestId,kind,...extra});
    port.onmessage=({data})=>{
      if(data.kind==='run'){
        if(data.source.includes('HANG'))return;
        if(data.source.includes('FAIL')){send(data,'failed',{detail:'ValueError: lesson failed'});return;}
        send(data,'render-log',{stream:'stdout',detail:'Python output\\n'});
        send(data,'rendered');
      }
      if(data.kind==='cancel-export'&&${!modes.includes("no-ack")})send(data,'export-cancelled');
      if(data.kind==='export-mp4'){
        const mode=${JSON.stringify(modes)}[count++]||'valid';
        const bytes=mode==='empty'?new Uint8Array():mode==='invalid'?new Uint8Array([0,0,0,12,102,116,121,112,105,115,111,109]):Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0));
        if(mode==='pending')return;
        if(mode==='missing'){send(data,'exported');return;}
        const finish=()=>send(data,'exported',{data:bytes.buffer});
        if(mode==='late')setTimeout(finish,2000);else finish();
      }
    };
    port.start();send({revision:0,requestId:'connect'},'ready',{capabilities:{mp4Export:true}});
  });</script></body>`;
}

test("job state machine has one terminal state, bounded logs and enforced deadlines", async ({ page }) => {
  await page.goto("/#/studio");
  await page.clock.install();
  await page.evaluate(async () => {
    const { RenderJobController } = await import("/src/rendering/jobs.ts");
    const state = { states: [] as string[], stopped: 0, job: null as any };
    state.job = new RenderJobController({ projectId:"p", sceneId:"s", revision:"r", requestId:"j" }, "preview", job => state.states.push(job.status));
    state.job.log("stdout", "x".repeat(90000));
    state.job.start(1000, () => state.stopped++);
    (window as any).lifecycleTest = state;
  });
  await page.clock.fastForward(1100);
  const result = await page.evaluate(() => {
    const state = (window as any).lifecycleTest;
    state.job.complete(); state.job.cancel();
    return { states: state.states, stopped: state.stopped, job: state.job.snapshot };
  });
  expect(result.states).toContain("queued");
  expect(result.states.at(-1)).toBe("failed");
  expect(result.stopped).toBe(1);
  expect(result.job.stdout).toHaveLength(64000);
  expect(result.job.error).toContain("время");
  expect(result.job.peakMemoryMB).toBeNull();
});

test("failed and cancelled exports preserve a downloadable last successful video across reload", async ({ page }) => {
  await page.route(runtimeUrl, route => route.fulfill({ contentType:"text/html", body:runtime(["valid", "missing", "empty", "invalid", "late"]) }));
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(source);
  const exportButton = page.getByRole("button", { name:"Скачать видео (MP4)" });
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "completed");
  let download = page.waitForEvent("download");
  await exportButton.click(); await download;
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "completed");
  const last = page.getByRole("button", { name:"Скачать последнее успешное видео" });
  await expect(last).toBeVisible();
  for (let attempt=0;attempt<3;attempt++) {
    await exportButton.click();
    await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "failed");
    await expect(last).toBeVisible();
  }
  await exportButton.click();
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "running");
  await page.getByRole("button", { name:"Отменить экспорт", exact:true }).click();
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "cancelled");
  await page.waitForTimeout(2200);
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "cancelled");
  await page.locator("textarea.code-area").fill(source+"# FAIL");
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "failed");
  await expect(page.getByLabel("Isolated ManimGX runtime")).toHaveCount(0);
  await expect(last).toBeVisible();
  await page.reload();
  await expect(last).toBeVisible();
  download = page.waitForEvent("download");
  await last.click();
  expect((await download).suggestedFilename()).toMatch(/\.mp4$/);
  await page.screenshot({ path: test.info().outputPath("last-successful-video.png") });
  await page.getByTitle("Новое видео", { exact:true }).click();
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await expect(last).toHaveCount(0);
});

test("a hanging preview can be cancelled and retried; its deadline destroys the iframe", async ({ page }) => {
  let boots=0;
  await page.route(runtimeUrl, route => { boots++; return route.fulfill({ contentType:"text/html", body:runtime([]) }); });
  await page.goto("/#/studio");
  await page.clock.install();
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(source+"# HANG");
  await page.clock.runFor(500);
  await expect(page.getByLabel("Isolated ManimGX runtime")).toBeVisible();
  await page.getByRole("button", { name:"Отменить рендеринг" }).click();
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "cancelled");
  await expect(page.getByLabel("Isolated ManimGX runtime")).toHaveCount(0);
  await page.getByRole("button", { name:"Повторить рендеринг" }).click();
  await page.clock.runFor(500);
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "running");
  await page.clock.fastForward(5*60_000+1000);
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "failed");
  await expect(page.getByLabel("Isolated ManimGX runtime")).toHaveCount(0);
  await page.locator("textarea.code-area").fill(source);
  await page.clock.runFor(500);
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "completed");
  expect(boots).toBeGreaterThanOrEqual(3);
});

test("export deadline fails the job and terminates a runtime that does not respond", async ({ page }) => {
  await page.route(runtimeUrl, route => route.fulfill({ contentType:"text/html", body:runtime(["pending"]) }));
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(source);
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "completed");
  await page.clock.install();
  await page.getByRole("button", { name:"Скачать видео (MP4)" }).click();
  await page.clock.runFor(50);
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "running");
  await page.clock.fastForward(20*60_000+1000);
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "failed");
  await expect(page.getByLabel("Isolated ManimGX runtime")).toHaveCount(0);
  await expect(page.getByRole("button", { name:"Повторить рендеринг" })).toBeVisible();
});

test("editing during export cancels the old job without a stale fallback killing the new scene", async ({ page }) => {
  await page.route(runtimeUrl, route => route.fulfill({ contentType:"text/html", body:runtime(["pending", "no-ack"]) }));
  await page.goto("/#/studio");
  await page.getByLabel("Движок сцены").selectOption("manimgx-browser");
  await page.locator("textarea.code-area").fill(source);
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "completed");
  await page.getByRole("button", { name:"Скачать видео (MP4)" }).click();
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "running");
  await page.locator("textarea.code-area").fill(source+"# new revision");
  await expect(page.getByTestId("export-job")).toHaveAttribute("data-status", "cancelled");
  await expect(page.getByTestId("preview-job")).toHaveAttribute("data-status", "completed");
  await page.waitForTimeout(1800);
  await expect(page.getByLabel("Isolated ManimGX runtime")).toHaveCount(1);
  await expect(page.getByRole("button", { name:"Скачать видео (MP4)" })).toBeEnabled();
});

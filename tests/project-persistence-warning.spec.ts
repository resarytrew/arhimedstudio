import { expect, test } from "@playwright/test";

test("a failed project save warns the author and offers a complete JSON backup", async ({ page }) => {
  await page.goto("/#/studio");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as Window & { restoreProjectStorage?: () => void }).restoreProjectStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key === "arhimed.projects.v2") throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });

  const editor = page.locator("textarea.code-area");
  await editor.fill("import manimx as m\nclass Scene(m.Scene):\n    def construct(self):\n        self.wait(2)\n");
  const warning = page.getByRole("alert", { name: "Не удалось сохранить проект" });
  await expect(warning).toBeVisible({ timeout: 8000 });
  await expect(warning).toContainText("не сохранились");

  const downloaded = page.waitForEvent("download");
  await warning.getByRole("button", { name: "Резервная копия JSON" }).click();
  expect((await downloaded).suggestedFilename()).toBe("arhimed-project-backup.json");

  await page.evaluate(() => {
    (window as Window & { restoreProjectStorage?: () => void }).restoreProjectStorage?.();
  });
  await editor.fill("import manimx as m\nclass Scene(m.Scene):\n    def construct(self):\n        self.wait(3)\n");
  await expect(warning).toHaveCount(0, { timeout: 8000 });
});

test("persistence status event reports success and failure precisely", async ({ page }) => {
  await page.goto("/#/studio");
  const status = await page.evaluate(async () => {
    const { savePersistedValue, PROJECT_PERSISTENCE_EVENT, PROJECTS_KEY } = await import("/src/lib/store.ts");
    const logs: boolean[] = [];
    const onEvent = (event: Event) => logs.push((event as CustomEvent<{ saved: boolean }>).detail.saved);
    window.addEventListener(PROJECT_PERSISTENCE_EVENT, onEvent);
    const original = Storage.prototype.setItem;
    try {
      const ok = savePersistedValue(PROJECTS_KEY, []);
      Storage.prototype.setItem = function(key: string, value: string) {
        if (key === PROJECTS_KEY) throw new Error("Storage unavailable");
        return original.call(this, key, value);
      };
      const failed = savePersistedValue(PROJECTS_KEY, []);
      return { ok, failed, logs };
    } finally {
      Storage.prototype.setItem = original;
      window.removeEventListener(PROJECT_PERSISTENCE_EVENT, onEvent);
    }
  });
  expect(status).toEqual({ ok: true, failed: false, logs: [true, false] });
});

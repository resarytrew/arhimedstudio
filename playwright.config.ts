import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", timeout: 60000, workers: 1,
 use: { baseURL: "http://127.0.0.1:4181", viewport: { width: 1440, height: 960 }, trace: "retain-on-failure" },
 projects: [{ name: "chrome", use: { channel: "chrome" } }, { name: "edge", use: { channel: "msedge" } }],
 webServer: { command: "npm run dev -- --port 4181", url: "http://127.0.0.1:4181", reuseExistingServer: false },
});

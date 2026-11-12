import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const python = process.platform === "win32" ? "python" : "python3";
const database = join(tmpdir(), "student-directory-e2e.db");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // one database, so one test at a time; every test starts from a reset (see e2e/fixtures.ts)
  workers: 1,
  retries: 0, // a test that needs a retry to pass is a broken test, not a lucky one
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Use your own Chrome/Chromium if you set CHROMIUM_PATH; otherwise the one `npx playwright install chromium` downloaded.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: [
    {
      // The real Python server, with the test-only reset address switched ON and a throw-away database file.
      command: `${python} -m app`,
      cwd: "../backend",
      env: { ENABLE_TEST_RESET: "1", STUDENTS_DB: database, PORT: "8000" },
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // The real built page, with /api forwarded to Python.
      command: "npx vite build --logLevel error && npx vite preview --logLevel error",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});

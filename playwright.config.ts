import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'playwright/test';

type ViewportConfig = {
  name: string;
  w: number;
  h: number;
};

type SanitizeConfig = {
  viewports?: ViewportConfig[];
};

const sanitizeConfigPath = path.join(process.cwd(), 'sanitize.config.json');
const sanitizeConfig = JSON.parse(fs.readFileSync(sanitizeConfigPath, 'utf8')) as SanitizeConfig;

const viewports = Array.isArray(sanitizeConfig.viewports) && sanitizeConfig.viewports.length > 0
  ? sanitizeConfig.viewports
  : [{ name: 'desktop', w: 1440, h: 900 }];

// Uses a static server on port 8080 because this repo does not define a Vite preview script.
export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.003,
    },
  },
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: viewports.map((viewport) => ({
    name: viewport.name,
    use: {
      viewport: {
        width: viewport.w,
        height: viewport.h,
      },
    },
  })),
  webServer: {
    command: 'python3 -m http.server 8080 --directory docs',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

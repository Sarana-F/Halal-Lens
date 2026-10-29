// Browser tests (TEST-PLAN.md section 4). Run: npm run test:e2e
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/e2e-report' }], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  outputDir: 'test-results/e2e-artifacts',
  use: {
    baseURL: 'http://localhost:5179',
    serviceWorkers: 'block',          // the PWA test switches this back on
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node tests/serve.js . 5179',
    url: 'http://localhost:5179/index.html',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'tablet', use: { ...devices['Galaxy Tab S4'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } }
  ]
});

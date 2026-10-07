const { defineConfig, devices } = require('@playwright/test');
const chromiumLaunchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {};
module.exports = defineConfig({
    testDir: './tests/browser',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: 'http://127.0.0.1:3001',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 }, launchOptions: chromiumLaunchOptions } },
        { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: chromiumLaunchOptions } },
        { name: 'safari-mobile', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    ],
    webServer: { command: 'npm run build && npm run preview', url: 'http://127.0.0.1:3001', reuseExistingServer: false, timeout: 60000 },
});

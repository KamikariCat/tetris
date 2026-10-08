const { test, expect, chromium } = require('@playwright/test');
const { createServer } = require('node:http');
const { readFileSync, readdirSync, mkdtempSync, rmSync } = require('node:fs');
const { join, resolve, extname } = require('node:path');
const { tmpdir } = require('node:os');

async function offlineReady(page) {
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
            await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
        }
    });
}

test('the PWA has an installable manifest and full-size icons for Android and iOS', async ({ page, request, browserName }) => {
    await page.goto('/');
    await offlineReady(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await request.get(href);
    expect(response.headers()['content-type']).toContain('application/manifest+json');
    const manifest = await response.json();
    expect(manifest).toMatchObject({ short_name: 'NORITris', display: 'standalone', scope: './', theme_color: '#141318' });
    for (const icon of manifest.icons) {
        const image = await request.get(icon.src);
        expect(image.status()).toBe(200);
        expect(image.headers()['content-type']).toContain('image/png');
        const buffer = await image.body();
        expect(`${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    const appleIcon = await request.get(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'));
    expect((await appleIcon.body()).readUInt32BE(16)).toBe(180);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    if (browserName === 'chromium') {
        const client = await page.context().newCDPSession(page);
        const parsed = await client.send('Page.getAppManifest');
        expect(parsed.errors).toEqual([]);
    }
});

test('a regular Chrome profile reports no PWA installation errors', async ({ baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    // The default Playwright contexts are incognito, where application installation is disabled.
    const profile = mkdtempSync(join(tmpdir(), 'noritris-install-'));
    let context;
    try {
        context = await chromium.launchPersistentContext(profile, testInfo.project.use.launchOptions);
        const page = await context.newPage();
        await page.goto(baseURL);
        await offlineReady(page);
        const client = await context.newCDPSession(page);
        expect((await client.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
    } finally {
        await context?.close();
        rmSync(profile, { recursive: true, force: true });
    }
});

test('the installed start URL and reload work offline with styles, controls and the saved record', async ({ page, context, request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    await page.goto('/');
    await offlineReady(page);
    await page.locator('#overlay-btn').click();
    await page.keyboard.press('Space');
    const record = await page.locator('#best').textContent();
    expect(record).not.toBe('0');
    const startURL = new URL(manifest.start_url, page.url()).href;
    await context.setOffline(true);
    // Open a fresh window: all HTML, scripts and styles must come from the service worker.
    const offline = await context.newPage();
    const response = await offline.goto(startURL);
    expect(response.fromServiceWorker()).toBe(true);
    await expect(offline).toHaveTitle(/NORITris/);
    await expect(offline.locator('body')).toHaveCSS('background-color', 'rgb(20, 19, 24)');
    await expect(offline.locator('.game-layout')).toHaveCSS('display', 'grid');
    await expect(offline.locator('#best')).toHaveText(record);
    await offline.locator('#overlay-btn').click();
    await offline.keyboard.press('Space');
    await expect(offline.locator('#score')).not.toHaveText('0');
    await offline.locator('#start-btn').click();
    await expect(offline.locator('#status')).toHaveText('На паузе');
    await offline.locator('#overlay-btn').click();
    await expect(offline.locator('#status')).toHaveText('Игра идёт');
    await offline.reload();
    await expect(offline.locator('#overlay-btn')).toBeVisible();
    await offline.locator('#overlay-btn').click();
    await offline.keyboard.press('Space');
    await expect(offline.locator('#score')).not.toHaveText('0');
    // Explicit index.html and query strings are valid offline entry points too.
    await offline.goto(new URL('index.html?source=shortcut', startURL).href);
    await expect(offline.locator('#overlay-btn')).toBeVisible();
});

test('a failed update preserves offline play and a complete update waits for game windows to close', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    const root = resolve(__dirname, '../../dist');
    const assets = new Map();
    const collect = directory => {
        for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
            const name = join(directory, entry.name);
            if (entry.isDirectory()) collect(name);
            else assets.set(`/${name}`, readFileSync(join(root, name)));
        }
    };
    collect('');
    const worker = assets.get('/service-worker.js').toString();
    const version = worker.match(/VERSION\s*=\s*"([^"]+)"/)[1];
    let release = version;
    let broken = false;
    const server = createServer((request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const filename = pathname === '/' ? '/index.html' : pathname;
        let body = assets.get(filename);
        if (!body || (broken && filename === '/icons/icon-192.png')) {
            response.writeHead(503).end('Unavailable');
            return;
        }
        if (filename === '/service-worker.js') body = Buffer.from(worker.replace(version, release));
        if (filename === '/index.html' && release.startsWith('updated-')) {
            body = Buffer.from(body.toString().replace('</head>', '<meta name="test-release" content="updated"></head>'));
        }
        const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
        response.writeHead(200, { 'Content-Type': mime[extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(body);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}/`;
    const prefix = `noritris:${origin}:`;
    try {
        await page.goto(origin);
        await offlineReady(page);
        await page.evaluate(() => caches.open('other-app-cache'));
        await page.locator('#overlay-btn').click();
        release = `broken-${version}`;
        broken = true;
        await page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            await registration.update();
            const worker = registration.installing;
            if (worker && worker.state !== 'redundant') {
                await new Promise(resolve => worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(); }));
            }
        });
        await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([prefix + version, 'other-app-cache']);
        await expect(page.locator('#status')).toHaveText('Игра идёт');
        await context.setOffline(true);
        await page.reload();
        await page.locator('#overlay-btn').click();
        await page.keyboard.press('Space');
        await expect(page.locator('#score')).not.toHaveText('0');

        await context.setOffline(false);
        broken = false;
        release = `updated-${version}`;
        const installing = context.waitForEvent('serviceworker');
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        const nextWorker = await installing;
        await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state)).toBe('installed');
        await expect(page.locator('#status')).toHaveText('Игра идёт');
        await context.setOffline(true);
        await page.reload();
        await expect(page.locator('meta[name="test-release"]')).toHaveCount(0);
        await page.close();
        await expect.poll(() => nextWorker.evaluate(() => !self.registration.waiting && self.registration.active?.state === 'activated')).toBe(true);
        const updated = await context.newPage();
        await updated.goto(origin);
        await expect(updated.locator('meta[name="test-release"]')).toHaveAttribute('content', 'updated');
        expect(await updated.evaluate(() => caches.keys())).toEqual(['other-app-cache', prefix + release]);
        await updated.locator('#overlay-btn').click();
        await updated.keyboard.press('Space');
        await expect(updated.locator('#score')).not.toHaveText('0');
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});

const { test, expect } = require('@playwright/test');

test('the layout fits small phones, tablets and desktop widths', async ({ page }) => {
    await page.goto('/');
    for (const width of [320, 360, 540, 768, 1024]) {
        await page.setViewportSize({ width, height: 800 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `width ${width}`).toBe(true);
    }
});

test('the development server serves assets and rejects private files and invalid requests', async ({ request }) => {
    const html = await request.get('/');
    expect(html.status()).toBe(200);
    expect(html.headers()['content-type']).toContain('text/html');
    expect((await request.head('/main.bundle.js')).status()).toBe(200);
    expect((await request.get('/package.json')).status()).toBe(404);
    expect((await request.get('/%2e%2e%2fpackage.json')).status()).toBe(403);
    expect((await request.get('/%ZZ')).status()).toBe(400);
    expect((await request.post('/')).status()).toBe(405);
});

test('loads without errors, fits the screen and starts with either primary button', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
    await page.goto('/');
    await expect(page).toHaveTitle(/NORITris/);
    await expect(page.locator('#overlay')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('#overlay-btn').click();
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#start-btn')).toHaveText('Пауза');
    await page.keyboard.press('Space');
    await expect(page.locator('#score')).not.toHaveText('0');
    const record = await page.locator('#best').textContent();
    await page.locator('#restart-btn').click();
    await expect(page.locator('#score')).toHaveText('0');
    await expect(page.locator('#lines')).toHaveText('0');
    await expect(page.locator('#best')).toHaveText(record);
    await page.locator('#start-btn').click();
    await expect(page.locator('#overlay-title')).toHaveText('Небольшая пауза');
    await page.locator('#overlay-btn').click();
    await expect(page.locator('#overlay')).toBeHidden();
    expect(errors).toEqual([]);
});

test('pause blocks inputs and hidden-tab transitions leave no running game', async ({ page }) => {
    await page.goto('/');
    await page.locator('#start-btn').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#status')).toHaveText('На паузе');
    const score = await page.locator('#score').textContent();
    await page.keyboard.press('Space');
    await expect(page.locator('#score')).toHaveText(score);
    await expect(page.locator('#status')).toHaveText('На паузе');
    await page.keyboard.press('KeyP');
    await expect(page.locator('#status')).toHaveText('Игра идёт');
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('#status')).toHaveText('На паузе');
    await page.evaluate(() => delete document.hidden);
    await page.locator('#restart-btn').click();
    await expect(page.locator('#status')).toHaveText('Игра идёт');
});

test('game over lets the player restart immediately', async ({ page }) => {
    await page.goto('/');
    await page.locator('#start-btn').click();
    for (let i = 0; i < 60; i++) {
        if (await page.locator('#status').textContent() === 'Игра окончена') break;
        await page.keyboard.press('Space');
    }
    await expect(page.locator('#status')).toHaveText('Игра окончена');
    await expect(page.locator('#start-btn')).toHaveText('Играть ещё');
    await expect(page.locator('#start-btn')).toBeEnabled();
    await page.locator('#start-btn').click();
    await expect(page.locator('#status')).toHaveText('Игра идёт');
    await expect(page.locator('#score')).toHaveText('0');
});

test('record survives reload and blocked storage does not prevent playing', async ({ page }) => {
    await page.goto('/');
    await page.locator('#start-btn').click();
    await page.keyboard.press('Space');
    const best = await page.locator('#best').textContent();
    await page.reload();
    await expect(page.locator('#best')).toHaveText(best);
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    });
    await page.reload();
    await page.locator('#start-btn').click();
    await page.keyboard.press('Space');
    await expect(page.locator('#score')).not.toHaveText('0');
});

test('mobile buttons, tap and swipe control the game', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile');
    await page.goto('/');
    await page.locator('#overlay-btn').tap();
    await page.locator('[data-action="left"]').tap();
    await page.locator('[data-action="rotate"]').tap();
    await page.locator('[data-action="drop"]').tap();
    await expect(page.locator('#score')).not.toHaveText('0');
    const score = Number((await page.locator('#score').textContent()).replace(/\s/g, ''));
    const canvas = page.locator('#game');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    const client = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 80 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => Number((await page.locator('#score').textContent()).replace(/\s/g, ''))).toBeGreaterThan(score);
});

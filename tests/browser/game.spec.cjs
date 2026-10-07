const { test, expect } = require('@playwright/test');

test('the layout fits small phones, tablets and desktop widths', async ({ page }) => {
    await page.goto('/');
    for (const width of [320, 360, 540, 768, 1024]) {
        await page.setViewportSize({ width, height: 800 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `width ${width}`).toBe(true);
    }
});

test('the preview server serves assets and rejects private files and invalid requests', async ({ request }) => {
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
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 19, 24)');
    await expect(page.locator('.game-layout')).toHaveCSS('display', 'grid');
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

test('mobile buttons, tap and vertical swipe control the game', async ({ page }, testInfo) => {
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

// Freeze gravity while observing the visible piece during a held touch.
async function beginDrag(page) {
    await page.addInitScript(() => {
        Math.random = () => 0;
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
    });
    await page.goto('/');
    await page.locator('#overlay-btn').tap();
    const canvas = page.locator('#game');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    const client = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width / 10, y: box.y + box.height / 2 };
    const cellWidth = box.width / 10;
    const touch = (type, x = point.x) => client.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y: point.y }],
    });
    const cells = () => canvas.evaluate(element => {
        const ctx = element.getContext('2d');
        const size = element.width / 10;
        const result = [];
        for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) {
            const [r, g, b] = ctx.getImageData(Math.floor((x + 0.5) * size), Math.floor((y + 0.5) * size), 1, 1).data;
            if (Math.max(r, g, b) > 120) result.push([x, y]);
        }
        return result;
    });
    return { box, point, cellWidth, touch, cells };
}
const shifted = (cells, dx) => cells.map(([x, y]) => [x + dx, y]);

test('a held finger moves the figure immediately across cells and back without rotating on release', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile');
    const drag = await beginDrag(page);
    const initial = await drag.cells();
    expect(initial).toHaveLength(4);
    await drag.touch('touchStart');
    expect(await drag.cells()).toEqual(initial);
    await drag.touch('touchMove', drag.point.x + drag.cellWidth * 1.4);
    await expect.poll(drag.cells).toEqual(shifted(initial, 1));
    await drag.touch('touchMove', drag.point.x + drag.cellWidth * 3.4);
    await expect.poll(drag.cells).toEqual(shifted(initial, 3));
    await drag.touch('touchMove', drag.point.x + drag.cellWidth * 0.4);
    await expect.poll(drag.cells).toEqual(initial);
    await drag.touch('touchMove', drag.point.x - drag.cellWidth * 1.4);
    await expect.poll(drag.cells).toEqual(shifted(initial, -1));
    await drag.touch('touchEnd');
    expect(await drag.cells()).toEqual(shifted(initial, -1));
    await expect(page.locator('#score')).toHaveText('0');
});

test('dragging past the wall keeps the figure inside and reverses without finger overshoot', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile');
    const drag = await beginDrag(page);
    const initial = await drag.cells();
    await drag.touch('touchStart');
    const outside = drag.box.x + drag.box.width + 8;
    await drag.touch('touchMove', outside);
    await expect.poll(async () => Math.max(...(await drag.cells()).map(([x]) => x))).toBe(9);
    await drag.touch('touchMove', outside - drag.cellWidth * 1.4);
    await expect.poll(drag.cells).toEqual(shifted(initial, 2));
    await drag.touch('touchEnd');
    expect(await drag.cells()).toEqual(shifted(initial, 2));
    await expect(page.locator('#score')).toHaveText('0');
});

test('pausing, restarting and cancelling a held touch do not carry gestures into the next session', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile');
    const drag = await beginDrag(page);
    await drag.touch('touchStart');
    await drag.touch('touchMove', drag.point.x + drag.cellWidth * 1.4);
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyP');
    const paused = await drag.cells();
    await drag.touch('touchMove', drag.point.x + drag.cellWidth * 3.4);
    await drag.touch('touchEnd');
    expect(await drag.cells()).toEqual(paused);
    await drag.touch('touchStart');
    await page.locator('#restart-btn').click();
    const restarted = await drag.cells();
    await drag.touch('touchMove', drag.point.x + drag.cellWidth * 3.4);
    await drag.touch('touchEnd');
    expect(await drag.cells()).toEqual(restarted);
    await drag.touch('touchStart');
    await drag.touch('touchCancel');
    expect(await drag.cells()).toEqual(restarted);
    await expect(page.locator('#score')).toHaveText('0');
});

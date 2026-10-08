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
const readCells = canvas => canvas.evaluate(element => {
    const ctx = element.getContext('2d');
    const size = element.width / 10;
    const result = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) {
        const [r, g, b] = ctx.getImageData(Math.floor((x + 0.5) * size), Math.floor((y + 0.5) * size), 1, 1).data;
        if (Math.max(r, g, b) > 120) result.push([x, y]);
    }
    return result;
});

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
    const cells = () => readCells(canvas);
    return { box, point, cellWidth, touch, cells };
}
const shifted = (cells, dx) => cells.map(([x, y]) => [x + dx, y]);
async function tryScrolling(page, testInfo) {
    // Playwright's mobile WebKit does not implement mouse-wheel input.
    if (testInfo.project.name === 'safari-mobile') await page.evaluate(() => scrollTo(0, 700));
    else await page.mouse.wheel(0, 700);
}

test('the entire mobile game fits short phones, tablets and landscape without scrolling', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop');
    await page.goto('/');
    for (const [width, height] of [[320, 480], [320, 568], [360, 640], [390, 664], [412, 839], [768, 1024], [851, 393], [667, 320]]) {
        await page.setViewportSize({ width, height });
        for (const selector of ['.stats-panel', '#game', '#overlay-btn', '#start-btn', '#restart-btn', '.touch-controls']) {
            // WebKit rounds fractional intersection widths; also check the actual bounds.
            await expect(page.locator(selector), `${selector} on ${width} × ${height}`).toBeInViewport({ ratio: 0.99 });
            const box = await page.locator(selector).boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
            expect(box.y + box.height).toBeLessThanOrEqual(height);
        }
        const size = await page.locator('#game').boundingBox();
        expect(size.height / size.width).toBeCloseTo(2, 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    }
    await page.locator('#overlay-btn').tap();
    await tryScrolling(page, testInfo);
    expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
    await expect(page.locator('.touch-controls')).toBeInViewport({ ratio: 1 });
});

test('touch taps rotate once and each control tap moves one cell on mobile browsers', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop');
    await page.addInitScript(() => {
        Math.random = () => 0;
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
    });
    await page.goto('/');
    await page.locator('#overlay-btn').tap();
    const canvas = page.locator('#game');
    const box = await canvas.boundingBox();
    const before = await readCells(canvas);
    await canvas.tap();
    const rotated = await readCells(canvas);
    expect(rotated).not.toEqual(before);
    await page.locator('[data-action="left"]').tap();
    expect(await readCells(canvas)).toEqual(shifted(rotated, -1));
    await page.locator('[data-action="right"]').tap();
    expect(await readCells(canvas)).toEqual(rotated);
    for (let i = 0; i < 6; i++) await canvas.tap();
    await page.locator('#score').dblclick();
    await tryScrolling(page, testInfo);
    expect(await page.evaluate(() => ({ selection: getSelection()?.toString(), scroll: [scrollX, scrollY], scale: visualViewport.scale }))).toEqual({ selection: '', scroll: [0, 0], scale: 1 });
    expect(await canvas.boundingBox()).toEqual(box);
});

test('rapid taps and drags neither select text, zoom nor move the mobile interface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile');
    const drag = await beginDrag(page);
    const initial = await drag.cells();
    await drag.touch('touchStart');
    await drag.touch('touchEnd');
    expect(await drag.cells()).not.toEqual(initial);
    // Real touch events reproduce fast alternating taps and drags, including double taps.
    for (let i = 0; i < 6; i++) {
        await drag.touch('touchStart');
        await drag.touch('touchEnd');
        await drag.touch('touchStart');
        await drag.touch('touchMove', drag.point.x + drag.cellWidth * 1.4);
        await drag.touch('touchMove', drag.point.x);
        await drag.touch('touchEnd');
    }
    const client = await page.context().newCDPSession(page);
    const score = await page.locator('#score').boundingBox();
    const point = { x: score.x + score.width / 2, y: score.y + score.height / 2 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 180 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator('#score').dblclick();
    await page.mouse.wheel(0, 500);
    expect(await page.evaluate(() => ({ selection: getSelection()?.toString(), scroll: [scrollX, scrollY], scale: visualViewport.scale }))).toEqual({ selection: '', scroll: [0, 0], scale: 1 });
    expect(await page.locator('#game').boundingBox()).toEqual(drag.box);
    await expect(page.locator('#status')).toHaveText('Игра идёт');
});

test('double taps cancel browser zoom and preserve both rotations and UI activations', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop');
    await page.addInitScript(() => {
        Math.random = () => 0;
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
        window.touchEnds = [];
        window.buttonClicks = [];
        document.addEventListener('touchend', event => window.touchEnds.push({ prevented: event.defaultPrevented, target: event.target.id }), { passive: true });
        document.addEventListener('click', event => window.buttonClicks.push(event.target.closest('button')?.id));
    });
    await page.goto('/');
    await page.locator('#overlay-btn').tap();
    const canvas = page.locator('#game');
    await page.locator('[data-action="rotate"]').tap();
    await page.locator('[data-action="rotate"]').tap();
    const twoRotations = await readCells(canvas);
    await page.locator('#restart-btn').tap();
    const box = await canvas.boundingBox();
    await page.evaluate(() => { window.touchEnds = []; });
    // Send native touch input directly, without actionability waits between the two taps.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    expect(await readCells(canvas)).toEqual(twoRotations);
    expect(await page.evaluate(() => window.touchEnds)).toEqual([{ prevented: true, target: 'game' }, { prevented: true, target: 'game' }]);
    await page.locator('#start-btn').tap();
    await expect(page.locator('#status')).toHaveText('На паузе');
    const button = await page.locator('#start-btn').boundingBox();
    await page.evaluate(() => { window.buttonClicks = []; });
    await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
    await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
    await expect(page.locator('#status')).toHaveText('На паузе');
    expect(await page.evaluate(() => window.buttonClicks)).toEqual(['start-btn', 'start-btn']);
    await page.locator('#overlay-btn').tap();
    await expect(page.locator('#status')).toHaveText('Игра идёт');
    await page.evaluate(() => { window.touchEnds = []; });
    // Empty viewport margins need the same protection as the board and controls.
    await page.touchscreen.tap(3, 3);
    await page.touchscreen.tap(3, 3);
    expect((await page.evaluate(() => window.touchEnds)).every(event => event.prevented)).toBe(true);
    expect(await page.evaluate(() => ({ scale: visualViewport.scale, scroll: [scrollX, scrollY] }))).toEqual({ scale: 1, scroll: [0, 0] });
    expect(await canvas.boundingBox()).toEqual(box);
});

test('dragged, cancelled and multi-touch UI presses do not activate a button', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile');
    const drag = await beginDrag(page);
    await page.keyboard.press('Space');
    const score = await page.locator('#score').textContent();
    const client = await page.context().newCDPSession(page);
    const box = await page.locator('#start-btn').boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, x: point.x + 40 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#status')).toHaveText('Игра идёт');
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    const second = { ...point, id: 2, x: point.x + 30 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, second] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [second] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#status')).toHaveText('Игра идёт');
    const restart = await page.locator('#restart-btn').boundingBox();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: restart.x + restart.width / 2, y: restart.y + restart.height / 2 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(page.locator('#score')).toHaveText(score);
});

test('fullscreen can be entered and exited without losing the game', async ({ page }, testInfo) => {
    const activate = selector => testInfo.project.name === 'desktop' ? page.locator(selector).click() : page.locator(selector).tap();
    await page.goto('/');
    await activate('#start-btn');
    if (!await page.evaluate(() => document.fullscreenEnabled)) {
        await expect(page.locator('#fullscreen-btn')).toBeHidden();
        return;
    }
    await activate('#fullscreen-btn');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await expect(page.locator('#fullscreen-btn')).toHaveAttribute('aria-pressed', 'true');
    await activate('#fullscreen-btn');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await expect(page.locator('#status')).toHaveText('Игра идёт');
});

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

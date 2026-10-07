const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine } = require('../src/game/Engine');
const { Element } = require('../src/game/Element');
const { pieceTypes } = require('../src/game/data');
const cell = (x, y) => ({ x, y, color: '#fff' });
const positions = cells => cells.map(({ x, y }) => `${x},${y}`).sort();
const game = (columns = 10, rows = 20) => {
    const engine = new Engine(columns, rows, () => 0.25);
    engine.start();
    return engine;
};

test('a new game resets the board, score, lines and level', () => {
    const engine = game();
    engine.score = 1200;
    engine.lines = 23;
    engine.staticStore = [cell(0, 19)];
    engine.pause();
    engine.start();
    assert.equal(engine.status, 'playing');
    assert.equal(engine.score, 0);
    assert.equal(engine.lines, 0);
    assert.equal(engine.level, 1);
    assert.deepEqual(engine.staticStore, []);
    assert.equal(engine.active.cells().length, 4);
    assert.ok(engine.canPlace(engine.active.cells()));
});

test('placement rejects every edge, noninteger coordinate and occupied cell', () => {
    const engine = game();
    for (const [x, y] of [[-1, 0], [10, 0], [0, -1], [0, 20], [0.5, 1], [NaN, 0]]) {
        assert.equal(engine.canPlace([cell(x, y)]), false);
    }
    engine.staticStore = [cell(3, 8)];
    assert.equal(engine.canPlace([cell(3, 8)]), false);
    assert.equal(engine.canPlace([cell(9, 19)]), true);
});

test('all seven pieces turn safely at the floor and both walls', () => {
    for (const type of pieceTypes) {
        const engine = game();
        engine.active = new Element(type, engine.columns);
        // Rotation is also usable immediately after spawning at the ceiling.
        assert.equal(engine.rotate(), true, `${type} ceiling rotation`);
        while (engine.active.move(0, 1, engine.canPlace)) {}
        for (const direction of [-1, 1]) {
            while (engine.move(direction)) {}
            for (let i = 0; i < 8; i++) {
                engine.rotate();
                assert.ok(engine.canPlace(engine.active.cells()), `${type} at wall ${direction}`);
                assert.equal(engine.active.cells().length, 4);
            }
        }
    }
});

test('a blocked rotation preserves both the position and orientation', () => {
    const engine = game();
    engine.active = new Element('T', 10);
    engine.active.x = 4;
    engine.active.y = 8;
    const before = JSON.stringify(engine.active);
    const available = new Set(positions(engine.active.cells()));
    engine.staticStore = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) {
        if (!available.has(`${x},${y}`)) engine.staticStore.push(cell(x, y));
    }
    assert.equal(engine.rotate(), false);
    assert.equal(JSON.stringify(engine.active), before);
});

test('hard drop matches the ghost and locks immediately before another rotation', () => {
    const engine = game();
    engine.active = new Element('T', 10);
    engine.staticStore = [cell(4, 15)];
    const dropped = engine.active;
    const landing = dropped.landing(engine.canPlace);
    engine.hardDrop();
    assert.deepEqual(positions(dropped.cells()), positions(landing));
    assert.notEqual(engine.active, dropped);
    const locked = JSON.stringify(engine.staticStore);
    engine.rotate();
    assert.equal(JSON.stringify(engine.staticStore), locked);
    assert.deepEqual(positions(dropped.cells()), positions(landing));
});

test('ghost follows movement and respects custom board heights', () => {
    const engine = game(8, 12);
    engine.active = new Element('O', 8);
    engine.staticStore = [cell(3, 8)];
    assert.equal(Math.max(...engine.active.landing(engine.canPlace).map(c => c.y)), 7);
    engine.move(1);
    assert.equal(Math.max(...engine.active.landing(engine.canPlace).map(c => c.y)), 11);
});

test('multiple nonadjacent lines clear together and shift only the rows above them', () => {
    const engine = game();
    engine.staticStore = [17, 19].flatMap(y => Array.from({ length: 10 }, (_, x) => cell(x, y)));
    engine.staticStore.push(cell(0, 16), cell(1, 18), cell(2, 0));
    assert.equal(engine.clearRows(), 2);
    assert.deepEqual(positions(engine.staticStore), positions([cell(0, 18), cell(1, 19), cell(2, 2)]));
    assert.equal(engine.lines, 2);
    assert.equal(engine.score, 300);
});

test('four lines score correctly and advance the level and gravity', () => {
    const engine = game();
    engine.lines = 9;
    const gravity = engine.gravity;
    engine.staticStore = [16, 17, 18, 19].flatMap(y => Array.from({ length: 10 }, (_, x) => cell(x, y)));
    assert.equal(engine.clearRows(), 4);
    assert.equal(engine.score, 800);
    assert.equal(engine.level, 2);
    assert.ok(engine.gravity < gravity);
    assert.deepEqual(engine.staticStore, []);
});

test('normal gravity gives no drop points; manual descent and hard drop do', () => {
    const engine = game();
    engine.active = new Element('O', 10);
    engine.tick();
    assert.equal(engine.score, 0);
    engine.tick(true);
    assert.equal(engine.score, 1);
    engine.hardDrop();
    assert.equal(engine.score, 33);
});

test('game over preserves the board and can restart directly', () => {
    const engine = game();
    engine.active = new Element('I', 10);
    engine.active.y = 18;
    engine.next = 'O';
    engine.staticStore = [cell(4, 0)];
    engine.hardDrop();
    assert.equal(engine.status, 'over');
    assert.equal(engine.active, null);
    assert.equal(engine.staticStore.length, 5);
    const board = JSON.stringify(engine.staticStore);
    assert.equal(engine.hardDrop(), false);
    assert.equal(engine.rotate(), false);
    assert.equal(engine.tick(), false);
    assert.equal(JSON.stringify(engine.staticStore), board);
    engine.start();
    assert.equal(engine.status, 'playing');
    assert.deepEqual(engine.staticStore, []);
});

test('pause blocks every game action; resume keeps the current piece and score', () => {
    const engine = game();
    engine.tick(true);
    const piece = JSON.stringify(engine.active);
    const score = engine.score;
    engine.pause();
    for (const action of [() => engine.move(-1), () => engine.rotate(), () => engine.tick(true), () => engine.hardDrop()]) {
        assert.equal(action(), false);
    }
    assert.equal(JSON.stringify(engine.active), piece);
    assert.equal(engine.score, score);
    engine.resume();
    assert.equal(engine.status, 'playing');
    assert.equal(engine.tick(), true);
});

test('each bag contains every shape exactly once', () => {
    const engine = game();
    const seen = [];
    for (let i = 0; i < 21; i++) {
        seen.push(engine.active.type);
        engine.staticStore = [];
        engine.hardDrop();
    }
    for (let i = 0; i < seen.length; i += 7) {
        assert.deepEqual([...seen.slice(i, i + 7)].sort(), [...pieceTypes].sort());
    }
});

test('a long deterministic game never produces duplicate or out-of-bounds cells', () => {
    let seed = 73;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const engine = new Engine(10, 20, random);
    engine.start();
    for (let i = 0; i < 3000; i++) {
        if (engine.status === 'over') engine.start();
        switch (Math.floor(random() * 5)) {
            case 0: engine.move(-1); break;
            case 1: engine.move(1); break;
            case 2: engine.rotate(random() > 0.5); break;
            case 3: engine.tick(); break;
            case 4: engine.hardDrop(); break;
        }
        assert.equal(new Set(positions(engine.staticStore)).size, engine.staticStore.length);
        assert.ok(engine.staticStore.every(c => c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 20));
        if (engine.active) assert.ok(engine.canPlace(engine.active.cells()));
    }
});

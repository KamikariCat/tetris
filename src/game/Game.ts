import { Engine } from './Engine';
import { Element } from './Element';
import { Renderer } from './Renderer';
import { GameStatus } from './types';

type Action = 'left' | 'right' | 'rotate' | 'down' | 'drop';
interface DragGesture {
    id: number;
    startX: number;
    startY: number;
    originX: number;
    anchorX: number;
    cellWidth: number;
    dragging: boolean;
    piece: Element;
}

export class Game {
    private engine = new Engine();
    private renderer: Renderer;
    private frameId: number | null = null;
    private previousTime: number | null = null;
    private elapsed = 0;
    private repeatTimer: ReturnType<typeof setInterval> | null = null;
    private best = 0;
    private lastStatus: GameStatus | null = null;
    private gesture: DragGesture | null = null;
    private canvas = this.get<HTMLCanvasElement>('game');
    private primary = this.get<HTMLButtonElement>('start-btn');
    private restart = this.get<HTMLButtonElement>('restart-btn');
    private overlay = this.get<HTMLElement>('overlay');
    private overlayButton = this.get<HTMLButtonElement>('overlay-btn');
    private overlayTitle = this.get<HTMLElement>('overlay-title');
    private overlayText = this.get<HTMLElement>('overlay-text');
    private status = this.get<HTMLElement>('status');
    private stats = {
        score: this.get<HTMLElement>('score'),
        best: this.get<HTMLElement>('best'),
        lines: this.get<HTMLElement>('lines'),
        level: this.get<HTMLElement>('level'),
    };

    constructor() {
        const canvas = this.canvas;
        this.renderer = new Renderer(canvas, this.get<HTMLCanvasElement>('next'));
        try {
            const stored = Number(localStorage.getItem('noritris.best'));
            if (Number.isSafeInteger(stored) && stored > 0) this.best = stored;
        } catch { /* The game also works when storage is unavailable. */ }
        this.primary.addEventListener('click', () => this.toggle());
        this.overlayButton.addEventListener('click', () => this.toggle());
        this.restart.addEventListener('click', () => this.start());
        this.fullscreen();
        this.controls(canvas);
        window.addEventListener('resize', () => { this.clearGesture(); this.renderer.resize(); this.render(); });
        window.addEventListener('blur', () => this.pause());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pause();
        });
        this.render();
    }

    private get<T extends HTMLElement>(id: string): T {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing interface element: ${id}`);
        return element as T;
    }

    private start(): void {
        this.cancelLoop();
        this.clearRepeat();
        this.clearGesture();
        this.engine.start();
        this.elapsed = 0;
        this.render();
        this.run();
    }

    private toggle(): void {
        if (this.engine.status === 'playing') this.pause();
        else if (this.engine.status === 'paused') {
            this.engine.resume();
            this.render();
            this.run();
        } else this.start();
    }

    private pause(): void {
        this.clearRepeat();
        this.clearGesture();
        if (this.engine.status !== 'playing') return;
        this.engine.pause();
        this.cancelLoop();
        this.render();
    }

    private run(): void {
        this.cancelLoop();
        this.frameId = requestAnimationFrame(this.frame);
    }

    private cancelLoop(): void {
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.previousTime = null;
    }

    private frame = (time: number): void => {
        this.frameId = null;
        if (this.engine.status !== 'playing') return;
        if (this.previousTime !== null) this.elapsed += Math.min(time - this.previousTime, 1000);
        this.previousTime = time;
        if (this.elapsed >= this.engine.gravity) {
            this.elapsed %= this.engine.gravity;
            this.engine.tick();
            this.render();
        }
        if (this.engine.status === 'playing') this.frameId = requestAnimationFrame(this.frame);
    };

    private act(action: Action, clockwise = true): void {
        if (this.engine.status !== 'playing') return;
        const previous = this.engine.active;
        switch (action) {
            case 'left': this.engine.move(-1); break;
            case 'right': this.engine.move(1); break;
            case 'rotate': this.engine.rotate(clockwise); break;
            case 'down': this.engine.tick(true); break;
            case 'drop': this.engine.hardDrop(); break;
        }
        if (previous !== this.engine.active) this.elapsed = 0;
        this.render();
    }

    private render(): void {
        const engine = this.engine;
        if (engine.status !== 'playing' || this.gesture?.piece !== engine.active) this.clearGesture();
        if (engine.score > this.best) {
            this.best = engine.score;
            try { localStorage.setItem('noritris.best', String(this.best)); } catch { /* Optional persistence. */ }
        }
        this.renderer.draw(engine);
        this.stats.score.textContent = engine.score.toLocaleString('ru-RU');
        this.stats.best.textContent = this.best.toLocaleString('ru-RU');
        this.stats.lines.textContent = String(engine.lines);
        this.stats.level.textContent = String(engine.level).padStart(2, '0');
        this.restart.disabled = engine.status === 'idle';
        document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
            button.disabled = engine.status !== 'playing';
        });
        if (this.lastStatus !== engine.status) {
            const copy = {
                idle: ['Готов к игре', 'Начать игру', 'Поймай свой ритм', 'Собирай линии. Освобождай место. И просто наслаждайся.'],
                playing: ['Игра идёт', 'Пауза', '', ''],
                paused: ['На паузе', 'Продолжить', 'Небольшая пауза', 'Твои блоки никуда не спешат. Продолжим?'],
                over: ['Игра окончена', 'Играть ещё', 'Ещё одну партию?', `Твой результат — ${engine.score.toLocaleString('ru-RU')}. Каждый раз получается чуть лучше.`],
            }[engine.status];
            this.status.textContent = copy[0];
            this.status.dataset.state = engine.status;
            this.primary.textContent = copy[1];
            this.overlayButton.textContent = copy[1];
            this.overlayTitle.textContent = copy[2];
            this.overlayText.textContent = copy[3];
            this.overlay.hidden = engine.status === 'playing';
            this.lastStatus = engine.status;
        }
        if (engine.status !== 'playing') {
            this.cancelLoop();
            this.clearRepeat();
        }
    }

    private clearRepeat = (): void => {
        if (this.repeatTimer !== null) clearInterval(this.repeatTimer);
        this.repeatTimer = null;
    };

    private clearGesture(): void {
        const gesture = this.gesture;
        this.gesture = null;
        if (gesture && this.canvas.hasPointerCapture(gesture.id)) this.canvas.releasePointerCapture(gesture.id);
    }

    private fullscreen(): void {
        const button = this.get<HTMLButtonElement>('fullscreen-btn');
        button.hidden = !document.fullscreenEnabled;
        button.addEventListener('click', async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
            } catch {
                // The viewport layout still works if the browser disallows fullscreen.
                button.hidden = true;
            }
        });
        document.addEventListener('fullscreenchange', () => {
            const active = Boolean(document.fullscreenElement);
            button.setAttribute('aria-pressed', String(active));
            button.setAttribute('aria-label', active ? 'Выйти из полного экрана' : 'На весь экран');
            button.title = button.getAttribute('aria-label')!;
            this.clearGesture();
            this.renderer.resize();
            this.render();
        });
    }

    private touchSurface(surface: HTMLElement): void {
        const mobile = window.matchMedia('(max-width: 600px), (pointer: coarse)');
        const inGame = (event: Event): boolean => mobile.matches || surface.contains(event.target as Node);
        let pressed: { button: HTMLButtonElement; id: number; x: number; y: number } | null = null;
        // Safari can start selection, a callout or rubber-band scrolling between quick taps.
        for (const type of ['selectstart', 'contextmenu', 'dragstart']) {
            surface.addEventListener(type, event => event.preventDefault());
        }
        surface.addEventListener('touchmove', event => {
            if (event.cancelable) event.preventDefault();
        }, { passive: false });
        document.addEventListener('touchstart', event => {
            if (!inGame(event)) return;
            pressed = null;
            if (event.touches.length !== 1) return;
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button:not([data-action])');
            if (!button || !surface.contains(button) || button.disabled) return;
            const touch = event.touches[0];
            pressed = { button, id: touch.identifier, x: touch.clientX, y: touch.clientY };
        }, { passive: true, capture: true });
        document.addEventListener('touchmove', event => {
            if (!pressed) return;
            const touch = Array.from(event.touches).find(touch => touch.identifier === pressed!.id);
            if (!touch || Math.max(Math.abs(touch.clientX - pressed.x), Math.abs(touch.clientY - pressed.y)) > 10) pressed = null;
        }, { passive: true, capture: true });
        document.addEventListener('touchend', event => {
            if (!inGame(event)) return;
            const press = pressed;
            pressed = null;
            if (!event.cancelable) return;
            // Cancel the native double-tap zoom, including taps on the screen's empty margins.
            event.preventDefault();
            // Cancelling touchend also suppresses its native click. Keep UI buttons working;
            // the canvas and data-action controls already act on pointer events.
            if (!press || event.touches.length || press.button.disabled) return;
            const touch = Array.from(event.changedTouches).find(touch => touch.identifier === press.id);
            const rect = press.button.getBoundingClientRect();
            if (touch && touch.clientX >= rect.left && touch.clientX <= rect.right
                && touch.clientY >= rect.top && touch.clientY <= rect.bottom) press.button.click();
        }, { passive: false, capture: true });
        document.addEventListener('touchcancel', () => { pressed = null; }, { passive: true, capture: true });
        document.addEventListener('dblclick', event => { if (inGame(event)) event.preventDefault(); });
    }

    private controls(canvas: HTMLCanvasElement): void {
        this.touchSurface(document.querySelector<HTMLElement>('.game-layout')!);
        const keys: Record<string, Action> = {
            ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate',
            ArrowDown: 'down', Space: 'drop', KeyX: 'rotate', KeyZ: 'rotate',
        };
        document.addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if ((event.target as HTMLElement)?.matches('input, textarea, select, [contenteditable="true"]')) return;
            if (event.code === 'KeyP' || event.code === 'Escape') {
                if (this.engine.status === 'idle' || this.engine.status === 'over') return;
                event.preventDefault();
                if (!event.repeat) this.toggle();
                return;
            }
            const action = keys[event.code];
            if (!action) return;
            if (this.engine.status === 'paused') {
                event.preventDefault();
                return;
            }
            if (this.engine.status !== 'playing') return;
            event.preventDefault();
            if (event.repeat && (action === 'rotate' || action === 'drop')) return;
            this.act(action, event.code !== 'KeyZ');
        });
        document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
            const action = button.dataset.action as Action;
            button.addEventListener('pointerdown', event => {
                if (event.button !== 0 || button.disabled) return;
                event.preventDefault();
                this.clearRepeat();
                button.setPointerCapture(event.pointerId);
                this.act(action);
                if (['left', 'right', 'down'].includes(action) && this.engine.status === 'playing') {
                    this.repeatTimer = setInterval(() => this.act(action), 130);
                }
            });
            // Keyboard and assistive technology activations produce clicks without a pointer.
            button.addEventListener('click', event => { if (event.detail === 0) this.act(action); });
            button.addEventListener('lostpointercapture', this.clearRepeat);
            button.addEventListener('pointerup', this.clearRepeat);
            button.addEventListener('pointercancel', this.clearRepeat);
        });
        canvas.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' || !event.isPrimary || this.engine.status !== 'playing'
                || !this.engine.active || this.gesture) return;
            event.preventDefault();
            this.gesture = {
                id: event.pointerId, startX: event.clientX, startY: event.clientY,
                originX: event.clientX, anchorX: this.engine.active.x,
                cellWidth: Math.max(1, canvas.getBoundingClientRect().width / this.engine.columns),
                dragging: false, piece: this.engine.active,
            };
            canvas.setPointerCapture(event.pointerId);
        });
        const followFinger = (event: PointerEvent): void => {
            const gesture = this.gesture;
            if (!gesture || gesture.id !== event.pointerId) return;
            if (this.engine.status !== 'playing' || this.engine.active !== gesture.piece) {
                this.clearGesture();
                return;
            }
            const dx = event.clientX - gesture.startX;
            const dy = event.clientY - gesture.startY;
            if (!gesture.dragging && Math.abs(dx) >= Math.min(10, gesture.cellWidth / 2)
                && Math.abs(dx) >= Math.abs(dy)) gesture.dragging = true;
            if (!gesture.dragging) return;
            const targetX = gesture.anchorX + Math.round((event.clientX - gesture.originX) / gesture.cellWidth);
            let moved = false;
            while (gesture.piece.x !== targetX) {
                const direction = targetX > gesture.piece.x ? 1 : -1;
                if (!this.engine.move(direction)) {
                    // Re-anchor at a wall or block so reversing does not need to undo finger overshoot.
                    gesture.originX = event.clientX;
                    gesture.anchorX = gesture.piece.x;
                    break;
                }
                moved = true;
            }
            if (moved) this.render();
        };
        canvas.addEventListener('pointermove', followFinger);
        canvas.addEventListener('pointerup', event => {
            const gesture = this.gesture;
            if (!gesture || gesture.id !== event.pointerId) return;
            followFinger(event);
            this.clearGesture();
            if (this.engine.status !== 'playing' || this.engine.active !== gesture.piece || gesture.dragging) return;
            const dx = event.clientX - gesture.startX;
            const dy = event.clientY - gesture.startY;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) this.act('rotate');
            else if (Math.abs(dy) > Math.abs(dx)) this.act(dy > 0 ? 'drop' : 'rotate');
        });
        const cancelGesture = (event: PointerEvent): void => {
            if (this.gesture?.id === event.pointerId) this.clearGesture();
        };
        canvas.addEventListener('pointercancel', cancelGesture);
        canvas.addEventListener('lostpointercapture', cancelGesture);
    }
}

import { Engine } from './Engine';
import { Renderer } from './Renderer';
import { GameStatus } from './types';

type Action = 'left' | 'right' | 'rotate' | 'down' | 'drop';

export class Game {
    private engine = new Engine();
    private renderer: Renderer;
    private frameId: number | null = null;
    private previousTime: number | null = null;
    private elapsed = 0;
    private repeatTimer: ReturnType<typeof setInterval> | null = null;
    private best = 0;
    private lastStatus: GameStatus | null = null;
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
        const canvas = this.get<HTMLCanvasElement>('game');
        this.renderer = new Renderer(canvas, this.get<HTMLCanvasElement>('next'));
        try {
            const stored = Number(localStorage.getItem('noritris.best'));
            if (Number.isSafeInteger(stored) && stored > 0) this.best = stored;
        } catch { /* The game also works when storage is unavailable. */ }
        this.primary.addEventListener('click', () => this.toggle());
        this.overlayButton.addEventListener('click', () => this.toggle());
        this.restart.addEventListener('click', () => this.start());
        this.controls(canvas);
        window.addEventListener('resize', () => { this.renderer.resize(); this.render(); });
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

    private controls(canvas: HTMLCanvasElement): void {
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
        let gesture: { x: number; y: number; id: number } | null = null;
        canvas.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' || this.engine.status !== 'playing' || gesture) return;
            gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
            canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointerup', event => {
            if (!gesture || gesture.id !== event.pointerId) return;
            const dx = event.clientX - gesture.x;
            const dy = event.clientY - gesture.y;
            gesture = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) this.act('rotate');
            else if (Math.abs(dx) > Math.abs(dy)) this.act(dx > 0 ? 'right' : 'left');
            else this.act(dy > 0 ? 'drop' : 'rotate');
        });
        canvas.addEventListener('pointercancel', () => { gesture = null; });
        canvas.addEventListener('lostpointercapture', () => { gesture = null; });
    }
}

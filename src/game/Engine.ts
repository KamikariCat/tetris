import { Element } from './Element';
import { pieceTypes } from './data';
import { Cell, GameStatus, PieceType } from './types';

export class Engine {
    status: GameStatus = 'idle';
    staticStore: Cell[] = [];
    active: Element | null = null;
    next: PieceType = 'T';
    score = 0;
    lines = 0;
    private bag: PieceType[] = [];

    constructor(readonly columns = 10, readonly rows = 20, private random = Math.random) {
        if (!Number.isInteger(columns) || columns < 4 || !Number.isInteger(rows) || rows < 4) {
            throw new Error('The board must contain at least 4 × 4 cells.');
        }
    }

    get level(): number { return Math.floor(this.lines / 10) + 1; }
    get gravity(): number { return Math.max(100, 800 * Math.pow(0.82, this.level - 1)); }

    start(): void {
        this.staticStore = [];
        this.score = 0;
        this.lines = 0;
        this.bag = [];
        this.status = 'playing';
        this.next = this.takePiece();
        this.spawn();
    }

    pause(): void { if (this.status === 'playing') this.status = 'paused'; }
    resume(): void { if (this.status === 'paused') this.status = 'playing'; }

    canPlace = (cells: Cell[]): boolean => cells.every(cell =>
        Number.isInteger(cell.x) && Number.isInteger(cell.y)
        && cell.x >= 0 && cell.x < this.columns && cell.y >= 0 && cell.y < this.rows
        && !this.staticStore.some(occupied => occupied.x === cell.x && occupied.y === cell.y));

    move(direction: -1 | 1): boolean {
        return this.status === 'playing' && !!this.active?.move(direction, 0, this.canPlace);
    }

    rotate(clockwise = true): boolean {
        return this.status === 'playing' && !!this.active?.rotate(this.canPlace, clockwise);
    }

    tick(softDrop = false): boolean {
        if (this.status !== 'playing' || !this.active) return false;
        if (this.active.move(0, 1, this.canPlace)) {
            if (softDrop) this.score++;
        } else {
            this.lock();
        }
        return true;
    }

    hardDrop(): boolean {
        if (this.status !== 'playing' || !this.active) return false;
        let distance = 0;
        while (this.active.move(0, 1, this.canPlace)) distance++;
        this.score += distance * 2;
        this.lock();
        return true;
    }

    clearRows(): number {
        const counts = new Map<number, number>();
        this.staticStore.forEach(cell => counts.set(cell.y, (counts.get(cell.y) ?? 0) + 1));
        const cleared = [...counts].filter(([, count]) => count === this.columns).map(([y]) => y);
        if (!cleared.length) return 0;
        this.staticStore = this.staticStore.filter(cell => !cleared.includes(cell.y)).map(cell => ({
            ...cell, y: cell.y + cleared.filter(y => y > cell.y).length,
        }));
        this.score += ([0, 100, 300, 500, 800][cleared.length] ?? cleared.length * 200) * this.level;
        this.lines += cleared.length;
        return cleared.length;
    }

    private lock(): void {
        if (!this.active) return;
        this.staticStore.push(...this.active.cells());
        this.clearRows();
        this.spawn();
    }

    private spawn(): void {
        const piece = new Element(this.next, this.columns);
        this.next = this.takePiece();
        if (!this.canPlace(piece.cells())) {
            this.active = null;
            this.status = 'over';
        } else {
            this.active = piece;
        }
    }

    private takePiece(): PieceType {
        if (!this.bag.length) {
            this.bag = [...pieceTypes];
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(this.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
        }
        return this.bag.pop()!;
    }
}

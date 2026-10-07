import { Engine } from './Engine';
import { Element } from './Element';
import { Cell } from './types';

export class Renderer {
    private readonly ctx: CanvasRenderingContext2D;
    private readonly previewCtx: CanvasRenderingContext2D;
    private readonly cellSize = 30;

    constructor(private canvas: HTMLCanvasElement, private preview: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        const previewCtx = preview.getContext('2d');
        if (!ctx || !previewCtx) throw new Error('Canvas 2D is unavailable in this browser.');
        this.ctx = ctx;
        this.previewCtx = previewCtx;
        this.resize();
    }

    resize(): void {
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        for (const [canvas, ctx, width, height] of [
            [this.canvas, this.ctx, 300, 600], [this.preview, this.previewCtx, 160, 96],
        ] as const) {
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        }
    }

    draw(engine: Engine): void {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 300, 600);
        ctx.fillStyle = '#19181f';
        ctx.fillRect(0, 0, 300, 600);
        ctx.strokeStyle = '#ffffff06';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < engine.columns; x++) {
            ctx.moveTo(x * this.cellSize + 0.5, 0);
            ctx.lineTo(x * this.cellSize + 0.5, 600);
        }
        for (let y = 1; y < engine.rows; y++) {
            ctx.moveTo(0, y * this.cellSize + 0.5);
            ctx.lineTo(300, y * this.cellSize + 0.5);
        }
        ctx.stroke();
        engine.staticStore.forEach(cell => this.block(ctx, cell));
        if (engine.active) {
            engine.active.landing(engine.canPlace).forEach(cell => this.block(ctx, cell, true));
            engine.active.cells().forEach(cell => this.block(ctx, cell));
        }
        this.previewCtx.clearRect(0, 0, 160, 96);
        const cells = new Element(engine.next, engine.columns).cells();
        const minX = Math.min(...cells.map(cell => cell.x));
        const minY = Math.min(...cells.map(cell => cell.y));
        const width = Math.max(...cells.map(cell => cell.x)) - minX + 1;
        const height = Math.max(...cells.map(cell => cell.y)) - minY + 1;
        for (const cell of cells) {
            this.block(this.previewCtx, {
                ...cell,
                x: cell.x - minX + (160 / this.cellSize - width) / 2,
                y: cell.y - minY + (96 / this.cellSize - height) / 2,
            });
        }
    }

    private block(ctx: CanvasRenderingContext2D, cell: Cell, ghost = false): void {
        const x = cell.x * this.cellSize + 2;
        const y = cell.y * this.cellSize + 2;
        const size = this.cellSize - 4;
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.arcTo(x + size, y, x + size, y + size, 4);
        ctx.arcTo(x + size, y + size, x, y + size, 4);
        ctx.arcTo(x, y + size, x, y, 4);
        ctx.arcTo(x, y, x + size, y, 4);
        ctx.closePath();
        ctx.fillStyle = ghost ? `${cell.color}0c` : cell.color;
        ctx.fill();
        ctx.strokeStyle = ghost ? `${cell.color}55` : '#ffffff25';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (!ghost) {
            ctx.fillStyle = '#ffffff25';
            ctx.fillRect(x + 4, y + 3, size - 8, 2);
            ctx.fillStyle = '#00000012';
            ctx.fillRect(x + 3, y + size - 4, size - 6, 2);
        }
    }
}

import { colors, shapes } from './data';
import { CanPlace, Cell, Matrix, PieceType } from './types';

export class Element {
    readonly color: string;
    matrix: Matrix;
    x: number;
    y: number;

    constructor(readonly type: PieceType, columns: number) {
        this.color = colors[type];
        this.matrix = shapes[type].map(row => [...row]);
        this.x = Math.floor((columns - this.matrix.length) / 2);
        this.y = type === 'I' ? -1 : 0;
    }

    cells(dx = 0, dy = 0, matrix = this.matrix): Cell[] {
        const cells: Cell[] = [];
        matrix.forEach((row, y) => row.forEach((filled, x) => {
            if (filled) cells.push({ x: this.x + x + dx, y: this.y + y + dy, color: this.color });
        }));
        return cells;
    }

    move(dx: number, dy: number, canPlace: CanPlace): boolean {
        if (!canPlace(this.cells(dx, dy))) return false;
        this.x += dx;
        this.y += dy;
        return true;
    }

    rotate(canPlace: CanPlace, clockwise = true): boolean {
        if (this.type === 'O') return true;
        const size = this.matrix.length;
        const rotated = this.matrix.map((row, y) => row.map((_, x) => clockwise
            ? this.matrix[size - 1 - x][y]
            : this.matrix[x][size - 1 - y]));
        // Small shifts let pieces turn against the walls and floor.
        for (const dy of [0, -1, -2, 1, 2]) {
            for (const dx of [0, -1, 1, -2, 2]) {
                if (!canPlace(this.cells(dx, dy, rotated))) continue;
                this.matrix = rotated;
                this.x += dx;
                this.y += dy;
                return true;
            }
        }
        return false;
    }

    landing(canPlace: CanPlace): Cell[] {
        let distance = 0;
        while (canPlace(this.cells(0, distance + 1))) distance++;
        return this.cells(0, distance);
    }
}

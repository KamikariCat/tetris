import { Matrix, PieceType } from './types';

export const colors: Record<PieceType, string> = {
    I: '#82cbd0', O: '#e8c77a', T: '#b69add',
    S: '#9ac69b', Z: '#df8b9a', J: '#8daee0', L: '#e9a478',
};

export const shapes: Record<PieceType, Matrix> = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

export const pieceTypes = Object.keys(shapes) as PieceType[];

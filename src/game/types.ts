export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'over';
export type Matrix = number[][];
export interface Cell { x: number; y: number; color: string; }
export type CanPlace = (cells: Cell[]) => boolean;

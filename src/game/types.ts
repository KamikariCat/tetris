export interface IGameOptions
{
    canvas: HTMLCanvasElement;
    startBtn: HTMLButtonElement;
    stopBtn: HTMLButtonElement;
    elementSize: number;
    xElements: number;
    yElements: number;
    elementGapVertical: number;
    elementGapHorizontal: number;
    gameMargin: number;
}

export type ElementType =
    | 'hStraight'
    | 'vStraight'
    // clockwise margin
    | 'cwTopLeft'
    | 'cwTopRight'
    | 'cwBottomRight'
    | 'cwBottomLeft'
    // counterclockwise margin
    | 'ccwTopLeft'
    | 'ccwTopRight'
    | 'ccwBottomRight'
    | 'ccwBottomLeft'
    // TShape
    | 'tShapeTop'
    | 'tShapeBottom'
    | 'tShapeLeft'
    | 'tShapeRight'
    // Rect
    | 'rect'

export interface IStaticStoreElement
{
    x: number;
    y: number;
    color: string;
}

import {ElementType, IStaticStoreElement} from "./types";
import {Game} from "./Game";

export class Element
{
    parts: IStaticStoreElement[];
    reflection: IStaticStoreElement[];
    type: ElementType;
    startPoint: {x: number, y: number}
    color: string;
    game: Game;

    public constructor (game: Game, startPoint: {x: number, y: number}, type: ElementType, color: string)
    {
        this.parts = [];
        this.reflection = [];
        this.color = color;
        this.type = type;
        this.startPoint = { x: 3, y: 1 };
        this.game = game;
        const canCreate = this.setShape(type);
        if (!canCreate){
            this.game.stop()
            this.game.createLostScene();
        }
    }

    spawnFinalReflection () {
        let reflectionParts: IStaticStoreElement[] = this.parts.map(o => ({...o, color: 'rgba(204,204,204,0.28)'}));

        for (let i = 1; i <= 19; i++)
        {
            if (this.isElementDown(reflectionParts)) break;

            reflectionParts = reflectionParts.map(p => ({...p, y: p.y + 1}));
        }

        this.reflection = reflectionParts;
    }

    public moveLeft ()
    {
        const mostLeftSide = this.parts.reduce((p, c) => c.x <= p ? c.x : p, this.game.xElements);
        if (
            mostLeftSide <= 1
            || this.parts.some(p => this.game.staticStore.find(e => e.y === p.y && p.x - 1 === e.x))
        ) return;

        this.parts = this.parts.map(part => ({ ...part, x: part.x-1 }))
        this.startPoint.x--
        this.spawnFinalReflection()
    }

    public moveRight ()
    {
        const mostRightSide = this.parts.reduce((p, c) => c.x >= p ? c.x : p, 1);
        if (
            mostRightSide >= this.game.xElements
            || this.parts.some(p => this.game.staticStore.find(e => e.y === p.y && p.x + 1 === e.x))
        ) return;

        this.parts = this.parts.map(part => ({ ...part, x: part.x+1 }))
        this.startPoint.x++
        this.spawnFinalReflection();
    }

    public rotate ()
    {
        switch (this.type) {
            //! Straight
            case "hStraight":
                this.type = 'vStraight'
                this.setShape('vStraight')
                break
            case 'vStraight':
                this.type = 'hStraight'
                this.setShape('hStraight')
                break
            //! Corner
            case 'cwBottomLeft':
                this.type = 'cwTopLeft'
                this.setShape('cwTopLeft')
                break
            case 'cwTopLeft':
                this.type = 'cwTopRight'
                this.setShape('cwTopRight')
                break
            case 'cwTopRight':
                this.type = 'cwBottomRight'
                this.setShape('cwBottomRight')
                break
            case 'cwBottomRight':
                this.type = 'cwBottomLeft'
                this.setShape('cwBottomLeft')
                break
            //! Corner
            case 'ccwBottomLeft':
                this.type = 'ccwTopLeft'
                this.setShape('ccwTopLeft')
                break
            case 'ccwTopLeft':
                this.type = 'ccwTopRight'
                this.setShape('ccwTopRight')
                break
            case 'ccwTopRight':
                this.type = 'ccwBottomRight'
                this.setShape('ccwBottomRight')
                break
            case 'ccwBottomRight':
                this.type = 'ccwBottomLeft'
                this.setShape('ccwBottomLeft')
                break
            //! TShape
            case 'tShapeTop':
                this.type = 'tShapeRight'
                this.setShape('tShapeRight')
                break
            case 'tShapeRight':
                this.type = 'tShapeBottom'
                this.setShape('tShapeBottom')
                break
            case 'tShapeBottom':
                this.type = 'tShapeLeft'
                this.setShape('tShapeLeft')
                break
            case 'tShapeLeft':
                this.type = 'tShapeTop'
                this.setShape('tShapeTop')
                break
        }
    }

    public setShape (type: ElementType)
    {
        let parts: IStaticStoreElement[] = [];

        switch (type)
        {
            // === === === STRAIGHT === === ===
            case "hStraight": parts = this.calcFutureElementValues(
                    0, 0,
                    1, 0,
                    2, 0,
                    3, 0
                ); break;
            case 'vStraight': parts = this.calcFutureElementValues(
                    0, -1,
                    0, 0,
                    0, 1,
                    0, 2,
                ); break;
            // === === === RECT === === ===
            case 'rect': parts = this.calcFutureElementValues(
                    0, 0,
                    1, 0,
                    0, 1,
                    1, 1,
                ); break;
            // === === === CORNER === === ===
            //! Clockwise
            case "cwBottomLeft": parts = this.calcFutureElementValues(
                    0, 0,
                    0, 1,
                    1, 1,
                    2, 1,
                ); break;
            case "cwTopLeft": parts = this.calcFutureElementValues(
                    0,0,
                    1,0,
                    0,1,
                    0,2,
                ); break;
            case "cwTopRight": parts = this.calcFutureElementValues(
                    0,0,
                    1,0,
                    2,0,
                    2,1,
                ); break;
            case "cwBottomRight": parts = this.calcFutureElementValues(
                    0,0,
                    0,1,
                    0,2,
                    -1,2,
                ); break;
            //! Counterclockwise
            case "ccwBottomRight": parts = this.calcFutureElementValues(
                    0,0,
                    1,0,
                    2,0,
                    2,-1,
                ); break;
            case "ccwBottomLeft": parts = this.calcFutureElementValues(
                    0,0,
                    0,1,
                    0,2,
                    1,2,
                ); break;
            case "ccwTopLeft": parts = this.calcFutureElementValues(
                    0,0,
                    1,0,
                    2,0,
                    0,1,
                ); break;
            case "ccwTopRight": parts = this.calcFutureElementValues(
                    0,0,
                    1,0,
                    1,1,
                    1,2,
                ); break;
            //! TShape
            case "tShapeTop": parts = this.calcFutureElementValues(
                0,0,
                1,0,
                2,0,
                1,1,
            ); break;
            case "tShapeRight": parts = this.calcFutureElementValues(
                0,0,
                0,1,
                0,2,
                -1,1,
            ); break;
            case "tShapeBottom": parts = this.calcFutureElementValues(
                0,0,
                1,0,
                2,0,
                1,-1,
            ); break;
            case "tShapeLeft": parts = this.calcFutureElementValues(
                0,0,
                0,1,
                0,2,
                1,1,
            ); break;
        }


        const minX = parts.reduce((p, c) => c.x < p ? c.x : p, this.game.xElements);
        const maxX = parts.reduce((p, c) => c.x > p ? c.x : p, this.game.xElements);
        const minY = parts.reduce((p, c) => c.y < p ? c.y : p, this.game.yElements);
        const maxY = parts.reduce((p, c) => c.x < p ? c.y : p, this.game.yElements);

        if (minX < 1) parts = parts.map(p => ({ ...p, x: p.x + (1 - minX) }))
        if (maxX > this.game.xElements) parts = parts.map(p => ({ ...p, x: p.x - (maxX - this.game.xElements) }));
        if (minY < 1) parts = parts.map(p => ({ ...p, y: p.y + (1 - minY) }))
        if (maxY > this.game.yElements) parts = parts.map(p => ({ ...p, y: p.y - (maxY - this.game.yElements) }));

        if (parts.some(p => this.game.staticStore.find(e => e.x === p.x && e.y === p.y))) return null;

        this.parts = parts
        this.spawnFinalReflection();
        return true;
    }

    calcFutureElementValues (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number)
    {
        return [
            { color: this.color, x: this.startPoint.x + x1, y: this.startPoint.y + y1 },
            { color: this.color, x: this.startPoint.x + x2, y: this.startPoint.y + y2 },
            { color: this.color, x: this.startPoint.x + x3, y: this.startPoint.y + y3 },
            { color: this.color, x: this.startPoint.x + x4, y: this.startPoint.y + y4 },
        ]
    }

    public isElementDown (parts = this.parts)
    {
        return !!parts.find(
                part => this.game.staticStore.find(
                        staticElement => staticElement.x === part.x && staticElement.y === part.y+1
                    )
                    || part.y >= this.game.yElements
            )
            ?? false;
    }

    public moveDown ()
    {
        if (this.game.movingDown) return;
        this.game.movingDown = true;
        this.parts = this.reflection.map(p => ({...p, color: this.color}));
        this.game.clearInterval();
        setTimeout(() => {
            this.update();
            this.game.setInterval();
            this.game.movingDown = false;
        }, 500);
    }

    public update ()
    {
        const isClose = this.isElementDown();

        if (!isClose)
        {
            this.parts.forEach(part => part.y++);
            this.startPoint.y++;
        }
        else
        {
            this.game.dynamicToStatic();
        }
    }
}

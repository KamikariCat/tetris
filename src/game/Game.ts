import {IGameOptions, IStaticStoreElement} from './types'
import {Element} from "./Element";
import {colors, shapes} from "./data";
import {getRandomIntInclusive} from "../helper";
import {equals} from "ramda";

export class Game
{
    canvas: HTMLCanvasElement;
    startBtn: HTMLButtonElement;
    stopBtn: HTMLButtonElement;
    partSize: number;
    xElements: number;
    yElements: number;
    vGap: number;
    hGap: number;
    margin: number;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    score: number;
    timer: NodeJS.Timer | null;
    stopped: boolean;
    movingDown: boolean;

    staticStore: IStaticStoreElement[];
    dynamicElement: Element | null;

    constructor (options: IGameOptions)
    {
        // Options
        this.canvas = options.canvas;
        this.startBtn = options.startBtn
        this.stopBtn = options.stopBtn

        this.partSize = options.elementSize;
        this.xElements = options.xElements;
        this.yElements = options.yElements;
        this.vGap = options.elementGapVertical;
        this.hGap = options.elementGapHorizontal;
        this.margin = options.gameMargin;
        this.stopped = true;
        this.score = 0;
        this.movingDown = false;

        this.staticStore = []
        this.dynamicElement = null;

        this.ctx = this.canvas.getContext('2d');

        this.width = (this.margin * 2) + (this.xElements * this.partSize) + (this.hGap * (this.xElements-1));
        this.height = (this.margin * 2) + (this.yElements * this.partSize) + (this.vGap * (this.yElements-1));

        this.setCanvasSize();
        this.createStartScene();

        this.controlKeys();
    }

    createStartScene ()
    {
        this.ctx.clearRect(0, 0, this.width, this.height)

        this.ctx.fillStyle = '#151515';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.font = "30px Comic Sans MS";
        this.ctx.fillStyle = "white";
        this.ctx.textAlign = "center";
        this.ctx.fillText('START', this.width / 2 - this.margin, this.height / 2 - this.margin );
    }

    createLostScene ()
    {
        this.ctx.clearRect(0, 0, this.width, this.height)

        this.ctx.fillStyle = '#151515';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.font = "30px Comic Sans MS";
        this.ctx.fillStyle = "red";
        this.ctx.textAlign = "center";
        this.ctx.fillText('You lost', this.width / 2 - this.margin, this.height / 2 - this.margin );
    }

    createGameScene ()
    {
         this.ctx.clearRect(0, 0, this.width, this.height)

        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.renderStaticStore();
        this.renderDynamicElement();
        this.renderScore();
    }

    public controlKeys ()
    {
        this.startBtn.addEventListener('click', () => {
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.start();
        })
        this.stopBtn.addEventListener('click', () => {
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.stop();
        })

        document.addEventListener('keyup', ev => {
            if (this.stopped) return;
            if (this.dynamicElement)
            {
                if (ev.key === 'ArrowUp') this.dynamicElement.rotate()
                if (ev.key === 'ArrowDown') this.dynamicElement.moveDown()
            }
        })
        document.addEventListener('keydown', ev => {
            if (this.stopped) return;
            if (this.dynamicElement)
            {
                if (ev.key === 'ArrowLeft') this.dynamicElement.moveLeft()
                if (ev.key === 'ArrowRight') this.dynamicElement.moveRight()
            }
        })

        let x = 0;
        let y = 0;

        document.addEventListener('touchstart', ev => {
            x = Math.round(ev.changedTouches[0].clientX);
            y = Math.round(ev.changedTouches[0].clientY);
        })

        document.addEventListener('touchend', ev => {
            const endX = ev.changedTouches[0].clientX
            const endY = ev.changedTouches[0].clientY

            if (y > endY && y - endY > 200) return this.stopped ? this.start() : this.stop();

            if (this.stopped) return;

            if (x < endX && endX - x > 50) return  this.dynamicElement.moveRight();
            if (x > endX && x - endX > 50) return  this.dynamicElement.moveLeft();

            if (y < endY && endY - y > 50) return  this.dynamicElement.update();

            this.dynamicElement.rotate()
        })
    }

    deleteCompletedRows ()
    {
        let elements = this.staticStore;
        // Rows clearing
        for (let i = this.yElements; i >= 1; i--)
        {
            while (elements.filter(e => e.y === i).length === this.xElements)
            {
                elements = elements.filter(e => e.y !== i).map(e => e.y < i ? { ...e, y: e.y + 1 } : e);
            }
        }
        if (equals(this.staticStore, elements)) return;
        this.score += this.staticStore.length > elements.length ? this.staticStore.length - elements.length : this.score;
        this.staticStore = elements;
        this.deleteCompletedRows();
    }

    setInterval ()
    {
        this.timer = setInterval(() => {
            if (this.dynamicElement)
                this.dynamicElement.update();
        }, 800)
    }

    clearInterval ()
    {
        clearInterval(this.timer);
    }

    public start ()
    {
        this.stop();
        this.stopped = false;
        this.spawnElement();
        this.createGameScene();
        this.update();
        this.setInterval();
    }

    public stop()
    {
        this.clearInterval();
        this.staticStore = [];
        this.dynamicElement = null;
        this.timer = null;
        this.stopped = true;
        this.createStartScene();
    }

    public update ()
    {
        window.requestAnimationFrame(() => {
            if (this.stopped) return;
            this.createGameScene();
            this.renderDynamicElement();
            this.update();
        })
    }

    public spawnElement ()
    {
        this.deleteCompletedRows();
        const shape = shapes[getRandomIntInclusive(0, shapes.length-1)];
        const color = shape === 'hStraight' ? colors.red
            : shape === 'rect' ? colors.orange
                : shape === 'cwBottomLeft' ? colors.green
                    : shape === 'ccwBottomRight' ? colors.pink
                        : shape === 'tShapeTop' ? colors.blue
                        :colors.green;
        this.dynamicElement = new Element(this, { x: 3, y: 1 }, shape, color)
    }

    public renderScore ()
    {
        this.ctx.font = "14px Comic Sans MS";
        this.ctx.fillStyle = "white";
        this.ctx.textAlign = "right";
        this.ctx.fillText(String(this.score), this.width - this.margin, 14 + this.margin );
    }

    public dynamicToStatic ()
    {
        if (!this.dynamicElement) return;

        this.staticStore = [ ...this.staticStore, ...this.dynamicElement.parts ];
        this.spawnElement()
    }

    public renderDynamicElement ()
    {
        if (!this.dynamicElement) return;
        this.dynamicElement.parts.forEach(part => {
            this.ctx.fillStyle = part.color;
            this.ctx.fillRect(...this.calculateElementPosition(part.x, part.y), this.partSize, this.partSize);
        })

        this.dynamicElement.reflection.forEach(part => {
            this.ctx.fillStyle = part.color;
            this.ctx.fillRect(...this.calculateElementPosition(part.x, part.y), this.partSize, this.partSize);
        })
    }

    validateGridValues (x: number, y: number)
    {
        return x <= this.xElements || x >= 1 || y >= 1 || y <= this.yElements
    }

    public renderStaticStore ()
    {
        this.staticStore.forEach(element =>
        {
            this.ctx.fillStyle = element.color;
            this.ctx.fillRect(...this.calculateElementPosition(element.x, element.y), this.partSize, this.partSize);
        })
    }

    calculateElementPosition (x: number, y: number): [x: number, y: number]
    {
        if (!this.validateGridValues(x, y)) return null;
        return [
            this.margin + (x - 1) * this.partSize + (this.hGap * x - 1),
            this.margin + (y - 1) * this.partSize + (this.vGap * y - 1)
        ]
    }

    setCanvasSize()
    {
        this.canvas.setAttribute('width', this.width.toString());
        this.canvas.setAttribute('height', this.height.toString());
    }
}

import {IGameOptions, IStaticStoreElement} from './types'
import {Element} from "./Element";
import {colors, shapes} from "./data";
import {getRandomIntInclusive} from "../helper";
import {equals} from "ramda";

export class Game
{
    canvas: HTMLCanvasElement;
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

    staticStore: IStaticStoreElement[];
    dynamicElement: Element | null;

    constructor (options: IGameOptions)
    {
        // Options
        this.canvas = options.canvas;
        this.partSize = options.elementSize;
        this.xElements = options.xElements;
        this.yElements = options.yElements;
        this.vGap = options.elementGapVertical;
        this.hGap = options.elementGapHorizontal;
        this.margin = options.gameMargin;
        this.stopped = true;
        this.score = 0;

        this.staticStore = []
        this.dynamicElement = null;

        this.ctx = this.canvas.getContext('2d');

        this.width = (this.margin * 2) + (this.xElements * this.partSize) + (this.hGap * (this.xElements-1));
        this.height = (this.margin * 2) + (this.yElements * this.partSize) + (this.vGap * (this.yElements-1));

        this.setCanvasSize();
        this.createGameScene();

        this.controlKeys();

        this.canvas.style.display = 'none';

        document.getElementById('start').addEventListener('click', () =>
        {
            this.canvas.style.display = 'block';
            this.start();
        })
    }

    fullscreen ()
    {
        this.canvas.requestFullscreen({navigationUI: 'hide'}).then(console.log).catch(console.log);
    }

    createGameScene ()
    {
         this.ctx.clearRect(0, 0, this.width, this.height)

        this.ctx.fillStyle = 'rgb(17,17,17)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.renderStaticStore();
        this.renderDynamicElement();
        this.renderScore();
    }

    public controlKeys ()
    {
        document.addEventListener('keyup', ev => {
            if (this.stopped) return;
            if (this.dynamicElement)
            {
                if (ev.key === 'ArrowLeft') this.dynamicElement.moveLeft()
                if (ev.key === 'ArrowRight') this.dynamicElement.moveRight()
                if (ev.key === 'ArrowUp') this.dynamicElement.rotate()
                if (ev.key === 'ArrowDown') this.dynamicElement.update()
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

            console.log({yo: y > endY && y - endY > 200});

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

    public start ()
    {
        this.fullscreen();
        this.stop();
        this.stopped = false;
        this.spawnElement();
        this.update();
        this.timer = setInterval(() => {
            if (this.dynamicElement)
                this.dynamicElement.update();
        }, 800)
    }

    public stop()
    {
        clearInterval(this.timer);
        this.staticStore = [];
        this.dynamicElement = null;
        this.timer = null;
        this.stopped = true;
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

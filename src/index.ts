import { Game } from './game/Game';

const canvas = document.getElementById('game');
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;

if (canvas instanceof HTMLCanvasElement)
{
    
    new Game({
        canvas,
        startBtn,
        stopBtn,
        elementSize: 25,
        gameMargin: 0,
        elementGapHorizontal: 0,
        elementGapVertical: 0,
        xElements: 10,
        yElements: 20,
    });
    
}

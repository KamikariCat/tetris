import './styles/normalize.css';
import './styles/style.css';
import './index.html'

import { Game } from './game/Game';

const canvas = document.getElementById('game');

if (canvas instanceof HTMLCanvasElement)
{
    new Game({
        canvas,
        elementSize: 50,
        gameMargin: 1,
        elementGapHorizontal: 1,
        elementGapVertical: 1,
        xElements: 10,
        yElements: 16,
    });
}

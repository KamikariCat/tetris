import { Game } from './game/Game';

new Game();

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
            .catch(() => { /* Online play still works when the browser blocks storage. */ });
    }, { once: true });
}

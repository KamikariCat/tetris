// Webpack fills these values from the final production assets, including their contents.
const VERSION = __BUILD_REVISION__;
const PREFIX = `noritris:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const ASSETS = __PRECACHE_ASSETS__.map(path => new URL(path, self.registration.scope).href);
const INDEX = new URL('index.html', self.registration.scope).href;
const HOME_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        try {
            // addAll commits the complete set atomically; bypass stale HTTP caches on updates.
            await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
        } catch (error) {
            await caches.delete(CACHE);
            throw error;
        }
        // Let an update wait until all existing game windows close. Never interrupt a game.
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    url.search = '';
    url.hash = '';
    const home = request.mode === 'navigate' && (url.pathname === HOME_PATH || url.href === INDEX);
    if (!home && !ASSETS.includes(url.href)) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(home ? INDEX : url.href)) || fetch(request);
    })());
});

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, resolve, sep } from 'path';
import webpack from 'webpack';
import { config } from './webpack.config';

const root = resolve(__dirname, 'dist');
const mime: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.map': 'application/json',
};
const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
    }
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    } catch {
        response.writeHead(400).end('Bad request');
        return;
    }
    const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root + sep)) {
        response.writeHead(403).end('Forbidden');
        return;
    }
    try {
        const content = await readFile(filename);
        response.writeHead(200, { 'Content-Type': mime[extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
        response.writeHead(404).end('Not found');
    }
});
const compiler = webpack({ ...config, mode: 'development', devtool: 'source-map' });
let listening = false;
const watching = compiler.watch({ aggregateTimeout: 150 }, (error, stats) => {
    if (error) { console.error(error); return; }
    if (stats?.hasErrors()) {
        console.error(stats.toString({ all: false, errors: true }));
        return;
    }
    console.log('NORITris compiled.');
    if (!listening) {
        listening = true;
        server.listen(3000, '0.0.0.0', () => console.log('NORITris: http://localhost:3000'));
    }
});
if (!watching) throw new Error('Unable to start the webpack watcher.');
server.on('error', error => {
    console.error(error);
    watching.close(() => { process.exitCode = 1; });
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => watching.close(() => server.close(() => process.exit(0))));
}

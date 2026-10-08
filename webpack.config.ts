import * as path from 'path';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import * as webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

class OfflinePlugin {
    apply(compiler: webpack.Compiler): void {
        compiler.hooks.thisCompilation.tap('OfflinePlugin', compilation => {
            const read = (name: string): Buffer => {
                const filename = path.resolve(__dirname, 'src', name);
                compilation.fileDependencies.add(filename);
                return readFileSync(filename);
            };
            compilation.hooks.processAssets.tap({
                name: 'OfflinePlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            }, () => {
                // Manifest icon URLs are plain JSON; webpack cannot discover these images.
                for (const name of ['icons/icon-192.png', 'icons/icon-512.png', '_headers']) {
                    compilation.emitAsset(name, new webpack.sources.RawSource(read(name)));
                }
            });
            compilation.hooks.processAssets.tap({
                name: 'OfflinePlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
            }, () => {
                const template = read('service-worker.js').toString();
                const assets = compilation.getAssets().filter(asset => /\.(html|css|js|svg|png|webmanifest)$/.test(asset.name))
                    .sort((a, b) => a.name.localeCompare(b.name));
                const revision = createHash('sha256').update(template);
                for (const asset of assets) revision.update(asset.name).update(asset.source.buffer());
                const worker = template.replace('__BUILD_REVISION__', JSON.stringify(revision.digest('hex')))
                    .replace('__PRECACHE_ASSETS__', JSON.stringify(assets.map(asset => asset.name)));
                compilation.emitAsset('service-worker.js', new webpack.sources.RawSource(worker));
            });
        });
    }
}

export const config: webpack.Configuration = {
    mode: 'production',
    entry: './src/index.ts',
    module: {
        rules: [
            { test: /\.html$/i, loader: 'html-loader' },
            // Stable CSS names keep HTML URLs valid when production minimization changes the contents.
            { test: /\.css$/i, type: 'asset/resource', generator: { filename: 'styles/[name][ext]' } },
            { test: /\.webmanifest$/i, type: 'asset/resource', generator: { filename: '[name][ext]' } },
            { test: /\.png$/i, type: 'asset/resource', generator: { filename: 'icons/[name][ext]' } },
            { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
        ],
    },
    resolve: { extensions: ['.ts', '.js'] },
    output: { path: path.resolve(__dirname, 'dist'), filename: 'main.bundle.js', clean: true },
    plugins: [new HtmlWebpackPlugin({ template: './src/index.html', publicPath: './' }), new OfflinePlugin()],
};

export default config;

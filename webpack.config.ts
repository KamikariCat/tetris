import * as path from 'path';
import * as webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export const config: webpack.Configuration = {
    mode: 'production',
    entry: './src/index.ts',
    module: {
        rules: [
            { test: /\.html$/i, loader: 'html-loader' },
            { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
        ],
    },
    resolve: { extensions: ['.ts', '.js'] },
    output: { path: path.resolve(__dirname, 'dist'), filename: 'main.bundle.js', clean: true },
    plugins: [new HtmlWebpackPlugin({ template: './src/index.html', publicPath: './' })],
};

export default config;

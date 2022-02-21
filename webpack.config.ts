import * as path from 'path';
import * as webpack from 'webpack';
const HtmlWebpackPlugin = require('html-webpack-plugin');
// in case you run into any typescript error when configuring `devServer`
import 'webpack-dev-server';

export const config: webpack.Configuration = {
    mode: 'production',
    entry: './src/index.ts',
    module: {
        rules: [
            {
                test: /\.html$/i,
                loader: "html-loader",
            },
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ]
    },
    devServer: {
        liveReload: true,
        magicHtml: true,
        hot: true,
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.bundle.js',
    },
    plugins: [new HtmlWebpackPlugin({ template: './src/index.html' })]
};

export default config;

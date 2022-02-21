const Webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
import {config as webpackConfig} from './webpack.config'

const compiler = Webpack(webpackConfig);
const devServerOptions = { ...webpackConfig.devServer, open: true };
const server = new WebpackDevServer(devServerOptions, compiler);

server.startCallback(() => {
    console.log('Successfully started server on http://localhost:8080');
});

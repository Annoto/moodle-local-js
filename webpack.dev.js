const path = require('path');
const { merge } = require('webpack-merge');
const CommonConfig = require('./webpack.common');

module.exports = function (env) {
    const commonEnv = env;
    return merge(CommonConfig(commonEnv), {
        devtool: 'inline-cheap-module-source-map',
        mode: 'development',
        devServer: {
            port: 9002,
            allowedHosts: 'all',
            static: {
                directory: path.join(__dirname, 'dist'),
            },
            hot: false,
        },
    });
};

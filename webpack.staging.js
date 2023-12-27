const { merge } = require('webpack-merge');
const CommonConfig = require('./webpack.common');

module.exports = function (env) {
    return merge(CommonConfig(env), {
        devtool: 'nosources-source-map',
        mode: 'production',
        optimization: {
            splitChunks: {
                chunks: 'all',
                minSize: 100000,
            },
        },
    });
};

const path = require('path');
const webpack = require('webpack');
const packageData = require('./package.json');

module.exports = function (env) {
    return {
        entry: './src/main.ts',
        target: 'web',
        output: {
            filename: 'annoto.js',
            path: path.resolve(__dirname, 'dist/'),
            sourceMapFilename: 'annoto.map',
            clean: true,
            publicPath: '',
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.json',
                    },
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.env': {
                    version: JSON.stringify(packageData.version),
                    ENV: JSON.stringify(env.envName),
                    name: JSON.stringify(packageData.name),
                },
            }),
        ],
    };
};

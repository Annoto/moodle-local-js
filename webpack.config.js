/* eslint import/no-dynamic-require: "off" */
/* eslint global-require: "off" */

module.exports = function(env) {
    return require(`./webpack.${env.envName}`)(env);
};

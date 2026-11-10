/*
 * Unit test for widgetLoadedRequest in src/util.ts: the AJAX request that tells the Moodle plugin
 * the widget was loaded on a video, for its usage telemetry (local_annoto_widget_loaded).
 *
 *   npm run test:widget-load
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/util.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const mod = { exports: {} };
new Function('module', 'exports', 'window', 'document', outputText)(mod, mod.exports, {}, {}); // eslint-disable-line no-new-func
const { widgetLoadedRequest, WIDGET_LOADED_METHOD } = mod.exports;

assert.strictEqual(WIDGET_LOADED_METHOD, 'local_annoto_widget_loaded');

// An activity page: the plugin sends the course id as mediaGroupId and the cmid (numbers or strings).
assert.deepStrictEqual(widgetLoadedRequest({ mediaGroupId: '12', cmid: '345' }), {
    methodname: 'local_annoto_widget_loaded',
    args: { courseid: 12, cmid: 345 },
});
assert.deepStrictEqual(widgetLoadedRequest({ mediaGroupId: 12, cmid: 345 }).args, {
    courseid: 12,
    cmid: 345,
});

// The course page: the plugin sends cmid 0 (or nothing), which means the course.
assert.deepStrictEqual(widgetLoadedRequest({ mediaGroupId: 12, cmid: 0 }).args, {
    courseid: 12,
    cmid: 0,
});
assert.deepStrictEqual(widgetLoadedRequest({ mediaGroupId: 12, cmid: null }).args, {
    courseid: 12,
    cmid: 0,
});
assert.deepStrictEqual(widgetLoadedRequest({ mediaGroupId: 12 }).args, { courseid: 12, cmid: 0 });

// No course, no request.
assert.strictEqual(widgetLoadedRequest(undefined), undefined);
assert.strictEqual(widgetLoadedRequest({}), undefined);
assert.strictEqual(widgetLoadedRequest({ mediaGroupId: '' }), undefined);
assert.strictEqual(widgetLoadedRequest({ mediaGroupId: 'abc', cmid: 3 }), undefined);

console.log('widget-load: all assertions passed');

/*
 * Unit test for the widget position by page direction helpers in src/util.ts.
 *
 * Feature (ClickUp 4dwbhj): on right-to-left Moodle pages the navigation drawer is on the right,
 * where the widget opens by default. With the plugin setting on, the widget opens on the left
 * there, keeping the rest of its ux (a Kaltura uiConf may set some).
 *
 *   npm run test:direction
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html dir="rtl" lang="he"><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const source = fs.readFileSync(path.join(__dirname, '../src/util.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports); // eslint-disable-line no-new-func
const { widgetPositionForDirection, directionalUx, pageDirection } = mod.exports;

let failures = 0;
const test = (name, fn) => {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (err) {
        failures += 1;
        console.error(`not ok - ${name}\n  ${err.message}`);
    }
};

test('widgetPositionForDirection moves the widget left on rtl, keeping the vertical part', () => {
    assert.strictEqual(widgetPositionForDirection(undefined, 'rtl'), 'left');
    assert.strictEqual(widgetPositionForDirection('right', 'rtl'), 'left');
    assert.strictEqual(widgetPositionForDirection('right:top', 'rtl'), 'left:top');
    assert.strictEqual(widgetPositionForDirection('right:bottom', 'rtl'), 'left:bottom');
    assert.strictEqual(widgetPositionForDirection('left:top', 'rtl'), 'left:top');
});

test('widgetPositionForDirection keeps the position on ltr or unknown direction', () => {
    assert.strictEqual(widgetPositionForDirection(undefined, 'ltr'), undefined);
    assert.strictEqual(widgetPositionForDirection('right:top', 'ltr'), 'right:top');
    assert.strictEqual(widgetPositionForDirection('left', undefined), 'left');
    assert.strictEqual(widgetPositionForDirection('right', null), 'right');
});

test('widgetPositionForDirection is idempotent', () => {
    const once = widgetPositionForDirection('right:top', 'rtl');
    assert.strictEqual(widgetPositionForDirection(once, 'rtl'), once);
});

test('directionalUx keeps the other ux settings and is undefined when nothing changes', () => {
    const ux = { theme: 'dark', widget: { loadState: 'closed', position: 'right:top' } };
    assert.deepStrictEqual(directionalUx(ux, 'rtl'), {
        theme: 'dark',
        widget: { loadState: 'closed', position: 'left:top' },
    });
    assert.strictEqual(ux.widget.position, 'right:top');
    assert.deepStrictEqual(directionalUx(undefined, 'rtl'), { widget: { position: 'left' } });
    assert.strictEqual(directionalUx(ux, 'ltr'), undefined);
    assert.strictEqual(directionalUx({ widget: { position: 'left' } }, 'rtl'), undefined);
});

test('pageDirection reads <html dir> before the plugin param', () => {
    assert.strictEqual(pageDirection('ltr'), 'rtl');
    document.documentElement.removeAttribute('dir');
    assert.strictEqual(pageDirection('rtl'), 'rtl');
    assert.strictEqual(pageDirection(undefined), undefined);
});

if (failures) {
    console.error(`${failures} direction test(s) failed`);
    process.exit(1);
}
console.log('all direction tests passed');

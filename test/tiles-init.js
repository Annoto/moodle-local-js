/*
 * Unit test for the format_tiles integration in src/formats/tiles.ts.
 *
 * Regression: when format_tiles restores the last opened tile (from localStorage) before this
 * script initialises, the body already carries `format-tiles-tile-open`. No class change follows,
 * so the observer and the failsafe never ran player detection and the widget never loaded.
 *
 *   npm run test:tiles
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const PAGE = `<!doctype html><html><body class="format-tiles">
  <ul id="multi_section_tiles"><li class="section main" id="section-3">
    <iframe src="https://www.youtube.com/embed/OWeTQgzdhT4?rel=0"></iframe>
  </li></ul>
</body></html>`;

const transpile = (file) =>
    ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    }).outputText;

const load = (bodyClass) => {
    const dom = new JSDOM(PAGE, { url: 'https://moodle.example.com/course/view.php?id=1' });
    const { window } = dom;
    window.document.body.className = bodyClass;
    // Minimal jQuery stand in: only what tiles.ts calls.
    const wrap = (els) => ({
        length: els.length,
        get: (i) => els[i],
        hasClass: (c) => els.some((el) => el.classList.contains(c)),
        find: (sel) => wrap(els.flatMap((el) => [...el.querySelectorAll(sel)])),
    });
    const $ = (sel) => wrap([...window.document.querySelectorAll(sel)]);
    window.moodleAnnoto = { $ };
    global.window = window;
    global.document = window.document;
    global.MutationObserver = window.MutationObserver;

    const util = { exports: {} };
    new Function('module', 'exports', transpile('../src/util.ts'))(util, util.exports); // eslint-disable-line no-new-func
    const mod = { exports: {} };
    const req = (name) => {
        if (name === '../util') return util.exports;
        throw new Error(`unexpected require ${name}`);
    };
    new Function('module', 'exports', 'require', transpile('../src/formats/tiles.ts'))(
        mod,
        mod.exports,
        req
    ); // eslint-disable-line no-new-func

    const calls = { boot: [], destroy: 0, moveApp: [] };
    const main = {
        log: { info() {} },
        isWidgetLoaded: false,
        widgetPlayer: undefined,
        formatSelectors: {
            tiles: ['body.format-tiles', 'body.format-tiles #multi_section_tiles li.section.main'],
        },
        findPlayer: (container) => {
            const el = container && container.querySelector('iframe[src*="youtube.com"]');
            // jsdom has no layout, so fake a visible player
            return el ? { playerElement: { offsetParent: {} }, playerType: 'youtube' } : undefined;
        },
        bootWidget: async (container) => calls.boot.push(container),
        destroyWidget: async () => {
            calls.destroy += 1;
        },
        moveApp: (container) => calls.moveApp.push(container),
        moveAppBackHome() {},
    };
    return { Tiles: mod.exports.AnnotoMoodleTiles, main, calls, window };
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const test = async (name, fn) => {
    try {
        await fn();
        console.log(`ok - ${name}`);
    } catch (err) {
        failures += 1;
        console.error(`not ok - ${name}\n  ${err.message}`);
    }
};

(async () => {
    await test('boots the widget when a tile is already open at init (restored tile)', async () => {
        const { Tiles, main, calls, window } = load('format-tiles format-tiles-tile-open');
        Tiles.init(main);
        await wait(50);
        Tiles.destroy();
        const container = window.document.getElementById('multi_section_tiles');
        assert.strictEqual(calls.boot.length, 1, 'bootWidget should run once');
        assert.strictEqual(calls.boot[0], container, 'should boot inside the open tiles container');
        assert.strictEqual(calls.moveApp[0], container, 'app should move into the tiles container');
    });

    await test('does nothing at init when no tile is open', async () => {
        const { Tiles, main, calls } = load('format-tiles');
        Tiles.init(main);
        await wait(50);
        Tiles.destroy();
        assert.strictEqual(calls.boot.length, 0);
    });

    await test('still boots when a tile is opened after init (click path)', async () => {
        const { Tiles, main, calls, window } = load('format-tiles');
        Tiles.init(main);
        window.document.body.classList.add('format-tiles-tile-open');
        await wait(450); // observer is debounced by 300ms
        Tiles.destroy();
        assert.strictEqual(calls.boot.length, 1);
    });

    if (failures) {
        console.error(`${failures} failing`);
        process.exit(1);
    }
    console.log('all passed');
})();

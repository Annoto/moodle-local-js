/*
 * Unit test for the format_tiles integration in src/formats/tiles.ts.
 *
 * Regression: when format_tiles restores the last opened tile (from localStorage) before this
 * script initialises, the body already carries `format-tiles-tile-open`. No class change follows,
 * so the observer and the failsafe never ran player detection and the widget never loaded.
 *
 * Regression: with format_tiles JS navigation, tile content is loaded (and replaced) over AJAX
 * after the tile is marked open. Only class changes were observed, so a player added or replaced
 * later was never detected and the widget stayed on a removed element.
 *
 *   npm run test:tiles
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const VIDEO = '<iframe src="https://www.youtube.com/embed/OWeTQgzdhT4?rel=0"></iframe>';
const page = (content) => `<!doctype html><html><body class="format-tiles">
  <ul id="multi_section_tiles"><li class="section main" id="section-3">${content}</li></ul>
</body></html>`;

const transpile = (file) =>
    ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    }).outputText;

const load = (bodyClass, content = VIDEO) => {
    const dom = new JSDOM(page(content), {
        url: 'https://moodle.example.com/course/view.php?id=1',
    });
    const { window } = dom;
    window.document.body.className = bodyClass;
    // jsdom has no layout: treat any attached element as visible.
    Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
        get() {
            return this.isConnected ? this.parentElement : null;
        },
    });
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

    const calls = { boot: [], destroy: 0, moveApp: [], find: 0 };
    let nextId = 0;
    const main = {
        log: { info() {} },
        isWidgetLoaded: false,
        widgetPlayer: undefined,
        formatSelectors: {
            tiles: ['body.format-tiles', 'body.format-tiles #multi_section_tiles li.section.main'],
        },
        // Like the real findPlayer: first player in the container, tagged with an id.
        findPlayer: (container) => {
            calls.find += 1;
            const el = container && container.querySelector('iframe[src*="youtube.com"]');
            if (!el) return undefined;
            if (!el.id) {
                nextId += 1;
                el.id = `annoto_player_id_${nextId}`;
            }
            return { playerElement: el, playerId: el.id, playerType: 'youtube' };
        },
        // Set ready = false to emulate loadWidget dropping calls before Annoto is ready.
        ready: true,
        bootWidget: async (container) => {
            calls.boot.push(container);
            if (main.ready) main.widgetPlayer = main.findPlayer(container);
        },
        destroyWidget: async () => {
            calls.destroy += 1;
            main.widgetPlayer = undefined;
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

    await test('boots once when the video arrives after the tile is open (AJAX load)', async () => {
        const { Tiles, main, calls, window } = load('format-tiles format-tiles-tile-open', '');
        Tiles.init(main);
        await wait(50);
        assert.strictEqual(calls.boot.length, 0, 'nothing to boot on an empty tile');
        window.document.getElementById('section-3').innerHTML = VIDEO;
        await wait(450);
        Tiles.destroy();
        assert.strictEqual(calls.boot.length, 1, 'bootWidget should run once for the new video');
        assert.strictEqual(calls.boot[0], window.document.getElementById('multi_section_tiles'));
    });

    await test('unrelated DOM changes after boot do not run detection again', async () => {
        const { Tiles, main, calls, window } = load('format-tiles format-tiles-tile-open');
        Tiles.init(main);
        await wait(50);
        assert.strictEqual(calls.boot.length, 1);
        const finds = calls.find;
        const section = window.document.getElementById('section-3');
        section.appendChild(window.document.createElement('div'));
        section.appendChild(window.document.createElement('p'));
        await wait(450);
        Tiles.destroy();
        assert.strictEqual(calls.boot.length, 1, 'no second boot');
        assert.strictEqual(
            calls.find,
            finds,
            'findPlayer must not run while the player is in place'
        );
    });

    await test('reboots on the new player when tile content is replaced (AJAX refresh)', async () => {
        const { Tiles, main, calls, window } = load('format-tiles format-tiles-tile-open');
        Tiles.init(main);
        await wait(50);
        const first = main.widgetPlayer.playerElement;
        window.document.getElementById('section-3').innerHTML = VIDEO;
        await wait(450);
        Tiles.destroy();
        assert.strictEqual(calls.boot.length, 2, 'bootWidget should run again');
        assert.ok(main.widgetPlayer.playerElement.isConnected, 'widget on the attached player');
        assert.notStrictEqual(main.widgetPlayer.playerElement, first);
    });

    await test('destroys the widget when replaced content has no player', async () => {
        const { Tiles, main, calls, window } = load('format-tiles format-tiles-tile-open');
        Tiles.init(main);
        await wait(50);
        window.document.getElementById('section-3').innerHTML = '<p>no video</p>';
        await wait(450);
        Tiles.destroy();
        assert.strictEqual(calls.boot.length, 1);
        assert.strictEqual(calls.destroy, 1);
    });

    await test('failsafe recovers a replacement that landed before the widget was ready', async () => {
        const { Tiles, main, window } = load('format-tiles format-tiles-tile-open');
        Tiles.init(main);
        await wait(50);
        main.ready = false; // Annoto not ready: load requests are dropped
        window.document.getElementById('section-3').innerHTML = VIDEO;
        await wait(450);
        main.ready = true;
        await wait(1100); // failsafe runs every 1s
        Tiles.destroy();
        assert.ok(main.widgetPlayer.playerElement.isConnected, 'widget on the attached player');
    });

    await test('ignores tile content changes while no tile is open', async () => {
        const { Tiles, main, calls, window } = load('format-tiles', '');
        Tiles.init(main);
        window.document.getElementById('section-3').innerHTML = VIDEO;
        await wait(450);
        Tiles.destroy();
        assert.strictEqual(calls.boot.length, 0);
        assert.strictEqual(calls.find, 0);
    });

    await test('stops watching tile content after destroy()', async () => {
        const { Tiles, main, calls, window } = load('format-tiles format-tiles-tile-open', '');
        Tiles.init(main);
        await wait(50);
        Tiles.destroy();
        window.document.getElementById('section-3').innerHTML = VIDEO;
        await wait(450);
        assert.strictEqual(calls.boot.length, 0);
    });

    if (failures) {
        console.error(`${failures} failing`);
        process.exit(1);
    }
    console.log('all passed');
})();

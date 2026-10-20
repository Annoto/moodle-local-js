/*
 * Unit test for the format_grid section popup integration in src/formats/grid-popup.ts.
 *
 * Regression (TAU, format_grid 4.x): a section opens in a Bootstrap popup (#gridPopup, a carousel
 * of sections) that is position: fixed and scrolls its own body. The app stayed in #page-wrapper,
 * so the widget was drawn in page coordinates: off by the page scroll, left behind when the popup
 * body scrolled, and detached again after leaving fullscreen (which scrolls the page behind the
 * popup and resets the popup body scroll without a scroll event).
 *
 *   npm run test:grid
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const VIDEO = '<iframe src="https://www.youtube.com/embed/NE_cyskIGPI"></iframe>';
const page = ({ slide1 = '<p>text</p>', slide2 = VIDEO, onPage = '', bodyClass = 'format-grid' }) =>
    `<!doctype html><html><body class="${bodyClass}">
  <div id="page-wrapper">
    <div id="section-0">${onPage}</div>
    <div id="moodle-annoto-app-wrapper"><div id="annoto-app"></div></div>
  </div>
  <div class="modal fade" id="gridPopup"><div class="modal-dialog"><div class="modal-content">
    <div class="modal-body"><div id="gridPopupCarousel" class="carousel"><div class="carousel-inner">
      <div class="carousel-item active" id="gridpopupsection-1">${slide1}</div>
      <div class="carousel-item" id="gridpopupsection-2">${slide2}</div>
    </div></div></div>
  </div></div></div>
</body></html>`;

const transpile = (file) =>
    ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    }).outputText;

// jsdom has no layout: give an element a settable scrollTop and fixed sizes.
const fakeScroll = (el, { scrollHeight, clientHeight }) => {
    let top = 0;
    const writes = [];
    Object.defineProperty(el, 'scrollTop', {
        get: () => top,
        set: (v) => {
            top = v;
            writes.push(v);
        },
    });
    Object.defineProperty(el, 'scrollHeight', { get: () => scrollHeight });
    Object.defineProperty(el, 'clientHeight', { get: () => clientHeight });
    return writes;
};

const load = (opts = {}) => {
    const { window } = new JSDOM(page(opts), {
        url: 'https://moodle.example.com/course/view.php?id=1',
    });
    const { document } = window;
    // A box exists unless inside a closed popup or an inactive carousel slide.
    Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
        get() {
            if (!this.isConnected) return null;
            if (this.closest('.modal:not(.show)') || this.closest('.carousel-item:not(.active)')) {
                return null;
            }
            return this.parentElement;
        },
    });
    global.window = window;
    global.document = document;
    global.MutationObserver = window.MutationObserver;

    const util = { exports: {} };
    new Function('module', 'exports', 'require', transpile('../src/util.ts'))(
        util,
        util.exports,
        () => ({})
    ); // eslint-disable-line no-new-func
    const mod = { exports: {} };
    const req = (name) => {
        if (name === '../util') return util.exports;
        throw new Error(`unexpected require ${name}`);
    };
    new Function('module', 'exports', 'require', transpile('../src/formats/grid-popup.ts'))(
        mod,
        mod.exports,
        req
    ); // eslint-disable-line no-new-func

    const appEl = document.getElementById('moodle-annoto-app-wrapper');
    const home = document.getElementById('page-wrapper');
    const popup = document.getElementById('gridPopup');
    const scroller = popup.querySelector('.modal-body');
    fakeScroll(scroller, { scrollHeight: 1500, clientHeight: 700 });
    const appScrollWrites = fakeScroll(appEl, { scrollHeight: 0, clientHeight: 900 });

    const calls = { boot: [], destroy: 0, find: [] };
    let nextId = 0;
    const main = {
        log: { info() {} },
        appEl,
        playerScope: undefined,
        widgetPlayer: undefined,
        // Like the real findPlayer: players under the container (default: the scope, else the
        // page), preferring one on screen.
        findPlayer: (container) => {
            const parent = container || main.playerScope || document.body;
            calls.find.push(parent);
            const all = [...parent.querySelectorAll('iframe[src*="youtube.com"]')];
            const el = all.find((e) => e.offsetParent) || all[0];
            if (!el) return undefined;
            if (!el.id) {
                nextId += 1;
                el.id = `annoto_player_id_${nextId}`;
            }
            return { playerElement: el, playerId: el.id, playerType: 'youtube' };
        },
        bootWidget: async (container) => {
            calls.boot.push(container);
            main.widgetPlayer = main.findPlayer(container);
        },
        destroyWidget: async () => {
            calls.destroy += 1;
            main.widgetPlayer = undefined;
        },
        moveApp: (container) => container.appendChild(appEl),
        moveAppBackHome: () => home.appendChild(appEl),
    };
    const Grid = mod.exports.AnnotoMoodleGridPopup;
    const open = () => popup.classList.add('show');
    const close = () => popup.classList.remove('show');
    const showSlide = (id) => {
        popup.querySelector('.carousel-item.active').classList.remove('active');
        document.getElementById(id).classList.add('active');
    };
    return {
        Grid,
        main,
        calls,
        window,
        document,
        appEl,
        home,
        popup,
        scroller,
        appScrollWrites,
        open,
        close,
        showSlide,
    };
};

// observer debounce + popup settle delay
const SETTLED_MS = 1000;
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
    await test('does nothing on a page without the Grid popup', async () => {
        const t = load({ bodyClass: 'format-topics' });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        t.Grid.destroy();
        assert.strictEqual(t.appEl.parentElement, t.home, 'app stays home');
        assert.strictEqual(t.appEl.getAttribute('style'), null, 'app style untouched');
        assert.strictEqual(t.calls.boot.length, 0);
    });

    await test('mounts the app in the open popup and boots on the player of the active slide', async () => {
        const t = load({ slide1: VIDEO });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        assert.strictEqual(t.appEl.parentElement, t.popup, 'app moved into the popup');
        assert.strictEqual(t.main.playerScope, t.popup, 'player detection scoped to the popup');
        const { style } = t.appEl;
        assert.strictEqual(style.position, 'absolute');
        assert.strictEqual(style.overflow, 'hidden');
        assert.strictEqual(style.pointerEvents, 'none', 'wrapper lets clicks through');
        assert.strictEqual(
            t.document.getElementById('annoto-app').style.pointerEvents,
            'auto',
            'widget stays clickable'
        );
        assert.strictEqual(style.transform, '', 'no transform: it would move fixed tooltips');
        const slide = t.document.getElementById('gridpopupsection-1');
        assert.strictEqual(t.calls.boot.at(-1), slide, 'boots in the active slide');
        assert.ok(slide.contains(t.main.widgetPlayer.playerElement));
        t.Grid.destroy();
    });

    await test('follows the popup body scroll', async () => {
        const t = load({ slide1: VIDEO });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        t.scroller.scrollTop = 120;
        t.scroller.dispatchEvent(new t.window.Event('scroll'));
        assert.strictEqual(t.appEl.scrollTop, 120, 'app scrolled with the popup body');
        const spacer = t.appEl.lastElementChild;
        // the app can scroll as far as the popup body: 1500 - 700 + 900
        assert.strictEqual(spacer.style.height, '1700px');
        t.Grid.destroy();
    });

    await test('resyncs after leaving fullscreen without a scroll event', async () => {
        const t = load({ slide1: VIDEO });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        t.scroller.scrollTop = 41;
        t.scroller.dispatchEvent(new t.window.Event('scroll'));
        t.scroller.scrollTop = 0; // fullscreen exit resets it silently
        t.document.dispatchEvent(new t.window.Event('fullscreenchange'));
        await wait(400);
        assert.strictEqual(t.appEl.scrollTop, 0);
        t.Grid.destroy();
    });

    await test('resyncs on window resize', async () => {
        const t = load({ slide1: VIDEO });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        t.scroller.scrollTop = 33;
        t.window.dispatchEvent(new t.window.Event('resize'));
        await wait(400);
        assert.strictEqual(t.appEl.scrollTop, 33);
        t.Grid.destroy();
    });

    await test('restores the app when the popup closes', async () => {
        const t = load({ slide1: VIDEO });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        t.scroller.scrollTop = 50;
        t.scroller.dispatchEvent(new t.window.Event('scroll'));
        t.close();
        await wait(SETTLED_MS);
        assert.strictEqual(t.appEl.parentElement, t.home, 'app back in #page-wrapper');
        assert.strictEqual(t.main.playerScope, undefined, 'scope cleared');
        assert.strictEqual(t.appEl.getAttribute('style') || '', '', 'mount styles removed');
        assert.strictEqual(t.document.getElementById('annoto-app').style.pointerEvents, '');
        assert.strictEqual(t.appEl.children.length, 1, 'spacer removed');
        assert.strictEqual(t.appEl.scrollTop, 0);
        const writes = t.appScrollWrites.length;
        t.scroller.scrollTop = 80;
        t.scroller.dispatchEvent(new t.window.Event('scroll'));
        t.window.dispatchEvent(new t.window.Event('resize'));
        await wait(400);
        assert.strictEqual(t.appScrollWrites.length, writes, 'no syncing after close');
        t.Grid.destroy();
    });

    await test('moves the widget to the player of a newly shown slide', async () => {
        const t = load({});
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        assert.strictEqual(t.calls.boot.length, 0, 'no player on the first slide');
        t.showSlide('gridpopupsection-2');
        await wait(SETTLED_MS);
        const slide = t.document.getElementById('gridpopupsection-2');
        assert.strictEqual(t.calls.boot.at(-1), slide);
        assert.ok(slide.contains(t.main.widgetPlayer.playerElement));
        t.Grid.destroy();
    });

    await test('hands the widget back to a page player when the popup closes', async () => {
        const t = load({ onPage: VIDEO });
        t.main.widgetPlayer = t.main.findPlayer(t.document.getElementById('section-0'));
        t.Grid.init(t.main);
        t.open(); // first slide has no video
        await wait(SETTLED_MS);
        assert.strictEqual(t.calls.destroy, 1, 'page widget must not float over the popup');
        t.close();
        await wait(SETTLED_MS);
        assert.ok(
            t.document.getElementById('section-0').contains(t.main.widgetPlayer.playerElement),
            'widget back on the page player'
        );
        t.Grid.destroy();
    });

    await test('ignores class changes inside the mounted widget', async () => {
        const t = load({ slide1: VIDEO });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        const finds = t.calls.find.length;
        const el = t.document.createElement('div');
        t.document.getElementById('annoto-app').appendChild(el);
        el.className = 'nn-is-open';
        el.className = 'nn-is-closed';
        await wait(SETTLED_MS);
        assert.strictEqual(t.calls.find.length, finds, 'no player detection for widget changes');
        t.Grid.destroy();
    });

    await test('handles a popup that is already open at init', async () => {
        const t = load({ slide1: VIDEO });
        t.open();
        t.Grid.init(t.main);
        await wait(SETTLED_MS);
        assert.strictEqual(t.appEl.parentElement, t.popup);
        assert.strictEqual(t.calls.boot.length, 1);
        t.Grid.destroy();
    });

    await test('destroy() puts the app back home', async () => {
        const t = load({ slide1: VIDEO });
        t.Grid.init(t.main);
        t.open();
        await wait(SETTLED_MS);
        t.Grid.destroy();
        assert.strictEqual(t.appEl.parentElement, t.home);
        assert.strictEqual(t.main.playerScope, undefined);
        t.close();
        await wait(SETTLED_MS);
        assert.strictEqual(t.calls.boot.length, 1, 'no reaction after destroy');
    });

    if (failures) {
        console.error(`${failures} failing`);
        process.exit(1);
    }
    console.log('all passed');
})();

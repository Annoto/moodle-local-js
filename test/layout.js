/*
 * Unit test for the page-layout helpers in src/util.ts that place the widget.
 *
 * Regression (Gordon, Boost Union): the theme scrolls inside #page-wrapper, not the window. The
 * widget is drawn in page layout coordinates inside an absolute #annoto-app whose containing block
 * was the viewport, so it stayed put while the player scrolled away. findPageScroller finds that
 * scroller so it can be made the widget's containing block.
 *
 * Regression (TAU, format_grid 4.x): the only player is inside the closed Grid section popup
 * (display: none). The widget attached to it anyway and was drawn at the page origin. isRendered
 * tells a hidden player apart, and pickPlayer prefers a player that is on screen.
 *
 *   npm run test:layout
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const transpile = (file) =>
    ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    }).outputText;

const util = { exports: {} };
new Function('module', 'exports', 'require', transpile('../src/util.ts'))(
    util,
    util.exports,
    () => ({})
); // eslint-disable-line no-new-func
const { isRendered, findPageScroller, pickPlayer } = util.exports;

const page = (html) => {
    const { window } = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
    const { document } = window;
    // jsdom has no layout: a box exists unless the element or an ancestor is display: none, and
    // scroll sizes come from data attributes.
    Object.defineProperty(window.Element.prototype, 'getClientRects', {
        value() {
            for (let node = this; node; node = node.parentElement) {
                if (window.getComputedStyle(node).display === 'none') {
                    return [];
                }
            }
            return [{}];
        },
    });
    ['scrollHeight', 'clientHeight'].forEach((prop) => {
        Object.defineProperty(window.HTMLElement.prototype, prop, {
            get() {
                return Number(this.dataset[prop] || 0);
            },
        });
    });
    return document;
};

const tests = {
    'isRendered: visible element'() {
        const doc = page('<div id="p"></div>');
        assert.strictEqual(isRendered(doc.getElementById('p')), true);
    },
    'isRendered: under a display none ancestor (closed Grid popup)'() {
        const doc = page('<div style="display:none"><div><div id="p"></div></div></div>');
        assert.strictEqual(isRendered(doc.getElementById('p')), false);
    },
    'isRendered: detached, null and undefined'() {
        const doc = page('');
        assert.strictEqual(isRendered(doc.createElement('div')), false);
        assert.strictEqual(isRendered(null), false);
        assert.strictEqual(isRendered(undefined), false);
    },
    'findPageScroller: Boost Union scrolls #page-wrapper'() {
        const doc = page(`
            <div id="page-wrapper" style="overflow-y:auto" data-scroll-height="4455" data-client-height="962">
              <div id="page" style="overflow-y:auto" data-scroll-height="4274" data-client-height="4274">
                <div class="no-overflow" style="overflow:auto" data-scroll-height="797" data-client-height="797">
                  <div id="p"></div>
                </div>
              </div>
            </div>`);
        assert.strictEqual(findPageScroller(doc.getElementById('p')).id, 'page-wrapper');
    },
    'findPageScroller: the outermost scroller wins over an inner scrolling box'() {
        const doc = page(`
            <div id="page" style="overflow-y:auto" data-scroll-height="3000" data-client-height="900">
              <div id="inner" style="overflow-y:scroll" data-scroll-height="600" data-client-height="300">
                <div id="p"></div>
              </div>
            </div>`);
        assert.strictEqual(findPageScroller(doc.getElementById('p')).id, 'page');
    },
    'findPageScroller: window scrolling (standard Boost, Classic) finds nothing'() {
        const doc = page(`
            <div id="page-wrapper"><div id="page" style="position:relative">
              <div class="no-overflow" style="overflow:auto" data-scroll-height="500" data-client-height="500">
                <div id="p"></div>
              </div>
            </div></div>`);
        assert.strictEqual(findPageScroller(doc.getElementById('p')), null);
    },
    'findPageScroller: a player inside a fixed modal is left alone'() {
        const doc = page(`
            <div id="page-wrapper" style="overflow-y:auto" data-scroll-height="4000" data-client-height="900">
              <div class="modal" style="position:fixed;overflow-y:auto" data-scroll-height="2000" data-client-height="900">
                <div id="p"></div>
              </div>
            </div>`);
        assert.strictEqual(findPageScroller(doc.getElementById('p')), null);
    },
    'findPageScroller: html and body are not candidates'() {
        const doc = page('<div id="p"></div>');
        doc.body.style.overflowY = 'auto';
        doc.body.dataset.scrollHeight = '3000';
        doc.body.dataset.clientHeight = '900';
        assert.strictEqual(findPageScroller(doc.getElementById('p')), null);
    },
    'pickPlayer: keeps type priority when every player is on screen'() {
        const doc = page('<div id="vjs"></div><iframe id="yt"></iframe>');
        const picked = pickPlayer([
            { type: 'videojs', elements: [doc.getElementById('vjs')] },
            { type: 'youtube', elements: [doc.getElementById('yt')] },
        ]);
        assert.deepStrictEqual([picked.type, picked.element.id], ['videojs', 'vjs']);
    },
    'pickPlayer: prefers a rendered player over a hidden one of a higher priority type'() {
        const doc = page(
            '<div style="display:none"><div id="vjs"></div></div><iframe id="yt"></iframe>'
        );
        const picked = pickPlayer([
            { type: 'videojs', elements: [doc.getElementById('vjs')] },
            { type: 'youtube', elements: [doc.getElementById('yt')] },
        ]);
        assert.deepStrictEqual([picked.type, picked.element.id], ['youtube', 'yt']);
    },
    'pickPlayer: prefers the rendered one among players of a type (open topcoll section)'() {
        const doc = page('<div style="display:none"><div id="a"></div></div><div id="b"></div>');
        const picked = pickPlayer([
            { type: 'videojs', elements: [doc.getElementById('a'), doc.getElementById('b')] },
        ]);
        assert.strictEqual(picked.element.id, 'b');
    },
    'pickPlayer: falls back to the first hidden player so the widget can still boot'() {
        const doc = page(
            '<div style="display:none"><div id="a"></div><iframe id="yt"></iframe></div>'
        );
        const picked = pickPlayer([
            { type: 'videojs', elements: [doc.getElementById('a')] },
            { type: 'youtube', elements: [doc.getElementById('yt')] },
        ]);
        assert.deepStrictEqual([picked.type, picked.element.id], ['videojs', 'a']);
    },
    'pickPlayer: no players'() {
        assert.strictEqual(pickPlayer([{ type: 'videojs', elements: [] }]), undefined);
        assert.strictEqual(pickPlayer([]), undefined);
    },
};

let failed = 0;
Object.entries(tests).forEach(([name, run]) => {
    try {
        run();
        console.log(`ok - ${name}`);
    } catch (err) {
        failed += 1;
        console.log(`not ok - ${name}\n  ${err.message}`);
    }
});
if (failed) {
    console.log(`${failed} failed`);
    process.exit(1);
}
console.log('all passed');

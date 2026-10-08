/*
 * Unit test for the Zoodle (zoodle.macam.ac.il) iframe -> native <video> swap in
 * src/players/zoodle.ts.
 *
 *   npm run test:zoodle
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const MOODLE_URL = 'https://moodle4.qsm.ac.il/mod/page/view.php?id=392341';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: MOODLE_URL });
global.window = dom.window;
global.document = dom.window.document;
global.URL = dom.window.URL;

const source = fs.readFileSync(path.join(__dirname, '../src/players/zoodle.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports); // eslint-disable-line no-new-func
const { parseZoodleSrc, replaceZoodleIframes, ZOODLE_IFRAME_SELECTOR } = mod.exports;
const iframesIn = (root) => root.querySelectorAll(ZOODLE_IFRAME_SELECTOR);

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

test('parses the real embed url (double slash, as Zoodle emits it)', () => {
    const media = parseZoodleSrc('https://zoodle.macam.ac.il//qsm/media/oN0AsNdhRu11Nov04');
    assert.deepStrictEqual(
        { ...media },
        {
            origin: 'https://zoodle.macam.ac.il',
            institution: 'qsm',
            mediaId: 'oN0AsNdhRu11Nov04',
            videoSrc: 'https://zoodle.macam.ac.il/qsm/files/oN0AsNdhRu11Nov04.mp4',
            posterSrc: 'https://zoodle.macam.ac.il/qsm/files/frames/oN0AsNdhRu11Nov04.jpg',
        }
    );
});

test('parses single slash, trailing slash and query string', () => {
    assert.strictEqual(
        parseZoodleSrc('https://zoodle.macam.ac.il/abc/media/X1-y_2/?t=1').videoSrc,
        'https://zoodle.macam.ac.il/abc/files/X1-y_2.mp4'
    );
});

test('rejects non Zoodle hosts, look-alike hosts, http and other paths', () => {
    [
        undefined,
        '',
        'not a url',
        'https://www.youtube.com/embed/abc',
        'https://zoodle.macam.ac.il.evil.com/qsm/media/abc',
        'https://evilzoodle.macam.ac.il/qsm/media/abc',
        'http://zoodle.macam.ac.il/qsm/media/abc',
        'https://zoodle.macam.ac.il/qsm/files/abc.mp4',
        'https://zoodle.macam.ac.il/qsm/media/abc/extra',
    ].forEach((src) => assert.strictEqual(parseZoodleSrc(src), undefined, String(src)));
});

test('replaces the iframe with a native video keeping its width', () => {
    document.body.innerHTML = `
        <div class="no-overflow">
            <iframe id="z1" src="https://zoodle.macam.ac.il//qsm/media/oN0AsNdhRu11Nov04"
                width="640" height="360" style="width: 100%; height: 450px;" allowfullscreen></iframe>
            <iframe src="https://www.youtube.com/embed/abc"></iframe>
        </div>`;
    const replaced = replaceZoodleIframes(document.querySelectorAll('iframe'));
    assert.strictEqual(replaced, 1);
    assert.strictEqual(document.querySelectorAll('iframe').length, 1, 'youtube iframe untouched');
    const video = document.querySelector('.no-overflow > video');
    assert.ok(video, 'video inserted in place of the iframe');
    assert.strictEqual(video.id, 'z1');
    assert.strictEqual(video.getAttribute('width'), '640');
    assert.strictEqual(video.style.width, '100%');
    assert.strictEqual(video.getAttribute('height'), null, 'iframe height is not copied');
    assert.strictEqual(video.style.height, 'auto');
    assert.strictEqual(video.controls, true);
    assert.strictEqual(video.getAttribute('controlslist'), 'nodownload');
    assert.strictEqual(video.getAttribute('data-annoto-zoodle'), 'oN0AsNdhRu11Nov04');
    assert.strictEqual(
        video.querySelector('source').getAttribute('src'),
        'https://zoodle.macam.ac.il/qsm/files/oN0AsNdhRu11Nov04.mp4'
    );
});

test('drops the iframe crop styles so the video and widget match the visible frame', () => {
    document.body.innerHTML = `
        <div class="no-overflow">
            <iframe src="https://zoodle.macam.ac.il//qsm/media/oN0AsNdhRu11Nov04"
                style="position:relative; top:-205px; width:100%; height:900px; border:none;"></iframe>
        </div>`;
    replaceZoodleIframes(document.querySelectorAll('iframe'));
    const video = document.querySelector('.no-overflow > video');
    assert.strictEqual(video.style.top, '', 'negative top removed');
    assert.strictEqual(video.style.position, '', 'relative offset removed');
    assert.strictEqual(video.style.height, 'auto');
    assert.strictEqual(video.style.width, '100%', 'author width kept');
    assert.strictEqual(video.style.maxWidth, '100%');
});

test('is idempotent and scoped to the container', () => {
    document.body.innerHTML = `
        <section id="a"><iframe src="https://zoodle.macam.ac.il/qsm/media/A1"></iframe></section>
        <section id="b"><iframe src="https://zoodle.macam.ac.il/qsm/media/B1"></iframe></section>`;
    assert.strictEqual(replaceZoodleIframes(iframesIn(document.getElementById('a'))), 1);
    assert.strictEqual(replaceZoodleIframes(iframesIn(document.getElementById('a'))), 0);
    assert.ok(document.querySelector('#b iframe'), 'other container untouched');
    assert.strictEqual(replaceZoodleIframes(iframesIn(document.body)), 1);
    assert.strictEqual(document.querySelectorAll('video').length, 2);
});

test('takes any array-like of iframes and skips non Zoodle ones (no DOM lookups of its own)', () => {
    document.body.innerHTML = `
        <iframe src="https://www.youtube.com/embed/abc"></iframe>
        <iframe src="https://zoodle.macam.ac.il/qsm/media/Z9"></iframe>`;
    assert.strictEqual(replaceZoodleIframes([]), 0);
    assert.strictEqual(replaceZoodleIframes(Array.from(document.querySelectorAll('iframe'))), 1);
    assert.strictEqual(document.querySelector('iframe').getAttribute('src'), 'https://www.youtube.com/embed/abc');
    assert.ok(document.querySelector('video[data-annoto-zoodle="Z9"]'));
});

test('selector is a loose pre-filter only; the parser is the real gate', () => {
    document.body.innerHTML = `<iframe src="https://evilzoodle.macam.ac.il/qsm/media/abc"></iframe>`;
    assert.strictEqual(iframesIn(document.body).length, 1, 'matched by the loose selector');
    assert.strictEqual(replaceZoodleIframes(iframesIn(document.body)), 0, 'but rejected by the parser');
});

if (failures) {
    console.error(`${failures} test(s) failed`);
    process.exit(1);
}
console.log('all zoodle tests passed');

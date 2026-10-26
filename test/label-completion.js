/*
 * Unit test for the course page (label) activity completion helpers in src/util.ts.
 *
 * Regression (Annoto/moodle-local_annoto#189): a label has no page of its own, so on the course
 * page the bundle had no cmid, rendered no completion indicator and never reported my_activity.
 * The plugin now sends cmCompletions; these helpers bind a player to its label and render the
 * indicator inside that label.
 *
 *   npm run test:label-completion
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const VIDEO = '<iframe src="https://www.youtube.com/embed/OWeTQgzdhT4?rel=0"></iframe>';
const label = (cmid, content = VIDEO) => `
  <li class="activity activity-wrapper label modtype_label" id="module-${cmid}" data-for="cmitem" data-id="${cmid}">
    <div class="activity-item"><div class="activity-grid">
      <div class="activity-completion"><div data-region="activity-information" class="activity-information">
        <div data-region="completion-info"></div>
      </div></div>
      <div class="activity-altcontent"><div class="no-overflow">${content}</div></div>
    </div></div>
  </li>`;
const dom = new JSDOM(
    `<!doctype html><html><body><ul class="section">
        ${label(101)}
        ${label(102)}
        <li class="activity modtype_page" id="module-103"><a href="#">page</a></li>
    </ul><div id="outside">${VIDEO}</div></body></html>`,
    { url: 'https://moodle.example.com/course/view.php?id=1' }
);
global.window = dom.window;
global.document = dom.window.document;

const source = fs.readFileSync(path.join(__dirname, '../src/util.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports); // eslint-disable-line no-new-func
const { findCmId, cmCompletionInfoEl, isActivityCompletionMet, parseUserActivity } = mod.exports;

const req = (overrides = {}) => ({
    id: '1',
    courseid: '1',
    cmid: '101',
    enabled: '9',
    totalview: '80',
    comments: '1',
    replies: '0',
    usermodified: '2',
    timecreated: '0',
    timemodified: '0',
    ...overrides,
});
const activity = (completion, comments, replies = 0) => ({ completion, comments, replies });

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

test('findCmId resolves the label a player is rendered in', () => {
    const players = document.querySelectorAll('li.activity iframe');
    assert.strictEqual(findCmId(players[0]), '101');
    assert.strictEqual(findCmId(players[1]), '102');
});

test('findCmId is undefined outside a course module and for no element', () => {
    assert.strictEqual(findCmId(document.querySelector('#outside iframe')), undefined);
    assert.strictEqual(findCmId(undefined), undefined);
    assert.strictEqual(findCmId(null), undefined);
});

test('cmCompletionInfoEl finds the completion area of that label only', () => {
    const el = cmCompletionInfoEl('102');
    assert.ok(el);
    assert.strictEqual(el.closest('li.activity').id, 'module-102');
    assert.strictEqual(cmCompletionInfoEl('103'), null);
    assert.strictEqual(cmCompletionInfoEl('999'), null);
});

test('isActivityCompletionMet requires every requirement', () => {
    assert.strictEqual(isActivityCompletionMet(req(), undefined), false);
    assert.strictEqual(isActivityCompletionMet(req(), activity(79, 1)), false);
    assert.strictEqual(isActivityCompletionMet(req(), activity(80, 0)), false);
    assert.strictEqual(isActivityCompletionMet(req(), activity(80, 1)), true);
    assert.strictEqual(isActivityCompletionMet(req({ replies: '2' }), activity(100, 5, 1)), false);
    assert.strictEqual(isActivityCompletionMet(req({ replies: '2' }), activity(100, 5, 2)), true);
});

test('isActivityCompletionMet treats empty requirements as met once activity is reported', () => {
    const empty = req({ totalview: '0', comments: '0', replies: '0' });
    assert.strictEqual(isActivityCompletionMet(empty, activity(0, 0)), true);
    assert.strictEqual(isActivityCompletionMet(empty, undefined), false);
});

test('parseUserActivity reads the saved progress and tolerates missing or bad data', () => {
    const errors = [];
    const logger = { error: (msg) => errors.push(msg) };
    const data = '{"completion":50,"comments":1,"replies":0}';
    assert.deepStrictEqual(
        parseUserActivity(req({ user_data: { data } }), logger),
        activity(50, 1)
    );
    assert.strictEqual(parseUserActivity(req(), logger), undefined);
    assert.strictEqual(parseUserActivity(undefined, logger), undefined);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(parseUserActivity(req({ user_data: { data: '{bad' } }), logger), undefined);
    assert.strictEqual(errors.length, 1);
});

if (failures) {
    console.error(`${failures} label completion test(s) failed`);
    process.exit(1);
}
console.log('all label completion tests passed');

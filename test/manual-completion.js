/*
 * Unit test for the manual completion ("Mark as done") helpers in src/util.ts.
 *
 * Regression (MDA, University of Padova): an activity with Annoto completion is stored with
 * completion tracking 9, which Moodle's completion templates treat as manual, so they render a
 * "Mark as done" button whose click fails. The bundle hides it and shows the Annoto conditions in
 * its place, also where the course format renders the button outside of a completion area.
 *
 *   npm run test:manual-completion
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const button = (cmid) =>
    `<button class="btn btn-sm btn-outline-secondary" data-action="toggle-manual-completion" data-toggletype="manual:mark-done" data-cmid="${cmid}">Mark as done</button>`;
const dom = new JSDOM(
    `<!doctype html><html><body><ul class="section">
        <li class="activity modtype_page" id="module-201">
          <div data-region="activity-information" class="activity-information">
            <div data-region="completion-info">${button(201)}</div>
          </div>
        </li>
        <li class="activity modtype_oublog" id="module-202">
          <div class="activity-completion">${button(202)}</div>
        </li>
        <li class="activity modtype_page" id="module-203">
          <div class="activity-completion">${button(203)}</div>
        </li>
        <li class="activity modtype_page" id="module-204"><a href="#">no completion</a></li>
    </ul></body></html>`,
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
const { manualCompletionButtons, hideManualCompletionButtons, ensureCmCompletionInfoEl } =
    mod.exports;

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

test('manualCompletionButtons finds the buttons of that course module only', () => {
    assert.strictEqual(manualCompletionButtons('202').length, 1);
    assert.strictEqual(manualCompletionButtons('202')[0].closest('li').id, 'module-202');
    assert.strictEqual(manualCompletionButtons('204').length, 0);
});

test('hideManualCompletionButtons hides and disables them, leaving other modules alone', () => {
    assert.strictEqual(hideManualCompletionButtons('203'), 1);
    const [hidden] = manualCompletionButtons('203');
    assert.strictEqual(hidden.style.getPropertyValue('display'), 'none');
    assert.strictEqual(hidden.style.getPropertyPriority('display'), 'important');
    assert.strictEqual(hidden.getAttribute('aria-hidden'), 'true');
    assert.ok(hidden.hasAttribute('disabled'));
    const [other] = manualCompletionButtons('202');
    assert.strictEqual(other.style.display, '');
    assert.strictEqual(hideManualCompletionButtons('999'), 0);
});

test('ensureCmCompletionInfoEl returns the existing completion area', () => {
    const el = ensureCmCompletionInfoEl('201');
    assert.ok(el);
    assert.strictEqual(el.parentElement.className, 'activity-information');
    assert.strictEqual(
        document.querySelectorAll('#module-201 [data-region="completion-info"]').length,
        1
    );
});

test('ensureCmCompletionInfoEl creates an area next to a button rendered outside of one', () => {
    const el = ensureCmCompletionInfoEl('202');
    assert.ok(el);
    assert.strictEqual(el.getAttribute('data-region'), 'completion-info');
    assert.strictEqual(el.nextElementSibling, manualCompletionButtons('202')[0]);
    // A second pass finds the area it created instead of adding another.
    assert.strictEqual(ensureCmCompletionInfoEl('202'), el);
    assert.strictEqual(
        document.querySelectorAll('#module-202 [data-region="completion-info"]').length,
        1
    );
});

test('ensureCmCompletionInfoEl is null with neither an area nor a button', () => {
    assert.strictEqual(ensureCmCompletionInfoEl('204'), null);
    assert.strictEqual(ensureCmCompletionInfoEl('999'), null);
});

if (failures) {
    console.error(`${failures} manual completion test(s) failed`);
    process.exit(1);
}
console.log('all manual completion tests passed');

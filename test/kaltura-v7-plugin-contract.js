/*
 * Contract test for the Kaltura V7 (playkit) integration.
 *
 * The V7 path in src/main.ts reaches into the Annoto playkit plugin to guarantee the course group
 * is applied (`seedKalturaV7Config` / `recoverKalturaV7Config`). Those touch plugin internals -
 * `service.plugin`, `plugin.widgetConfig`, `plugin.mergeConfigUpdate`, `plugin.isWidgetBooted` - so
 * a plugin release that renames any of them would silently stop scoping activity to the course.
 * This test loads the REAL published plugin bundle and asserts the contract still holds.
 *
 *   npm run test:kaltura-v7
 *   PLUGIN_BUNDLE=/path/to/plugin.js npm run test:kaltura-v7    # offline, against a local copy
 *   PLUGIN_URL=https://cdn.annoto.net/playkit-plugin/<ver>/plugin.js npm run test:kaltura-v7
 *
 * It stubs only what the plugin consumes from the player library: KalturaPlayer.BasePlugin (a
 * plain ES5 function - the bundle is downleveled and calls its super as `Base.call(this, ...)`),
 * core.utils.Dom, core.utils.Object.mergeDeep (transcribed verbatim from @playkit-js/playkit-js),
 * ui.preact, and a bare global `Annoto`.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_PLUGIN_URL = 'https://cdn.annoto.net/playkit-plugin/latest/plugin.js';
const CACHE = path.join(os.tmpdir(), 'annoto-playkit-plugin-cache.js');

let JSDOM;
try {
    ({ JSDOM } = require('jsdom'));
} catch (err) {
    console.error('SKIP: jsdom is not installed (npm install), cannot run the contract test.');
    process.exit(0);
}

async function loadPluginSource() {
    if (process.env.PLUGIN_BUNDLE) {
        return {
            source: fs.readFileSync(process.env.PLUGIN_BUNDLE, 'utf8'),
            from: process.env.PLUGIN_BUNDLE,
        };
    }
    const url = process.env.PLUGIN_URL || DEFAULT_PLUGIN_URL;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const source = await res.text();
        fs.writeFileSync(CACHE, source);
        return { source, from: url };
    } catch (err) {
        if (fs.existsSync(CACHE)) {
            console.warn(`WARN: could not fetch ${url} (${err.message}), using cached copy.`);
            return { source: fs.readFileSync(CACHE, 'utf8'), from: `${CACHE} (cached)` };
        }
        console.error(`SKIP: could not fetch ${url} (${err.message}) and no cached copy.`);
        process.exit(0);
    }
}

/*
 * Object.mergeDeep from @playkit-js/playkit-js, transcribed. The isClassInstance guard is the part
 * that matters here: class instances (the plugin's player adaptor) and DOM elements are assigned
 * by reference and never recursed into, which is why merging a config carrying
 * widgets[0].player.adaptorApi terminates at all.
 */
const KUtils = {
    isObject(e) {
        return !!e && typeof e === 'object' && !Array.isArray(e);
    },
    isClassInstance(e) {
        return !!(e && e.constructor && e.constructor.name && e.constructor.name !== 'Object');
    },
    mergeDeep(target, ...sources) {
        if (!sources.length) {
            return target;
        }
        const source = sources.shift();
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key]) && !this.isClassInstance(source[key])) {
                    if (!target[key]) {
                        Object.assign(target, { [key]: {} });
                    }
                    this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        return this.mergeDeep(target, ...sources);
    },
};

// ---- the three src/main.ts code paths under test, transcribed ---------------------------------

// AnnotoMoodle.seedKalturaV7Config()
function seed(service, override) {
    const plugin = service && service.plugin;
    if (!plugin || typeof plugin.mergeConfigUpdate !== 'function') {
        return { seeded: false, reason: 'cannot seed - no plugin/mergeConfigUpdate' };
    }
    if (plugin.isWidgetBooted) {
        return { seeded: false, reason: 'already booted, seeding too late' };
    }
    plugin.widgetConfig = plugin.mergeConfigUpdate(override);
    return { seeded: true };
}

// AnnotoMoodle.recoverKalturaV7Config()
function recover(service, override) {
    const live = service && service.plugin && service.plugin.widgetConfig;
    if (!live || !Array.isArray(live.widgets) || live.widgets.length === 0) {
        return undefined;
    }
    return { ...live, ...override };
}

// AnnotoMoodle.finalizeKalturaV7Player(): load, then auth - and fail closed with no config.
async function finalize(service, entryConfig, override, userToken) {
    const api = await service.getApi();
    if (!api) {
        return { authed: false, reason: 'no api' };
    }
    const config = entryConfig || recover(service, override);
    if (!config || typeof api.load !== 'function') {
        return { authed: false, reason: 'course group not applied - skipped auth (fail closed)' };
    }
    try {
        await api.load(config);
    } catch (err) {
        return { authed: false, reason: 'load rejected - skipped auth (fail closed)' };
    }
    await api.auth(userToken);
    return { authed: true };
}

// ---- harness -----------------------------------------------------------------------------------

const UICONF_PLUGIN_CONFIG = {
    // What the Annoto Kaltura configurator writes into the uiConf, plus manualBoot:false so the
    // plugin auto-boots the widget as it does on a live page.
    clientId: 'UICONF-CLIENT-ID',
    manualBoot: false,
    bootstrapUrl: 'https://cdn.annoto.net/widget/latest/bootstrap.js',
};

const CONFIG_OVERRIDE = {
    // AnnotoMoodle.configOverride
    clientId: 'MOODLE-CLIENT-ID',
    backend: { domain: 'eu.annoto.net' },
    hooks: { getPageUrl: () => 'x', ssoAuthRequestHandle: () => {}, mediaDetails: () => ({}) },
    group: { id: '42', title: 'Functional Neuroanatomy', description: 'course summary' },
    ssoToken: 'MOODLE-SSO-JWT',
    locale: 'en',
};

function buildEnv(pluginSource) {
    const dom = new JSDOM(
        `<!doctype html><html><body>
            <div class="kaltura-player-container"><div id="kaltura_player_1"></div></div>
         </body></html>`,
        { url: 'https://moodle.example.org/mod/lesson/view.php?id=1' }
    );
    global.window = dom.window;
    global.document = dom.window.document;
    global.self = dom.window;
    global.navigator = dom.window.navigator;
    global.MutationObserver = dom.window.MutationObserver;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;

    const calls = { boot: [], load: [], auth: [] };
    const widgetApi = {
        load: (config) => {
            calls.load.push(config);
            return Promise.resolve();
        },
        auth: (token) => {
            calls.auth.push(token);
            return Promise.resolve();
        },
    };
    // bootWidget() references a BARE global `Annoto` - which is exactly why the widget bootstrap
    // has to end up assigning window.Annoto (the require() wrap in the plugin's initkaltura.js).
    global.Annoto = dom.window.Annoto = {
        boot: (config) => calls.boot.push(config),
        on: (evt, cb) => {
            // Registered right after Annoto.boot(); firing it resolves the plugin's awaitBoot and
            // therefore service.getApi().
            if (evt === 'ready') {
                setTimeout(() => cb(widgetApi), 0);
            }
        },
    };

    function BasePlugin(name, player, config) {
        this.name = name;
        this.player = player;
        this.config = config;
        this.logger = { info() {}, debug() {}, warn() {}, error() {} };
    }
    BasePlugin.prototype.getName = function () {
        return this.name;
    };
    BasePlugin.prototype.dispatchEvent = function (type, payload) {
        this.player.dispatchEvent(type, payload);
    };
    BasePlugin.prototype.updateConfig = function (config) {
        Object.assign(this.config, config);
    };

    const registered = {};
    const KalturaPlayer = {
        BasePlugin,
        core: {
            registerPlugin: (name, cls) => {
                registered[name] = cls;
            },
            utils: {
                Dom: {
                    createElement: (tag) => document.createElement(tag),
                    setAttribute: (el, k, v) => el.setAttribute(k, v),
                    appendChild: (parent, child) => parent.appendChild(child),
                    loadScriptAsync: () => Promise.resolve(),
                },
                Object: { mergeDeep: (t, ...s) => KUtils.mergeDeep(t, ...s) },
            },
        },
        getPlayers: () => ({}),
        setup: () => {
            throw new Error('not used by this test');
        },
        ui: {
            h: () => null,
            // A plugin UI component extends this, so it must be a real constructor.
            preact: { h: () => null, createRef: () => ({ current: null }), Component: class {} },
        },
    };
    global.KalturaPlayer = dom.window.KalturaPlayer = KalturaPlayer;

    // eslint-disable-next-line no-new-func
    new Function(
        'window',
        'document',
        'self',
        'navigator',
        'KalturaPlayer',
        'MutationObserver',
        pluginSource
    )(dom.window, document, dom.window, dom.window.navigator, KalturaPlayer, global.MutationObserver);

    return { dom, calls, registered };
}

function makePlayer() {
    const services = {};
    const listeners = {};
    const viewEl = document.getElementById('kaltura_player_1');
    return {
        config: { targetId: 'kaltura_player_1' },
        getView: () => viewEl,
        registerService: (name, svc) => {
            services[name] = svc;
        },
        getService: (name) => services[name],
        addEventListener: (type, cb) => {
            (listeners[type] = listeners[type] || []).push(cb);
        },
        dispatchEvent: (type, payload) => {
            (listeners[type] || []).forEach((cb) => cb(payload));
        },
        isLive: () => false,
        isDvr: () => false,
        configure: () => {},
        ui: { store: { getState: () => ({}) }, addComponent: () => () => {} },
    };
}

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function describeBootConfig(config) {
    const widget = ((config && config.widgets) || [])[0] || {};
    const player = widget.player || {};
    return {
        group: config && config.group && config.group.id,
        groupTitle: config && config.group && config.group.title,
        clientId: config && config.clientId,
        backend: config && config.backend && config.backend.domain,
        ssoToken: config && config.ssoToken,
        hasMoodleHooks: !!(config && config.hooks && config.hooks.mediaDetails),
        hasSetupHook: !!(config && config.hooks && config.hooks.setup),
        playerType: player.type,
        keepsPlayerElement:
            !!player.element &&
            typeof player.element.classList !== 'undefined' &&
            player.element.classList.contains('kaltura-player-container'),
        keepsAdaptorApi: !!player.adaptorApi,
    };
}

/** Capture on 'annotoserviceready', i.e. before the plugin can boot the widget. */
async function earlyCapture(env, PluginClass, { seedIt }) {
    const player = makePlayer();
    let captured = null;
    player.addEventListener('annotoserviceready', () => {
        captured = player.getService('annoto');
    });
    // eslint-disable-next-line no-new
    new PluginClass('annoto', player, UICONF_PLUGIN_CONFIG);
    const service = captured || player.getService('annoto');
    const seedResult = seedIt ? seed(service, CONFIG_OVERRIDE) : { seeded: false, reason: 'skipped' };
    await settle();
    return {
        capturedOnEvent: !!captured,
        seedResult,
        bootCount: env.calls.boot.length,
        boot: describeBootConfig(env.calls.boot[0]),
    };
}

/** Capture only after the widget has already booted - the warm-cache failure. */
async function lateCapture(env, PluginClass, { breakPluginAccess }) {
    const player = makePlayer();
    // eslint-disable-next-line no-new
    new PluginClass('annoto', player, UICONF_PLUGIN_CONFIG);
    await settle();
    const bootedUnenriched = env.calls.boot.length === 1 && !env.calls.boot[0].group;

    const real = player.getService('annoto');
    // A plugin build that no longer exposes what we reach for: public service API intact,
    // `.plugin` (and so widgetConfig / mergeConfigUpdate) gone.
    const service = breakPluginAccess
        ? { getApi: () => real.getApi(), onSetup: (h) => real.onSetup(h) }
        : real;

    const seedResult = seed(service, CONFIG_OVERRIDE);
    const finalizeResult = await finalize(service, undefined, CONFIG_OVERRIDE, 'MOODLE-SSO-JWT');
    await settle(10);
    return {
        bootedUnenriched,
        seedResult,
        finalizeResult,
        loadCount: env.calls.load.length,
        loaded: describeBootConfig(env.calls.load[0]),
        authed: env.calls.auth.length === 1 && env.calls.auth[0] === 'MOODLE-SSO-JWT',
    };
}

(async () => {
    const { source, from } = await loadPluginSource();
    console.log(`Annoto playkit plugin under test: ${from}\n`);

    const results = {};
    for (const [key, run] of [
        ['seeded', (env, C) => earlyCapture(env, C, { seedIt: true })],
        ['unseeded', (env, C) => earlyCapture(env, C, { seedIt: false })],
        ['late', (env, C) => lateCapture(env, C, { breakPluginAccess: false })],
        ['unreachable', (env, C) => lateCapture(env, C, { breakPluginAccess: true })],
    ]) {
        // A fresh environment per scenario: the plugin bundle keeps module-level state.
        const env = buildEnv(source);
        const PluginClass = env.registered.annoto;
        if (!PluginClass) {
            console.error(
                `FAIL: plugin did not register under the name "annoto" (registered: ${Object.keys(
                    env.registered
                ).join(', ') || 'none'})`
            );
            process.exit(1);
        }
        // eslint-disable-next-line no-await-in-loop
        results[key] = await run(env, PluginClass);
        console.log(`--- ${key} ---`);
        console.log(JSON.stringify(results[key], null, 2).replace(/^/gm, '  '));
    }

    const { seeded, unseeded, late, unreachable } = results;
    const checks = [
        // The plugin still exposes what the seed and the recovery reach for.
        ['service is registered as "annoto"', seeded.capturedOnEvent],
        ['seed succeeds before boot', seeded.seedResult.seeded === true],
        ['seed reports "already booted" after boot', /already booted/.test(late.seedResult.reason)],

        // Seeding: the group is in the config the widget is actually booted with.
        ['seeded boot carries the course group', seeded.boot.group === '42'],
        ['seeded boot carries the group title', seeded.boot.groupTitle === 'Functional Neuroanatomy'],
        ['seeded boot uses the Moodle clientId', seeded.boot.clientId === 'MOODLE-CLIENT-ID'],
        ['seeded boot uses the Moodle backend', seeded.boot.backend === 'eu.annoto.net'],
        ['seeded boot carries the SSO token', seeded.boot.ssoToken === 'MOODLE-SSO-JWT'],
        ['seeded boot keeps the Moodle hooks', seeded.boot.hasMoodleHooks === true],
        ["seeded boot keeps the plugin's setup hook", seeded.boot.hasSetupHook === true],
        ['seeded boot keeps player type custom', seeded.boot.playerType === 'custom'],
        ['seeded boot keeps the player element', seeded.boot.keepsPlayerElement === true],
        ['seeded boot keeps the adaptorApi', seeded.boot.keepsAdaptorApi === true],

        // Without the seed this is the bug being fixed.
        ['unseeded boot has NO group', !unseeded.boot.group],
        ['unseeded boot falls back to the uiConf clientId', unseeded.boot.clientId === 'UICONF-CLIENT-ID'],

        // Recovery after a missed capture.
        ['late capture booted un-enriched first', late.bootedUnenriched === true],
        ['late capture recovers the group via api.load', late.loaded.group === '42'],
        ['late capture recovery fixes the clientId', late.loaded.clientId === 'MOODLE-CLIENT-ID'],
        ['late capture recovery keeps the player element', late.loaded.keepsPlayerElement === true],
        ['late capture recovery keeps the adaptorApi', late.loaded.keepsAdaptorApi === true],
        ['late capture auths after the group is applied', late.authed === true],

        // Fail closed: no group means no authenticated (and therefore mis-scoped) activity.
        ['plugin unreachable does not load', unreachable.loadCount === 0],
        ['plugin unreachable does NOT auth', unreachable.authed === false],
        ['plugin unreachable reports fail closed', /fail closed/.test(unreachable.finalizeResult.reason)],
    ];

    console.log('\n--- assertions ---');
    let failed = 0;
    for (const [label, ok] of checks) {
        if (!ok) {
            failed += 1;
        }
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    }
    console.log(`\n${failed === 0 ? `ALL ${checks.length} PASS` : `${failed} of ${checks.length} FAILED`}`);
    process.exit(failed === 0 ? 0 : 1);
})();

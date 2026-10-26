# Coding-agent rules for @annoto/moodle-local-js

Rules live here; every `CLAUDE.md` is a one-line `@AGENTS.md` import. Edit this file, never the
import. A rule that applies to one folder goes in a nested `AGENTS.md` there, with its own
one-line `CLAUDE.md` beside it.

## What this repo is

The browser-side TypeScript for the [Annoto Moodle local plugin](https://github.com/Annoto/moodle-local_annoto): a webpack-built UMD bundle (global `AnnotoMoodle`) served from the Annoto CDN, which the PHP plugin loads with RequireJS on Moodle pages and starts with `AnnotoMoodle.setup()`. It finds the video players on a page (Kaltura V2 and V7, video.js, JW Player, H5P, YouTube, Vimeo, Wistia, HTML5 — Zoodle iframes are swapped for a native `<video>` first), adapts to the course format (Tiles, iContent, LTI), boots the Annoto widget on them with the course as the group and the Moodle user's SSO token, and reports activity completion back to Moodle. Its users are the Moodle site admins and teachers who install the plugin, and the students who use the widget. What newcomers get wrong: this bundle and the PHP plugin ship separately. Sites load `latest` from the CDN, so a bundle release runs at once on every installed plugin version — never assume a param newer plugins send is present; guard it.

## Layout

| Package / folder                       | Role                                                                                                                                                                                    | Depends on                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [src/main.ts](src/main.ts)             | Entry point and the `AnnotoMoodle` class: player discovery, widget boot, SSO, Kaltura V7 repair, completion reporting.                                                                  | `@annoto/widget-api`, the other `src/` modules  |
| [src/interfaces.ts](src/interfaces.ts) | Types for the params the Moodle plugin hands over and the player, widget and completion shapes.                                                                                         | `@annoto/widget-api`                            |
| [src/constants.ts](src/constants.ts)   | Build-time env (`version`, `ENV`, `name`) injected by webpack's `DefinePlugin`.                                                                                                         | —                                               |
| [src/util.ts](src/util.ts)             | Small pure helpers: Moodle version parsing, debounce, HTML escaping, player ids, delay, player pick, page-layout checks, course page completion.                                        | `src/interfaces.ts`, `@annoto/widget-api` types |
| [src/formats/](src/formats/)           | Course-format specific behaviour (`tiles.ts`: format_tiles tile open/close and AJAX-loaded content; `grid-popup.ts`: the format_grid section popup, which holds the widget while open). | `src/interfaces.ts`, `src/util.ts`              |
| [src/players/](src/players/)           | Player-specific adapters (`zoodle.ts`: swaps a Zoodle iframe for a native `<video>` the HTML5 detection picks up).                                                                      | —                                               |
| [test/](test/)                         | Plain Node test scripts: the Kaltura V7 playkit plugin contract, the Zoodle swap, the Tiles init, the page-layout helpers, the Grid popup, the label completion helpers.                | `jsdom`, `typescript`                           |
| `webpack.*.js`                         | Build per env (`dev`, `staging`, `prod`) into `dist/annoto.js`.                                                                                                                         | `webpack`, `ts-loader`                          |

`src/main.ts` is the only module that imports the others. Modules under `src/formats/` and `src/players/` import only `src/util.ts` and `src/interfaces.ts` — never `main.ts` or each other. A cross-cutting helper goes in `src/util.ts`, a shared type in `src/interfaces.ts`.

## Public contracts

-   The UMD global `AnnotoMoodle` and its exports (`setup`, `annotoMoodleLocal`, `VERSION`, `NAME`, `IMoodleJsParams`) in [src/main.ts](src/main.ts); the PHP plugin calls `AnnotoMoodle.setup()`.
-   What the Moodle plugin hands over on `window.moodleAnnoto` — `IMoodleJsParams` and `IMoodleAnnoto` in [src/interfaces.ts](src/interfaces.ts), including the `setupKalturaKdpMap` / `setupKalturaV7PlayersMap` hooks. The plugin loads `https://cdn.annoto.net/moodle-local-js/latest/annoto.js` by default (a site admin can point it elsewhere), so every plugin release that keeps the default runs the newest bundle.
-   The CDN paths `cdn.annoto.net/moodle-local-js/<version>/annoto.js`, `cdn.annoto.net/moodle-local-js/latest/annoto.js` and `cdn.annoto.net/staging/moodle-local-js/latest/annoto.js`.
-   The Moodle web-service call `local_annoto_set_completion` and its `data` payload.
-   The Annoto Kaltura playkit plugin internals the V7 path reaches into (`service.plugin`, `plugin.widgetConfig`, `plugin.mergeConfigUpdate`, `plugin.isWidgetBooted`, `KalturaPlayer.getPlayers()`, `player.getService('annoto')`), guarded by `npm run test:kaltura-v7`.

Changing any of them is a behavior change, never a refactor. Before changing a shared module, grep its consumers across the repo; a signature change enumerates every call site.

## Docs

| Folder                       | What it holds                                                      |
| ---------------------------- | ------------------------------------------------------------------ |
| [docs/adr/](docs/adr/)       | Architecture decision records, immutable once `Accepted`.          |
| [docs/design/](docs/design/) | Design specs for a feature or subsystem.                           |
| [docs/plans/](docs/plans/)   | Implementation plans, task by task.                                |
| [docs/guides/](docs/guides/) | Guides, indexed by [docs/guides/README.md](docs/guides/README.md). |

Guides and READMEs mirror rules and code for humans: when a change makes one wrong — or a code comment or JSDoc — correct it in the same change.

ADRs, design specs and plans are decision records, not mirrors of the code. They change through the workflow that owns them — a ruling, or a deviation recorded where that workflow says — never just because the code drifted; a stale claim no ruling covers is reported to the doc's owner.

-   **ADR** — a `Proposed` one is a draft, revised in place; an `Accepted` one is not rewritten — a changed decision is a new ADR that supersedes it, and the old one's status becomes `Superseded`. Deviating from any ADR is the user's call.
-   **Design spec** — changes to record a ruling on the design, including an accepted deviation from it.
-   **Plan** — revised in place until building starts; from then on its body stays as written and deviations go in its `## Addendum`.

Rules live in `AGENTS.md` files, never only in a doc: a doc may explain a rule, but no rule depends on reading one.

## Common tasks

| Command                                          | Effect                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                         | Install dependencies from the lockfile.                                                                                      |
| `npm run dev`                                    | Dev server; the bundle is at `http://localhost:9002/annoto.js`.                                                              |
| `npm run watch`                                  | Rebuild `dist/` on change (dev env).                                                                                         |
| `npm run lint`                                   | ESLint over `src/**/*.ts`.                                                                                                   |
| `npx --no-install tsc -p tsconfig.json --noEmit` | Typecheck only.                                                                                                              |
| `npm run build`                                  | Lint (`prebuild`), then the prod webpack build into `dist/`; ts-loader typechecks, so a type error fails it.                 |
| `npm run build:staging`                          | Lint, then the staging build.                                                                                                |
| `npm run test:kaltura-v7`                        | Contract test against the published playkit plugin (downloads it; `PLUGIN_BUNDLE=<path>` runs offline against a local copy). |
| `npm run test:zoodle`                            | Unit test for the Zoodle iframe swap in [src/players/zoodle.ts](src/players/zoodle.ts).                                      |
| `npm run test:tiles`                             | Unit test for the format_tiles integration in [src/formats/tiles.ts](src/formats/tiles.ts).                                  |
| `npm run test:layout`                            | Unit test for the player pick and page-layout helpers in [src/util.ts](src/util.ts).                                         |
| `npm run test:grid`                              | Unit test for the format_grid section popup integration in [src/formats/grid-popup.ts](src/formats/grid-popup.ts).           |
| `npm run test:label-completion`                  | Unit test for the course page (label) completion helpers in [src/util.ts](src/util.ts).                                      |
| `npm run prettier:fix`                           | Prettier over the whole repo.                                                                                                |

`npm run build` is the aggregate check. It runs no test script: run `npm run test:kaltura-v7`, `npm run test:zoodle`, `npm run test:tiles`, `npm run test:layout`, `npm run test:grid` and `npm run test:label-completion` before reporting a PR ready, and the Kaltura one whenever the V7 path in [src/main.ts](src/main.ts) changes. ESLint runs with `eslint-plugin-only-warn`, so lint findings print as warnings and never fail the build — read the lint output rather than trusting the exit status. `npm run test:kaltura-v7` exits 0 with a `SKIP:` line when `jsdom` is not installed; a skip is not a pass. The build skips any run in a real Moodle site: before releasing a change to player discovery or a course format, load the staging bundle on a Moodle site with that player or format (e.g. Kaltura V7, Zoodle, Tiles, Grid) and confirm the widget boots.

---

## Git

-   Never include the Claude Code session link (`Claude-Session:` trailer, `https://claude.ai/code/session_...`) in commit messages, PR bodies, or issue and review comments.
-   The `Co-Authored-By` trailer names `Agent`, never the full model/email.
-   A PR body ends with `Co-Authored-By: Agent`, never with a "Generated with Claude Code" line or any other tool attribution.
-   Issue and PR bodies, comments, and review replies are markdown as the forge renders it — headings, lists, links. Never wrap the whole text in a code fence; fence only code and command output inside it.
-   Run a push as a call of its own, with no other command in the same call — not chained, not in a script. A call that names a protected branch elsewhere, such as opening a PR against it, can match the protected-branch deny rows and block the push outright.

### Git Commit Conventions

Commits follow Conventional Commits

```
type(scope): short description
```

| Type       | When to use                                                                             |
| ---------- | --------------------------------------------------------------------------------------- |
| `feat`     | New feature or capability                                                               |
| `fix`      | Bug fix                                                                                 |
| `refactor` | Code change with no functional difference                                               |
| `test`     | Adding or fixing tests                                                                  |
| `chore`    | Maintenance, dependency updates                                                         |
| `devops`   | Infrastructure, CI/CD, agent config and dev tooling, migrations, deployment, DB scripts |
| `docs`     | Documentation only — READMEs, guides, design specs, ADRs, plans                         |

Scope identifies the affected package(s) or area.
Scope is optional for changes that span the whole repo or don't map cleanly to a single package.

**Rules**

-   Description is lowercase, no trailing period.
-   Use imperative mood: "add", "fix", "remove" — not "added" or "fixes".
-   If a commit spans more than 2 scopes, omit the scope, keep only the type, and use a multi-line commit for details.
-   release-please reads these types on `main` to pick the next version and write `CHANGELOG.md`: `feat` is a minor bump, `fix` a patch, a `!` or a `BREAKING CHANGE:` footer a major. The type is the release note.

**Multi-line commits**

Prefer multi-line format whenever a commit includes multiple distinct changes — not just for PR squash merges. Use a single-line message only when the commit does exactly one thing.

Add a body listing the individual changes as bullet points. Omit iterative `type(scope)` bullets that only refine or clean up work introduced earlier in the same PR — include only bullets that add distinct value.

**Bullet prefix rule:** if every bullet has the same `type(scope)` as the subject line, omit `type(scope):` from all bullets and write only the description. If any bullet differs, include `type(scope):` on all bullets.

### Git Branch Rules

-   **Protected branches: `main` — commits land there only via PRs or automated tooling, never manually.** Always work on a feature branch and open a PR.
-   Branch naming: `feat/<description>`, `fix/<issue-number>-<description>`, `refactor/<issue-number>-<description>`, `docs/<issue-number>-<description>`, `devops/<description>`.
-   `release-please--branches--main--components--moodle-local-js` belongs to release-please; never commit or push to it by hand.

### Issues

Issues carry the label of their kind: `bug` for a defect or regression, `enhancement` for a behavior change to something that exists, `feature` for a new capability; cleanup with no behavior change takes `enhancement` (there is no `refactor` label). Title: one specific line naming the area and the symptom, capability, or target.

### Pull Requests

-   Label the PR to match the issue it closes, adding `security`, `breaking`, etc. when they apply.
-   The PR body closes its issue (`Closes #<n>`).

---

## House rules

### Workflow rules

-   **When the user asks a question, discuss first** — don't jump to implementation or edits as a response.
-   **Be direct and concise** — no pleasantries, no preamble, no filler. Disclaimers and caveats stay short; the response goes to the main answer. Asked to explain something, give the high-level summary unless depth is asked for.
-   **Link what you name.** A file or a doc section in a reply is a markdown link ([AGENTS.md](AGENTS.md), [Git](AGENTS.md#git)), never a bare path.
-   **Report an edit, don't paste it.** What changed, where (linked), and why — the user reads the file.
-   **Feedback in chunks.** Review findings or suggestions you volunteer in an interactive conversation come in chunks of up to five points, saying how many remain. A skill's prescribed report is presented as that skill says, and an unattended run sends the whole report in one message.
-   **Ask before adding a dependency.** Prefer what the repo already has.
-   **Ask before generating `.md` docs**, unless explicitly instructed otherwise.
-   **A document is as long as its task needs.** Cover the substance; no filler sections, restated summaries, or boilerplate. A skill's or template's required sections are substance — the rule governs what fills them and what is added beyond them.
-   **Search the web for current docs when a task depends on an external fact** — a dependency, framework, API, tool, platform service, or a standard or spec (e.g. OWASP, WCAG). Training data is stale; verify against the installed or adopted version before applying advice.
-   **If a rule conflicts with a task, ask** — don't silently bypass.
-   **TDD is mandatory for features, fixes, and behavior changes** — the `tdd` skill's full cycle (RED, GREEN, PROVE RED, REFACTOR).
-   **`npm run build` must pass before committing.** Before reporting a PR ready, run it again plus whichever manual checks Common tasks names.
-   **Releases are release-please's.** Never hand-edit the `version` in `package.json` or `package-lock.json`, `.release-please-manifest.json`, or `CHANGELOG.md`; never create, edit, or publish a GitHub release by hand — a published release deploys to the CDN. The prod CDN deploy waits on an approval of the `production` environment, so a merged release PR is not yet live: confirm against the CDN before saying a version shipped. Pipeline: [docs/guides/releasing.md](docs/guides/releasing.md).

### Technical rules

-   **Design principles: DRY, KISS, YAGNI, SOLID — in that order of frequency.** Don't abstract until the second duplicate. Don't add config knobs, hooks, or generics for a use case that isn't in the diff. An established codebase pattern is not over-engineering: repeating it for new code is expected; flag as YAGNI only abstractions nothing in the codebase uses.
-   **Tests live under `test/` as plain Node scripts, each wired to an `npm run test:<name>` script — the repo has no test runner.** Every new public function, type, or component ships with tests in the same commit; cover the happy path, the documented edge cases (empty, null, error), and failure paths. Tests exercise real logic.
-   **Document non-obvious logic only.** A short comment explaining _why_ (invariant, workaround, protocol quirk, ADR reference) is welcome. Don't restate _what_ the code does.
-   **Never count what the text lists.** "The three options", "both callbacks", "these five steps" — in a doc, a comment, a docstring, or a commit body — go stale the moment an item is added or removed. Let the list carry its length.
-   **When a code question is really an architecture question, read the ADR before editing.** A boundary or a shape that looks wrong was decided, not overlooked.
-   **Follow existing code patterns.** Different areas may differ in style — adapt. When existing code and these rules disagree, the rules win: legacy code may predate them.

### Checks and evidence

Each of these exists because its absence ships something wrong.

-   **Every claim in a report is audited against a tool result from this session.** Report only work you can point to evidence for, and say explicitly what is not yet verified. Outcomes faithfully: a failing test with its output, a skipped step named, and what is done and verified stated plainly, without hedging.
-   Every guard, gate, or check must be provably able to fail: break what it guards, watch it go red, revert. A check you cannot demonstrate red is not a check.
-   Catches fail closed. A tool error, an empty result, or a skipped step never reads as "no findings".
-   Numbers in commit messages and PR bodies are prose; evidence is the command that ran and its exit status.

## Security

When writing or reviewing code, check for the following. The categories follow the [OWASP Top 10:2025](https://top10.owasp.org/2025/); look an item up there for depth. Severity: **HIGH** = blocker,
**MEDIUM** = should fix, **LOW** = consider fixing but always notify the team.

### HIGH — Blockers

-   **Hardcoded credentials or API keys** (A07 Authentication Failures) in source code or committed config files.
-   **Sensitive data exposure** (A01 Broken Access Control; written to logs, A09 Security Logging and Alerting Failures): secrets, tokens, or PII written to logs, included in error output, or returned beyond what the caller needs.
-   **Untrusted input reaching a shell, a query, a parser, or a filesystem path unvalidated** (A05 Injection; path traversal, A01 Broken Access Control) — injection and path traversal. Parameterize queries; sanitize any path built from input.

### MEDIUM — Should fix

-   **Cryptographic failures** (A04 Cryptographic Failures): weak algorithms, hardcoded IVs, home-rolled crypto, insufficient key lengths, missing key management; secrets encrypted at rest and in transit across all layers, including infrastructure.
-   **Unhandled errors** (A10 Mishandling of Exceptional Conditions) — an async error not caught (a floating promise, a missing `await`); an uncaught rejection, panic, or exception that leaks a stack trace or internal state to a caller.
-   **Insecure defaults** (A02 Security Misconfiguration): a shipped default — a config option, a feature toggle, an exposed surface — is the secure choice, and the user opts out. In a published library or SDK, every default is each consumer's production config.

### LOW — Consider

-   **Vulnerable or outdated components** (A03 Software Supply Chain Failures): when adding or upgrading a dependency, verify it has no known CVEs and is actively maintained.

## Code conventions

### General

-   No magic numbers or strings — named constants.
-   No commented-out code. A `TODO` / `FIXME` references a ticket or states a clear action.
-   No debug prints in shipped code — use the project's logger.
-   Prefer early return over nested conditionals; split a function with many branches.
-   When a function takes more than two parameters, two of the same type, or any boolean, take one named argument object (or struct) instead.

### TypeScript

#### Naming

| Symbol kind                   | Convention                                       | Example                     |
| ----------------------------- | ------------------------------------------------ | --------------------------- |
| `class`                       | PascalCase, no prefix                            | `AgentClient`               |
| `interface`                   | `I` prefix                                       | `IOrderOptions`             |
| `type` alias                  | `T` prefix                                       | `TOrderStatus`              |
| Generic type parameter        | `T` prefix                                       | `TProps`, `TKey`            |
| `enum`                        | `E` prefix (rare — prefer string-literal unions) | `ESeverity`                 |
| Functions, methods, variables | camelCase                                        | `createOrder`, `retryCount` |
| Global constants              | `ALL_CAPS_WITH_UNDERSCORES`                      | `MAX_RETRIES`               |

-   Boolean accessors and methods: `is` / `has` / `can` prefix (`isReady`, `hasAuth`, `canRender`).
-   Class getters mirror their backing property — `something`, not `getSomething`; booleans keep the prefix rule above.
-   Error param: `err` (not `error` or `e`). Event param: `ev` (not `event` or `e`).
-   Don't shadow a class, interface, or type name with a variable or parameter in scope.

#### TypeScript discipline

-   No `any`. Use `unknown` only when truly necessary, with an inline comment explaining why.
-   No `@ts-nocheck`. Fix the type error.
-   No `as never`, and no `as unknown as IFoo` — both bypass the type system.
-   Avoid `as` casts in general; reach for generics first.
-   Type every function parameter; type the return of every exported or public function; type variables that inference can't resolve cleanly.
-   Lean on inference — don't restate a type the compiler already knows.
-   A function's argument object gets a named `interface` (`IFooArgs`) when its shape is not trivial.
-   Use optional chaining `?.` for nested optional access instead of `if`-guards; don't repeat `?.` across sibling properties of the same already-checked object.
-   For a library: every public type that wraps caller data is generic (`IProps<TProps, TEvent>`) so callers get end-to-end inference; nothing is `unknown` at the call site if the caller typed their domain.

#### Classes

-   Omit the `public` keyword — it's the default.
-   Public members before protected and private.
-   A `this.x` read more than once in a method is aliased to a local, several of them destructured — unless that would break async semantics.

#### Modules and checks

-   Prefer specific imports over barrel imports where bundle size matters.
-   Before finishing, typecheck and lint every file you touched: `npx --no-install tsc -p tsconfig.json --noEmit` and `npx --no-install eslint <file>`. Lint errors are often real bugs — a missing await, an unhandled error, a wrong import. Don't fight the linter — its rules are mechanical; read its config when in doubt.

## Permissions when running unattended

This section applies when you run as a subagent, in a background task, or in a non-interactive session — anywhere a permission prompt has no one to answer it. An interactive session simply asks; a denied call there means the user declined, so adjust the approach rather than retry it.

Unattended, a denied tool call is a silent failure mid-workflow. A call must pass both the tools the session has and the project's permission lists (`.claude/settings.json` for Claude Code — `permissions.allow` is auto-approved, `permissions.deny` is blocked). Read them at the start and plan around them.

-   Each piped variant of a shell command needs its own allow entry: `Bash(git log*)` does not cover `git log | head`.
-   Fetch only allowed domains; call only allowed MCP tools; check the deny list for path restrictions before editing.
-   When a needed tool is missing, try a permitted alternative; if none exists, stop and report — do not retry the denied call.
-   At the end of your work, list any tool you needed but could not use, so the user can extend the settings:

```
MISSING PERMISSIONS:
  - <Tool>(<pattern>): <why needed>
```

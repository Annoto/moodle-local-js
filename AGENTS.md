# AGENTS.md — coding-agent guide for @annoto/moodle-local-js

Rules live here; every `CLAUDE.md` is a one-line `@AGENTS.md` import. Edit this file, never the
import. A rule that applies to one folder goes in a nested `AGENTS.md` there, with its own
one-line `CLAUDE.md` beside it.

## What this repo is

The browser-side TypeScript for the [Annoto Moodle local plugin](https://github.com/Annoto/moodle-local_annoto): a UMD bundle (global `AnnotoMoodle`) served from the Annoto CDN and loaded by that PHP plugin on Moodle pages. It finds the video players on a page (Kaltura V2 and V7, Vimeo, video.js, Wistia, H5P/iContent, LTI iframes), boots the Annoto widget on them with the course as the group and the Moodle user's SSO token, and reports activity completion back to Moodle. Its users are Moodle site admins and teachers who install the plugin, and the students who use the widget. _[FILL IN: the one thing a newcomer gets wrong here — e.g. that the plugin's PHP side and this bundle ship separately, and which plugin versions this bundle must still support.]_

## Layout

| Package / folder                       | Role                                                                                                                   | Depends on                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [src/main.ts](src/main.ts)             | Entry point and the `AnnotoMoodle` class: player discovery, widget boot, SSO, Kaltura V7 repair, completion reporting. | `@annoto/widget-api`, the other `src/` modules |
| [src/interfaces.ts](src/interfaces.ts) | Types for the params the Moodle plugin hands over and the player/widget shapes.                                        | `@annoto/widget-api`                           |
| [src/constants.ts](src/constants.ts)   | Build-time env (`version`, `ENV`, `name`) injected by webpack's `DefinePlugin`.                                        | —                                              |
| [src/util.ts](src/util.ts)             | Small pure helpers (version parsing, debounce, HTML escaping, ids, delay).                                             | `src/interfaces.ts`                            |
| [src/formats/](src/formats/)           | Course-format specific behaviour (`tiles.ts`).                                                                         | `src/interfaces.ts`, `src/util.ts`             |
| [test/](test/)                         | Contract test against the real published Kaltura playkit plugin bundle.                                                | `jsdom`                                        |
| `webpack.*.js`                         | Build per env (`dev`, `staging`, `prod`) into `dist/annoto.js`.                                                        | —                                              |

_[FILL IN: the boundary rule between them — what may import what, and where a cross-cutting helper goes.]_

## Public contracts

-   The UMD global `AnnotoMoodle` and its exports (`setup`, `annotoMoodleLocal`, `VERSION`, `NAME`, `IMoodleJsParams`) in [src/main.ts](src/main.ts).
-   The params the Moodle plugin passes in — `IMoodleJsParams` and `IMoodleAnnoto` in [src/interfaces.ts](src/interfaces.ts) (including the `setupKalturaKdpMap` / `setupKalturaV7PlayersMap` hand-over hooks). Older plugin releases call the bundle with older shapes, and the CDN's `latest` path serves all of them.
-   The CDN paths `cdn.annoto.net/moodle-local-js/<version>/annoto.js`, `.../latest/annoto.js` and `cdn.annoto.net/staging/moodle-local-js/latest/annoto.js`.
-   The Moodle web-service call `local_annoto_set_completion` and its `data` payload.
-   The Annoto Kaltura playkit plugin internals the V7 path reaches into (`service.plugin`, `plugin.widgetConfig`, `plugin.mergeConfigUpdate`, `plugin.isWidgetBooted`, `KalturaPlayer.getPlayers()`, `player.getService('annoto')`), guarded by `npm run test:kaltura-v7`.

Changing any of them is a behavior change, never a refactor. Before changing a shared module, grep its consumers across the repo; a signature change enumerates every call site.

## Docs

| Folder                       | What it holds                                                      |
| ---------------------------- | ------------------------------------------------------------------ |
| [docs/adr/](docs/adr/)       | Immutable architecture decision records.                           |
| [docs/design/](docs/design/) | Design specs for a feature or subsystem.                           |
| [docs/plans/](docs/plans/)   | Implementation plans, task by task.                                |
| [docs/guides/](docs/guides/) | Guides, indexed by [docs/guides/README.md](docs/guides/README.md). |

Docs mirror rules and code for humans. When a change makes a guide, design doc, or README wrong, update it in the same change. Don't load a doc to follow a rule.

## Common tasks

| Command                             | Effect                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                            | Install dependencies from the lockfile.                                                                                 |
| `npm run dev`                       | Dev server; the bundle is at `http://localhost:9002/annoto.js`.                                                         |
| `npm run watch`                     | Rebuild `dist/` on change (dev env).                                                                                    |
| `npm run lint`                      | ESLint over `src/**/*.ts`.                                                                                              |
| `npx tsc -p tsconfig.json --noEmit` | Typecheck only.                                                                                                         |
| `npm run build`                     | Lint (`prebuild`), then the prod webpack build into `dist/` (ts-loader typechecks).                                     |
| `npm run build:staging`             | Lint, then the staging build.                                                                                           |
| `npm run test:kaltura-v7`           | Contract test against the published playkit plugin (downloads it; `PLUGIN_BUNDLE=<path>` runs offline on a local copy). |
| `npm run prettier:fix`              | Prettier over the whole repo.                                                                                           |

`npm run build` is the aggregate check. It does not run `npm run test:kaltura-v7` — run that by hand whenever the Kaltura V7 path in [src/main.ts](src/main.ts) changes. ESLint runs with `eslint-plugin-only-warn`, so lint findings print as warnings and never fail the build: read the lint output rather than trusting the exit status. _[FILL IN: which other checks it skips — a manual run in a real Moodle site per player type — and when to run those by hand.]_

---

## Git

-   Never include the Claude Code session link (`Claude-Session:` trailer, `https://claude.ai/code/session_...`) in commit messages, PR bodies, or issue and review comments.
-   The `Co-Authored-By` trailer names `Agent`, never the full model/email.
-   A PR body ends with `Co-Authored-By: Agent`, never with a "Generated with Claude Code" line or any other tool attribution.

### Git Commit Conventions

Commits follow Conventional Commits

```
type(scope): short description
```

| Type       | When to use                               |
| ---------- | ----------------------------------------- |
| `feat`     | New feature or capability                 |
| `fix`      | Bug fix                                   |
| `refactor` | Code change with no functional difference |
| `test`     | Adding or fixing tests                    |
| `chore`    | Maintenance, dependency updates, tooling  |

Scope identifies the affected package(s) or area.
Scope is optional for changes that span the whole repo or don't map cleanly to a single package.

**Rules**

-   Description is lowercase, no trailing period.
-   Use imperative mood: "add", "fix", "remove" — not "added" or "fixes".
-   If a commit spans more than 2 scopes, omit the scope, keep only the type, and use a multi-line commit for details.
-   release-please reads these types to pick the next version and write `CHANGELOG.md`: `feat` is a minor bump, `fix` a patch, a `!` or `BREAKING CHANGE:` footer a major. The type is the release note.

**Multi-line commits**

Prefer multi-line format whenever a commit includes multiple distinct changes — not just for PR squash merges. Use a single-line message only when the commit does exactly one thing.

Add a body listing the individual changes as bullet points. Omit iterative `type(scope)` bullets that only refine or clean up work introduced earlier in the same PR — include only bullets that add distinct value.

**Bullet prefix rule:** if every bullet has the same `type(scope)` as the subject line, omit `type(scope):` from all bullets and write only the description. If any bullet differs, include `type(scope):` on all bullets.

### Git Branch Rules

-   **Protected branches: `main` — commits land there only via PRs or automated tooling, never manually.** Always work on a feature branch and open a PR.
-   Branch naming: `feat/<description>`, `fix/<issue-number>-<description>`, `refactor/<issue-number>-<description>`.
-   `release-please--branches--main--components--moodle-local-js` belongs to release-please; never commit to it by hand.

### Issues

Issues carry the label of their kind: `bug` for a defect or regression, `enhancement` for a feature or behavior change (the repo also has `feature`), _[FILL IN: the label for cleanup with no behavior change — the repo has no `refactor` label]_. Title: one specific line naming the area and the symptom, capability, or target.

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
-   **Search the web for current docs when researching a dependency, API, or tool** — training data is stale. Verify against the installed version before applying advice.
-   **If a rule conflicts with a task, ask** — don't silently bypass.
-   **TDD is mandatory for features, fixes, and behavior changes** — the `tdd` skill: a failing test first, then the minimum to pass.
-   **`npm run build` must pass before committing.** Before reporting a PR ready, run it again plus whichever manual checks Common tasks names.
-   **Releases are release-please's.** Never hand-edit the `version` in `package.json`, `.release-please-manifest.json`, or `CHANGELOG.md`; never create, edit, or publish a GitHub release by hand — a published release deploys to the CDN. The prod CDN publish waits on an approval of the `production` environment, so a merged release PR is not yet live: confirm with `curl` against the CDN before saying a version shipped. Pipeline: [docs/guides/releasing.md](docs/guides/releasing.md).

### Technical rules

-   **Design principles: DRY, KISS, YAGNI, SOLID — in that order of frequency.** Don't abstract until the second duplicate. Don't add config knobs, hooks, or generics for a use case that isn't in the diff. An established codebase pattern is not over-engineering: repeating it for new code is expected; flag as YAGNI only abstractions nothing in the codebase uses.
-   **Tests live under `test/` as plain Node scripts, each run by an `npm run test:<name>` script — the repo has no test runner yet.** Every new public function, type, or component ships with tests in the same commit; cover the happy path, the documented edge cases (empty, null, error), and failure paths. Tests exercise real logic.
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

When writing or reviewing code, check for the following. The categories follow the OWASP Top 10; look an item up there for depth. Severity: **HIGH** = blocker,
**MEDIUM** = should fix, **LOW** = consider fixing but always notify the team.

### HIGH — Blockers

-   **Hardcoded credentials or API keys** (Security Misconfiguration) in source code or committed config files.
-   **Sensitive data exposure** (Cryptographic Failures): secrets, tokens, or PII written to logs, included in error output, or returned beyond what the caller needs.
-   **Untrusted input reaching a shell, a query, a parser, or a filesystem path unvalidated** (Injection) — injection and path traversal. Parameterize queries; sanitize any path built from input.
-   **Authorization bypass** (Broken Access Control): a route, handler, or gateway without the guard its data requires; misconfigured scopes or access options.
-   **IDOR** (Insecure Direct Object Reference; Broken Access Control): resource access without verifying that the resource belongs to the authenticated principal or that they hold the right to it.
-   **Missing input validation** (Injection) at the boundary — no schema or DTO validation on an endpoint that accepts caller-controlled data.
-   **Insecure design** (Insecure Design): a feature with no auth boundary, data reachable without any ownership check, or no way to restrict access after the fact — caught at design time, before implementation.
-   **Tenant isolation** (Broken Access Control): every read, write, cache key, queue message, file path, and outbound call is bound to the requesting tenant (the Annoto `clientId`, and within it the course group `mediaGroupId`) and enforced where the data is owned — whatever the isolation model: a shared schema, a schema or database per tenant, or separate deployments. A missing check lets one tenant read or modify another's data. Cross-tenant access exists only through an explicit, documented mechanism.

### MEDIUM — Should fix

-   **Cryptographic failures** (Cryptographic Failures): weak algorithms, hardcoded IVs, home-rolled crypto, insufficient key lengths; secrets encrypted at rest and in transit.
-   **Unhandled errors** (Security Misconfiguration) — an uncaught rejection, panic, or exception that leaks a stack trace or internal state to a caller.
-   **SSRF** (Server-Side Request Forgery): a caller-controlled URL used in a server-side request without allowlisting or validation.
-   **Integrity of external payloads** (Software and Data Integrity Failures): webhook callbacks, OAuth or SSO launches, and third-party responses are verified (signature, HMAC, JWT validation) before trust; internal queue messages are inside the trusted boundary.
-   **Overly permissive CORS** (Security Misconfiguration): origins validated against known hosts.
-   **Missing rate limiting** (Identification and Authentication Failures) on authentication, token issuance, or other sensitive endpoints.
-   **Security misconfiguration** (Security Misconfiguration): debug or admin endpoints left enabled, permissive error responses, unnecessary modules enabled, default credentials.
-   **Security logging gaps** (Security Logging and Monitoring Failures): failed auth attempts, permission denials, and sensitive data access leave no record.
-   **Excessive permissions** (Broken Access Control): a key or user scope granted broader access than the operation needs.

### LOW — Consider

-   **Vulnerable or outdated components** (Vulnerable and Outdated Components): when adding or upgrading a dependency, verify it has no known CVEs and is actively maintained.
-   **Verbose error messages** (Security Misconfiguration) that reveal implementation structure to clients.
-   **Missing audit logging** (Security Logging and Monitoring Failures) on sensitive operations — who did what, and when.
-   **Long-lived tokens** (Identification and Authentication Failures) without expiry or rotation.

**Audit trail (required at design time).** Any state-changing endpoint on a sensitive entity — permission changes, content moderation, data deletion, anything financial or graded — specifies, before implementation: which identity is captured (the authenticated user, the API key, or a system identifier), which field or log entry carries it, and where it is extracted from. A state-changing endpoint without identity capture is a compliance and incident-response gap.

## Code conventions

### General

-   No magic numbers or strings — named constants.
-   No commented-out code. A `TODO` / `FIXME` references a ticket or states a clear action.
-   No debug prints in shipped code — use the project's logger.
-   Prefer early return over nested conditionals; split a function with many branches.
-   When a function takes more than two parameters, two of the same type, or any boolean, take one named argument object (or struct) instead.
-   Lint and typecheck every file you touch before finishing; lint errors are often real bugs — a missing await, an unhandled error, a wrong import.

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
-   A `this.x` read more than once in a method is aliased to a local, several of them destructured — unless that would break async semantics:

    ```ts
    class Foo {
        bar = new Set<string>();
        defaultBarValues = ['a', 'b', 'c'];

        resetBar(): Set<string> {
            const { bar, defaultBarValues } = this;
            bar.clear();
            defaultBarValues.forEach((v) => bar.add(v));
            return bar;
        }

        singleUse() {
            this.bar.add('four');
        }
    }
    ```

#### Modules and checks

-   Prefer specific imports over barrel imports where bundle size matters.
-   Before finishing, typecheck and lint every file you touched: `npx tsc -p tsconfig.json --noEmit` and `npx eslint <file>`. Don't fight the linter — its rules are mechanical; read its config when in doubt.

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

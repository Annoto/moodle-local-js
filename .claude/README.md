# Repo-scoped Claude Code config

This directory holds the Claude Code state that travels with the codebase rather than living in
a developer's personal `~/.claude`: settings, hooks, and any project-specific skills.

## Instruction files

Claude Code reads `CLAUDE.md`, not `AGENTS.md`. The repo standardises on
[AGENTS.md](../AGENTS.md) as the tool-neutral source of truth, so every `CLAUDE.md` is a one-line
`@AGENTS.md` import. Edit the `AGENTS.md`; never put a rule in a `CLAUDE.md`. A rule that applies
to one folder goes in a nested `AGENTS.md` there, with its own one-line `CLAUDE.md` beside it.

Personal, uncommitted additions go in `CLAUDE.local.md` at the repo root — gitignored.

## Settings

-   `settings.json` — shared: the permission allow and deny lists and the hooks. Committed, and
    changed through review like code.
-   `settings.local.json` — personal overrides and extra allows. Gitignored; never committed.

## Hooks

| Hook                                 | Event                         | Effect                                                                                                                                   |
| ------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/protect-branches.sh`          | PreToolUse on Bash            | Denies `commit`, `add`, `merge`, `rebase`, `reset`, `cherry-pick`, `revert` and `push` run in a checkout of a protected branch (`main`). |
| Prettier (inline in `settings.json`) | PostToolUse on Edit and Write | Runs `npx --no-install prettier --write --ignore-unknown` on the edited file; never blocks the write.                                    |

The hook asks [`scripts/agent-hooks/protected-target.sh`](../scripts/agent-hooks/protected-target.sh)
which repository each git write targets, following `cd`, `-C` and the like from the session's
working directory, and denies a write it cannot place. It catches common mistakes; the forge's
branch protection is the real boundary. The script's header lists what it misses.

The hooks need `jq` on the PATH; without it the branch guard exits silently and guards nothing.

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

| Hook                                          | Event                         | Effect                                                                                                                                          |
| --------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/protect-branches.sh`                   | PreToolUse on Bash            | Denies `commit`, `add`, `merge`, `rebase`, `reset`, `cherry-pick` and `push` while on a protected branch (`main`).                              |
| ESLint + Prettier (inline in `settings.json`) | PostToolUse on Edit and Write | Runs `npx eslint --fix` on an edited `.ts`/`.js` file, then `npx prettier --write --ignore-unknown` on any edited file; never blocks the write. |

The guard reads the command Claude Code is about to run, so it catches the git call wherever it
sits on the line, global flags and all. What it cannot see is a write that never goes through
Bash — an editor, another tool, a script it invokes.

The hooks need `jq` on the PATH; without it the branch guard exits silently and guards nothing.

## Skills

Where a rule names a skill invoked as `/engineering:<name>`, it comes from the `engineering`
plugin, not from this repo.

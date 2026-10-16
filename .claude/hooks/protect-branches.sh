#!/bin/bash
# Deny git write operations run in a checkout of a protected branch.
# Wired as a Claude Code PreToolUse hook on Bash in .claude/settings.json. The decision, and what the
# guard does and does not see, is scripts/agent-hooks/protected-target.sh, which another agent
# tool's hook can call the same way.

# Space-separated, e.g. "main dev".
PROTECTED_BRANCHES="main"

TARGET_SCRIPT="$(cd "$(dirname "$0")/../.." && pwd -P)/scripts/agent-hooks/protected-target.sh"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

deny() {
  jq -n \
    --arg reason "$1" \
    '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
  exit 0
}

# With nothing protected there is nothing to deny, the missing-script case included.
[ -z "$PROTECTED_BRANCHES" ] && exit 0

# Fail closed: without the script no git command is judged, so every one is denied.
if [ ! -x "$TARGET_SCRIPT" ]; then
  echo "$COMMAND" | grep -q git && deny "Branch guard cannot run: $TARGET_SCRIPT is missing or not executable."
  exit 0
fi

REASON=$(printf '%s' "$COMMAND" | "$TARGET_SCRIPT" "$PROTECTED_BRANCHES" "${CWD:-$PWD}")
STATUS=$?
# The script always exits 0; any other status means it did not decide, so it fails closed too.
if [ "$STATUS" -ne 0 ]; then
  echo "$COMMAND" | grep -q git && deny "Branch guard failed: $TARGET_SCRIPT exited $STATUS, so the command's git writes cannot be judged."
  exit 0
fi
[ -n "$REASON" ] && deny "$REASON"

exit 0

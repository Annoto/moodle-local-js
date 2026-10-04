#!/bin/bash
# Deny git write operations on protected branches.
# Wired as a Claude Code PreToolUse hook on Bash in .claude/settings.json.

# Space-separated, e.g. "main dev".
PROTECTED_BRANCHES="main"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Only git write commands are checked. The git call is matched wherever it sits in the command
# line — after a `cd x &&`, behind leading whitespace, carrying global flags like `-C` or `-c` —
# because anchoring on the first character is a guard anyone can step around by accident.
GIT_FLAG='(-C[[:space:]]+[^[:space:]]+|-c[[:space:]]*[^[:space:]]+|--no-pager|--paginate|--git-dir=[^[:space:]]+|--work-tree=[^[:space:]]+|--namespace=[^[:space:]]+|--exec-path=[^[:space:]]*)'
WRITE_VERB='(merge|commit|add|rebase|reset|cherry-pick|push)'
if ! echo "$COMMAND" | grep -qE "(^|[;&|(]|[[:space:]])git([[:space:]]+$GIT_FLAG)*[[:space:]]+$WRITE_VERB([[:space:]]|$)"; then
  exit 0
fi

BRANCH=$(git branch --show-current 2>/dev/null)

for protected in $PROTECTED_BRANCHES; do
  if [ "$BRANCH" = "$protected" ]; then
    jq -n \
      --arg reason "Cannot run git write operations on protected branch '$BRANCH'. Switch to a feature branch first." \
      '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: $reason
        }
      }'
    exit 0
  fi
done

exit 0

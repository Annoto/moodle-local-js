#!/bin/bash
# Decide whether a shell command would run a git write in a checkout of a protected branch.
# The decision behind each agent tool's branch-guard hook: the Claude Code one is
# .claude/hooks/protect-branches.sh, and another tool's hook calls this script the same way.
#
# Usage: protected-target.sh "<protected branches, space-separated>" [<start dir>] <<<"$COMMAND"
# Prints the reason to deny, or nothing when the command may run; exits 0 either way.
#
# A best-effort guard against common local misuse; the forge's branch protection is the boundary.
# The command is walked in order from <start dir> (the session's working directory): `cd` and
# `pushd` move the current directory, and a git call's `-C` and `--git-dir` select its target. Paths
# are not expanded, so a target written with a variable, a command substitution, a partial quote,
# `cd -` or `~user` names no existing git worktree and the git write is denied; so is a detected git
# write the walk cannot place, and so is every git write in a command that runs `cd` or `pushd`
# inside a command substitution, whose scope the walk does not model. A backslash-newline joins two
# lines, as the shell reads them. A flag value with a space inside a quote or a substitution is read
# only when it starts with one: the walk cannot place that git write, so it is denied unless the walk
# places another git write in the same command. After other text (`-c user.name="A B"`), the git
# write goes unseen. The body of a heredoc with a quoted delimiter is literal text and is skipped once
# its terminator line is found, so a write in one fed to a shell goes unseen; other quoted text is
# read as code, so a git write it only mentions can be denied, a `git push` in markdown backticks
# included. A target is checked as it stands before the command runs, so a repository or worktree
# that an earlier part of the command creates (`git init`, `git clone`, `git worktree add`) is no
# worktree yet and a write into it is denied. A push is judged by the branch checked out where it
# runs, not by its refspec: `git push origin HEAD:main` from a feature branch is not denied. The walk
# does not model shell control flow (`||`, `popd`, subshell scope), a branch switch earlier in the
# same command, a git call after the first in one segment, a heredoc opened after another on the
# same line, a command substitution nested in another, or git spelled other than `git`.

PROTECTED_BRANCHES="$1"
START_DIR="${2:-$PWD}"
COMMAND=$(cat)

# With nothing protected there is nothing to deny, unparseable writes included.
[ -z "$PROTECTED_BRANCHES" ] && exit 0

# Drop the body of each heredoc whose delimiter is quoted: the shell passes it on as literal text.
# `<<<` is a here-string, not an opener.
QUOTED_HEREDOC='(^|[^<])<<(-?)[[:space:]]*('"'"'([^'"'"']+)'"'"'|"([^"]+)"|\\([^[:space:]]+))'
drop_literal_heredocs() {
  local line delim="" tabs="" body=""
  while IFS= read -r line; do
    if [ -n "$delim" ]; then
      body+="$line"$'\n'
      [ -n "$tabs" ] && line="${line#"${line%%[!$'\t']*}"}"
      if [ "$line" = "$delim" ]; then
        delim=""
        body=""
      fi
      continue
    fi
    printf '%s\n' "$line"
    if [[ "$line" =~ $QUOTED_HEREDOC ]]; then
      tabs="${BASH_REMATCH[2]}"
      delim="${BASH_REMATCH[4]}${BASH_REMATCH[5]}${BASH_REMATCH[6]}"
    fi
  done <<<"$1"
  # No line terminated it, so it was no heredoc (`<<'X'` in quotes or a comment): its lines are code.
  printf '%s' "$body"
}
COMMAND=$(drop_literal_heredocs "$COMMAND")
# A backslash-newline continues the command on the next line, as the shell reads it.
BACKSLASH_NEWLINE=$'\\\n'
COMMAND=${COMMAND//"$BACKSLASH_NEWLINE"/ }

# Only git write commands are checked. The git call is matched wherever it sits in the command
# line — after a `cd x &&`, inside `$(…)` or backticks, carrying global flags like `-C` or `-c`.
# A flag's value may start with a quote or a substitution holding spaces; the walk reads only its
# first word.
ARG='("[^"]*"|'"'"'[^'"'"']*'"'"'|\$\([^)]*\)[^[:space:]]*|`[^`]*`[^[:space:]]*|[^[:space:]]+)'
GIT_FLAG="(-C[[:space:]]+$ARG|-c[[:space:]]*$ARG|-p|-P|--(git-dir|work-tree|namespace)[[:space:]]+$ARG|--[[:alnum:]-]+(=$ARG?)?)"
WRITE_VERB='(merge|commit|add|rebase|reset|cherry-pick|revert|push)'
WRITE_VERBS=" merge commit add rebase reset cherry-pick revert push "
if ! echo "$COMMAND" | grep -qE "(^|[;&|(\`]|[[:space:]])git([[:space:]]+$GIT_FLAG)*[[:space:]]+$WRITE_VERB([[:space:];&|)\`<>]|$)"; then
  exit 0
fi

if echo "$COMMAND" | grep -qE '(^|[;&|(`[:space:]])(GIT_DIR|GIT_WORK_TREE)='; then
  echo "The command sets GIT_DIR or GIT_WORK_TREE, so the target branch of its git write cannot be determined."
  exit 0
fi

# The walk does not model a substitution's scope, so a directory change inside one cannot be placed.
if echo "$COMMAND" | grep -qE '(\$\(|`)[[:space:]]*(cd|pushd)([[:space:]]|$)'; then
  echo "The command changes directory inside a command substitution, so the target of its git write cannot be determined."
  exit 0
fi

# resolve <base-dir> <path> -> absolute path, without expanding anything but `~` and `~/`
resolve() {
  local base="$1" p="$2"
  if [[ "$p" =~ ^\'([^\']*)\'$ || "$p" =~ ^\"([^\"]*)\"$ ]]; then
    p="${BASH_REMATCH[1]}"
  fi
  [[ "$p" == "~" || "$p" == "~/"* ]] && p="$HOME${p#\~}"
  [[ "$p" != /* ]] && p="$base/$p"
  echo "$p"
}

# check_git <current dir> <tokens of one command segment, starting at the git token>
# Prints the deny reason and returns 1 for a write on a protected branch or an unplaceable target.
# Called in this shell, not in a substitution, so EVALUATED_WRITE and CHECKED survive it.
EVALUATED_WRITE=""
# The targets already checked and let through, one `<git dir>|<dir>` per line: each costs git calls,
# and a command can name the same one in hundreds of segments.
CHECKED=$'\n'
check_git() {
  local dir="$1"
  shift
  local git_dir="" verb="" i=1
  local toks=("$@")
  while [ $i -lt ${#toks[@]} ]; do
    local t="${toks[$i]}"
    case "$t" in
      -C) i=$((i + 1)); dir=$(resolve "$dir" "${toks[$i]}") ;;
      -c) i=$((i + 1)) ;;
      -c*) ;;
      --git-dir=*) git_dir=$(resolve "$dir" "${t#--git-dir=}") ;;
      --git-dir) i=$((i + 1)); git_dir=$(resolve "$dir" "${toks[$i]}") ;;
      --work-tree | --namespace) i=$((i + 1)) ;;
      -p | -P) ;;
      --*) ;;
      *) verb="${t%%[)\`<>]*}"; break ;;
    esac
    i=$((i + 1))
  done
  [[ "$WRITE_VERBS" == *" $verb "* ]] || return 0
  EVALUATED_WRITE=1
  local key="$git_dir|$dir"
  [[ "$CHECKED" == *$'\n'"$key"$'\n'* ]] && return 0

  local target="$dir" branch
  if [ -n "$git_dir" ]; then
    branch=$(git --git-dir="$git_dir" branch --show-current 2>/dev/null)
    target="$git_dir"
  else
    branch=$(git -C "$dir" branch --show-current 2>/dev/null)
  fi
  if ! git ${git_dir:+--git-dir="$git_dir"} -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
    echo "'git $verb' targets $target, which is not an existing git worktree, so it is denied."
    return 1
  fi
  for protected in $PROTECTED_BRANCHES; do
    if [ "$branch" = "$protected" ]; then
      echo "Cannot run 'git $verb' on protected branch '$branch' ($target). Switch to a feature branch first."
      return 1
    fi
  done
  CHECKED+="$key"$'\n'
  return 0
}

dir="$START_DIR"
# One command segment per line: split on every `;`, `&` and `|`, which covers each of the shell's
# separators (&& || ; | |& &), and on newlines. Parentheses are not split points, so a command
# substitution stays inside its segment, and a `cd` that closes a subshell (`(cd x)`) moves to a
# target with the `)` still on it, which is no worktree: the writes after it are denied.
# Words are split without a here-string, which costs a temp file per segment; globbing stays off.
set -f
while IFS= read -r segment; do
  toks=($segment)
  # A `cd` may follow a shell keyword or an opening paren: `if cd x; then …`, `{ cd x; …`, `(cd x && …)`.
  k=0
  while [[ "${toks[$k]}" =~ ^(if|then|elif|else|do|while|until|time|!|\{)$ ]]; do k=$((k + 1)); done
  case "${toks[$k]#\(}" in
    cd | pushd)
      if [ ${#toks[@]} -lt $((k + 2)) ]; then
        dir=$(resolve "$dir" "~")
      else
        dir=$(resolve "$dir" "${toks[$((k + 1))]}")
      fi
      continue
      ;;
  esac
  for ((g = 0; g < ${#toks[@]}; g++)); do
    # `git`, or `git` right after a quote, `$(` or a backtick: a call inside a substitution.
    if [[ "${toks[$g]}" =~ (^|[^[:alnum:]_./-])git$ ]]; then
      check_git "$dir" "${toks[@]:$g}" || exit 0
      break
    fi
  done
done < <(printf '%s\n' "$COMMAND" | awk '{ gsub(/[;&|]/, "\n"); print }')

if [ -z "$EVALUATED_WRITE" ]; then
  echo "The command holds a git write this guard cannot parse, so it is denied. Write the git call as a plain command."
fi
exit 0

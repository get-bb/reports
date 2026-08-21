#!/bin/zsh
# Run a bb:dev CLI command against the verifier's own dev instance.
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-9 || exit 1
eval "$(scripts/bb-dev-app env)"
exec "$@"

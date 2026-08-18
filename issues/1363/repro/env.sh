# Derive everything from the bb worktree's own dev instance. Nothing here is
# specific to one machine: WT is the bb checkout whose `scripts/bb-dev-app
# current` you started (defaults to the git toplevel of the shell's cwd, or
# set BB_WT=/path/to/bb explicitly), and the URLs/data dir come from
# `scripts/bb-dev-app status`.
export WT=${BB_WT:-$(git rev-parse --show-toplevel 2>/dev/null)}
if [ -z "$WT" ] || [ ! -x "$WT/scripts/bb-dev-app" ]; then
  echo "env.sh: set BB_WT to your bb worktree (or cd into it) before sourcing" >&2
  return 1 2>/dev/null || exit 1
fi
_status=$("$WT/scripts/bb-dev-app" status 2>/dev/null)
export BB_SERVER_URL=$(printf '%s\n' "$_status" | awk '/^Server:/{print $2}')
export BB_APP_URL=$(printf '%s\n' "$_status" | awk '/^App:/{print $2}')
export BB_HOST_DAEMON_URL=$(printf '%s\n' "$_status" | awk '/^Host daemon:/{print $3}')
export BB_DATA_DIR=$(printf '%s\n' "$_status" | awk '/^Data dir:/{print $3}')
export BB_DEV_LOG=$(printf '%s\n' "$_status" | awk -F': ' '/^Logs:/{print $2}' | cut -d, -f1)
unset _status
bb() { node "$WT/packages/scripts/dist/commands/run-cli.js" "$@"; }
# The host id of the daemon that belongs to this dev instance (first machine).
bb_host_id() { bb machine list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const m=Array.isArray(j)?j:(j.machines||j.hosts||[]);console.log((m[0]||{}).id||"")})'; }

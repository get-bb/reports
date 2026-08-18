#!/bin/bash
# Sum RSS of all descendants of the daemon, grouped by kind.
bash "$(dirname "$0")/procs.sh" | awk '
/^[0-9]+ +[0-9]+ +[0-9]+/ {
  kind="other";
  if ($0 ~ /\[bridge\] provider-codex/) kind="codex-bridge";
  else if ($0 ~ /\[bridge\] provider-claude-code/) kind="claude-bridge";
  else if ($0 ~ /codex app-server/) kind="codex-app-server";
  else if ($0 ~ /\/claude /) kind="claude-cli";
  else if ($0 ~ /code-mode|codex-code/) kind="code-mode-host";
  rss[kind]+=$3; n[kind]++; total+=$3;
}
END { for (k in rss) printf "%-18s n=%d rss=%.0f MB\n", k, n[k], rss[k]/1024; printf "TOTAL rss=%.0f MB\n", total/1024 }'

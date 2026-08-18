#!/usr/bin/env bash
# Is `gh auth token` a network-free way to tell "no credentials configured"
# apart from "credentials exist but the API probe failed"?
echo "== gh auth token, offline (dead proxy) =="
HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 /home/sawyer/.local/bin/gh auth token | sed 's/gho_.*/gho_<redacted>/'; echo "exit=${PIPESTATUS[0]}"
echo "== gh auth token, no config at all (empty GH_CONFIG_DIR) =="
GH_CONFIG_DIR=$(mktemp -d) /home/sawyer/.local/bin/gh auth token; echo "exit=$?"
echo "== gh auth status, no config at all =="
GH_CONFIG_DIR=$(mktemp -d) /home/sawyer/.local/bin/gh auth status; echo "exit=$?"

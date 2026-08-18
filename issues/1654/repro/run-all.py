#!/usr/bin/env python3
"""Runs stale-oauth-repro.mjs in each mode and saves the logs next to this file.

Usage: python3 run-all.py <path to the copied repro-1654.mjs>
The .mjs must be copied into plugins/provider-claude-code/ of a built bb checkout
(it imports @anthropic-ai/claude-agent-sdk from that package's node_modules).

Binary selection mirrors bb: the script's default is `claude` on PATH (what bb's
resolveClaudeCodeExecutable picks, 2.1.234 on this machine). REPRO_CLAUDE_BIN=sdk-bundled
forces the Agent SDK's own bundled CLI (2.1.197 for SDK 0.3.197), which bb does NOT use;
it is included only for comparison.
"""
import os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 2:
    sys.exit("usage: run-all.py <path to plugins/provider-claude-code/repro-1654.mjs>")
script = sys.argv[1]
runs = [
    ("default-2.1.234", {}),                                                # PATH claude = 2.1.234 (what bb spawns)
    ("preserve-mtime-2.1.234", {"REPRO_MODE": "preserve-mtime"}),
    ("preserve-mtime-2.1.233", {"REPRO_MODE": "preserve-mtime", "REPRO_CLAUDE_BIN": os.path.expanduser("~/.local/share/claude/versions/2.1.233")}),
    ("default-sdk-bundled-2.1.197", {"REPRO_CLAUDE_BIN": "sdk-bundled"}),   # comparison only
    ("preserve-mtime-sdk-bundled-2.1.197", {"REPRO_MODE": "preserve-mtime", "REPRO_CLAUDE_BIN": "sdk-bundled"}),
]
for name, extra in runs:
    env = dict(os.environ)
    env.update(extra)
    p = subprocess.run(["node", script], env=env, capture_output=True, text=True, timeout=600, cwd="/tmp")
    out = p.stdout + p.stderr
    with open(os.path.join(here, f"run-{name}.log"), "w") as f:
        f.write(f"$ {' '.join(k + '=' + v for k, v in extra.items())} node repro-1654.mjs\n(exit={p.returncode})\n\n" + out)
    tail = [l for l in p.stdout.splitlines() if l.startswith("[repro]") or l.startswith("BUG") or l.startswith("NOT")]
    print("=====", name, "exit", p.returncode)
    print("\n".join(tail[-6:]))

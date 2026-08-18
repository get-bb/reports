#!/usr/bin/env python3
"""Runs stale-oauth-repro.mjs in its three modes and saves the logs next to this file.

The .mjs must be copied into plugins/provider-claude-code/ (it imports
@anthropic-ai/claude-agent-sdk from that package's node_modules).
"""
import os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
script = sys.argv[1] if len(sys.argv) > 1 else "/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-14/plugins/provider-claude-code/repro-1654.mjs"
runs = [
    ("default-2.1.234", {}),
    ("preserve-mtime-2.1.234", {"REPRO_MODE": "preserve-mtime"}),
    ("preserve-mtime-2.1.233", {"REPRO_MODE": "preserve-mtime", "REPRO_CLAUDE_BIN": os.path.expanduser("~/.local/share/claude/versions/2.1.233")}),
]
for name, extra in runs:
    env = dict(os.environ)
    env.update(extra)
    p = subprocess.run(["node", script], env=env, capture_output=True, text=True, timeout=280, cwd="/tmp")
    out = p.stdout + p.stderr
    with open(os.path.join(here, f"run-{name}.log"), "w") as f:
        f.write(f"$ {' '.join(k + '=' + v for k, v in extra.items())} node repro-1654.mjs\n(exit={p.returncode})\n\n" + out)
    tail = [l for l in p.stdout.splitlines() if l.startswith("[repro]") or l.startswith("BUG") or l.startswith("NOT")]
    print("=====", name, "exit", p.returncode)
    print("\n".join(tail[-6:]))

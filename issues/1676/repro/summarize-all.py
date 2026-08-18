#!/usr/bin/env python3
"""Summarize every probe-*.out in this directory into probe-summaries.txt."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = [
    "probe-home-natural",
    "probe-tasks",
    "probe-thread",
    "probe-thread-delayed",
    "probe-plugin-route-delayed",
    "probe-thread-loading-models",
    "probe-thread-reasoning-snap",
    "probe-sidebar-delayed",
    "probe-pr1677-tasks-run1",
    "probe-pr1677-tasks-run2",
]
out = []
for name in NAMES:
    path = os.path.join(HERE, name + ".out")
    if not os.path.exists(path):
        continue
    txt = open(path).read()
    out.append("=== " + name)
    lines = txt.splitlines()
    if lines:
        out.append(lines[0])
    try:
        start = txt.index("[")
        end = txt.rindex("]") + 1
        for s in json.loads(txt[start:end]):
            out.append(
                "%6d ms  pulse=%-2d header=%-8r %s  main=%r"
                % (s["t"], s["pulse"], s["header"], s["markers"], s.get("main", "")[:110])
            )
        out.append(txt[end:].strip())
    except ValueError:
        out.append(txt)
    out.append("")
open(os.path.join(HERE, "probe-summaries.txt"), "w").write("\n".join(out))
print("\n".join(out))

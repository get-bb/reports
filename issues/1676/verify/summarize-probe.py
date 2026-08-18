#!/usr/bin/env python3
"""Summarize db-probe.js output: one line per DOM transition."""
import json
import sys

txt = sys.stdin.read()
lines = txt.splitlines()
if lines:
    print(lines[0])
start = txt.index("[")
end = txt.rindex("]") + 1
for s in json.loads(txt[start:end]):
    print(
        s["t"],
        "pulse=%d" % s["pulse"],
        "header=%r" % s["header"],
        s["markers"],
        "main=%r" % s["main"],
    )
print(txt[end:].strip())

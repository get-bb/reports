#!/usr/bin/env python3
"""Interleaved sample: 10x with the daemon's full header set vs 10x with only
Authorization, against https://chatgpt.com/backend-api/transcribe, no cookies.
Prints status per attempt and a tally. Token never printed."""
import json, os, subprocess

d = json.load(open(os.path.expanduser("~/.codex/auth.json")))
tok = d["tokens"]["access_token"]
acct = d["tokens"]["account_id"]
here = os.path.dirname(os.path.abspath(__file__))
url = "https://chatgpt.com/backend-api/transcribe"
full = ["-H", f"Authorization: Bearer {tok}", "-H", f"chatgpt-account-id: {acct}", "-H", "originator: bb"]
authonly = ["-H", f"Authorization: Bearer {tok}"]
tally = {"full-daemon-headers": {}, "authorization-only": {}}
for i in range(10):
    for name, extra in (("full-daemon-headers", full), ("authorization-only", authonly)):
        cmd = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-A", "bb-host-daemon", "-X", "POST", url,
               "-F", f"file=@{here}/tone.mp3", "-F", "model=gpt-transcribe"] + extra
        code = subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
        tally[name][code] = tally[name].get(code, 0) + 1
        print(f"attempt {i+1:2d} {name:22s} HTTP {code}")
print("tally:", json.dumps(tally))

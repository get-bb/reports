#!/usr/bin/env python3
"""Is there a transcription endpoint under the (un-challenged) /backend-api/codex
prefix? Probe a few candidate paths with full auth headers."""
import json, os, subprocess

d = json.load(open(os.path.expanduser("~/.codex/auth.json")))
tok = d["tokens"]["access_token"]
acct = d["tokens"]["account_id"]
here = os.path.dirname(os.path.abspath(__file__))
for url in [
    "https://chatgpt.com/backend-api/codex/transcribe",
    "https://chatgpt.com/backend-api/codex/audio/transcriptions",
    "https://chatgpt.com/backend-api/codex/v1/audio/transcriptions",
    "https://chatgpt.com/backend-api/transcribe",
]:
    cmd = ["curl", "-s", "-o", "/tmp/1587-body.txt", "-D", "-", "-A", "bb-host-daemon", "-X", "POST", url,
           "-F", f"file=@{here}/tone.mp3", "-F", "model=gpt-transcribe",
           "-H", f"Authorization: Bearer {tok}", "-H", f"chatgpt-account-id: {acct}", "-H", "originator: bb"]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    hdr = [l.strip() for l in out.splitlines() if l.lower().startswith(("http/", "cf-mitigated"))]
    body = open("/tmp/1587-body.txt").read()[:90].replace("\n", " ")
    print(f"{url:62s} {' '.join(hdr):34s} body={body}")

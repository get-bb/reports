#!/usr/bin/env python3
"""Isolate which request header makes Cloudflare stop challenging
https://chatgpt.com/backend-api/transcribe. Runs curl with the same
multipart body as the daemon. Token/account come from ~/.codex/auth.json and
are never printed."""
import json, os, subprocess

d = json.load(open(os.path.expanduser("~/.codex/auth.json")))
tok = d["tokens"]["access_token"]
acct = d["tokens"]["account_id"]
here = os.path.dirname(os.path.abspath(__file__))
url = "https://chatgpt.com/backend-api/transcribe"
variants = {
    "auth+account+originator": ["-H", f"Authorization: Bearer {tok}", "-H", f"chatgpt-account-id: {acct}", "-H", "originator: bb"],
    "auth+account": ["-H", f"Authorization: Bearer {tok}", "-H", f"chatgpt-account-id: {acct}"],
    "auth+originator=bb": ["-H", f"Authorization: Bearer {tok}", "-H", "originator: bb"],
    "auth+originator=codex_cli_rs": ["-H", f"Authorization: Bearer {tok}", "-H", "originator: codex_cli_rs"],
    "auth only": ["-H", f"Authorization: Bearer {tok}"],
    "account only (no auth)": ["-H", f"chatgpt-account-id: {acct}"],
    "originator only (no auth)": ["-H", "originator: bb"],
    "nothing": [],
}
for name, extra in variants.items():
    cmd = ["curl", "-s", "-o", "/tmp/1587-body.txt", "-D", "-", "-A", "bb-host-daemon", "-X", "POST", url,
           "-F", f"file=@{here}/tone.mp3", "-F", "model=gpt-transcribe"] + extra
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    hdr = [l.strip() for l in out.splitlines() if l.lower().startswith(("http/", "cf-mitigated"))]
    body = open("/tmp/1587-body.txt").read()[:70].replace("\n", " ")
    print(f"{name:30s} {' '.join(hdr):36s} body={body}")

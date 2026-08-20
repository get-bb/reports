#!/usr/bin/env python3
"""Extract the code excerpts that back the Codex Desktop claims in get-bb/bb#1984.

Run from the directory where app.asar was extracted (npx @electron/asar extract app.asar app && cd app).
Writes to stdout.
"""
import re

print("Excerpts from ChatGPT/Codex Desktop Linux deb chatgpt_26.818.21641_amd64.deb -> /usr/lib/chatgpt/resources/app.asar")
print("(https://persistent.oaistatic.com/codex-app-prod/linux/deb/pool/main/c/chatgpt/chatgpt_26.818.21641_amd64.deb)\n")

def show(f, pat, before, after, n=1, title=None):
    s = open(f, encoding="utf8", errors="replace").read()
    for m in list(re.finditer(pat, s))[:n]:
        print("=" * 8, title or pat, "in", f, "@", m.start())
        print(s[max(0, m.start() - before):m.start() + after]); print()

M = ".vite/build/main-Cwjv9Ibf.js"; S = ".vite/build/src-PzwkD6WC.js"; W = "webview/assets/app-initial-DAkTNeXg.js"
show(M, r"isFullReconciliationDue\(e\)\{", 0, 90, title="isFullReconciliationDue")
show(M, r"requestStartupSync\(\)\{", 0, 330, title="requestStartupSync (only caller that can request a `full` scan)")
show(M, r"function d8\(e,t,r\)", 0, 420, title="incremental catalog page source: listThreads({archived:false,...})")
show(M, r"handleNotification\(e\)\{if\(this\.disposed\)return", 0, 420, title="catalog coordinator handleNotification -> applyAuthoritativeRemoval on thread/archived")
show(M, r"applyAuthoritativeRemoval\(e\)\{", 0, 420, title="applyAuthoritativeRemoval: DELETE FROM local_thread_catalog")
show(S, r"\"thread-archived\":2", 200, 200, title="IPC broadcast version table (thread-archived => version 2)")
show(S, r"async sendBroadcast\(e,t,\{targetClientIds:n\}=\{\}\)", 0, 520, title="IpcClient.sendBroadcast wire shape")
show(S, r"function g9\(e\)\{", 0, 160, title="frame encoding: u32 LE length prefix + JSON")
show(S, r"handleBroadcast\(e,t\)\{let n=t\.targetClientIds", 0, 520, title="IpcRouter.handleBroadcast: forwards to every registered client except sender")
show(S, r"async function dce\(e,t\)\{", 0, 200, title="receiver drops broadcasts whose version != expected")
show(W, r"broadcastThreadArchived\(\{hostId", 200, 260, title="webview archive flow: params {hostId, conversationId, cwd}")
show(W, r"handleThreadArchived\(e\)\{", 0, 200, title="webview IPC receiver: invalidate search + evict (in-memory suppression)")
show(W, r"evictConversation\(e,t\)\{switch", 0, 330, title="evictConversation archive-notification => suppressArchivedConversation + removeThreadSummary")
show(W, r"suppressArchivedConversation\(e\)\{", 0, 330, title="suppressedArchivedConversationIds is an in-memory Set")

#!/usr/bin/env bash
# Send an MCP initialize to the built provider-acp host.js artifact run with --mcp-stdio.
H=/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_d5c47f31-487-9-e05387e65c7f/plugin-host-artifacts/provider-acp/d16f036bcc586f1473fc1c89805009018085122c6ca269f158aacb5c0188e406/host.js
export BB_ACP_DYNAMIC_TOOL_HOST=127.0.0.1 BB_ACP_DYNAMIC_TOOL_PORT=1 BB_ACP_DYNAMIC_TOOL_TOKEN=x BB_ACP_DYNAMIC_TOOL_THREAD_ID=t BB_ACP_DYNAMIC_TOOLS='[]'
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"0"}}}' | timeout 10 node "$H" --mcp-stdio

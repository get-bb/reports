#!/bin/bash
cd /home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-7/apps/app
nohup pnpm exec vite preview --config vite.preview-1615.config.ts > /tmp/bb-reports/issues/1615/verify/rev2-preview.log 2>&1 &
echo $! > /tmp/bb-reports/issues/1615/verify/rev2-preview.pid
sleep 6
cat /tmp/bb-reports/issues/1615/verify/rev2-preview.log
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:17793/

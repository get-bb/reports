W=/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-11
A=$W/packages/bb-app/app/dist/assets
kill $(cat /tmp/bb-reports/issues/1603/verify/prod-app.pid) 2>/dev/null; sleep 3
node /tmp/bb-reports/issues/1603/repro/patch-lookbehind-experiment.mjs $A restore
mv /tmp/bb-1603-verify-precomp/* $A/ && rmdir /tmp/bb-1603-verify-precomp
rm -rf /tmp/bb-1603-proddata
pkill -f "$W" ; sleep 1
ss -ltn | grep -E ':(45031|45032) ' || echo "ports 45031/45032 free"
cd $W && git status --short | head

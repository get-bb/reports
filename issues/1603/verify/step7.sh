set -e
W=/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-11
A=$W/packages/bb-app/app/dist/assets
mkdir -p /tmp/bb-1603-verify-precomp
mv $A/workspace-checkout-display-*.js.br $A/workspace-checkout-display-*.js.gz $A/worker-portable-*.js.br $A/worker-portable-*.js.gz /tmp/bb-1603-verify-precomp/
node /tmp/bb-reports/issues/1603/repro/patch-lookbehind-experiment.mjs $A --unfold
kill $(cat /tmp/bb-reports/issues/1603/verify/prod-app.pid); sleep 3
bash /tmp/bb-reports/issues/1603/verify/start-prod-app.sh $W
bash /tmp/bb-reports/issues/1603/repro/run-old-webkit160.sh wk-load-and-wait.mjs http://localhost:45031/ /tmp/bb-reports/issues/1603/verify/wk160-patched 15000 | cut -c1-400 | head -12

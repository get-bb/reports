Repro artifacts for get-bb/bb#1545 (base commit 16ceb3a54)

fake-login-shell            Wrapper used as $SHELL so the host daemon's login-shell PATH probe
                            yields a PATH whose only Node is Volta's shim (VOLTA_HOME=/tmp/bb-1545-volta).
check-daemon-env.sh         Shows that the running host daemon carries _VOLTA_TOOL_RECURSION=1.
make-qa-repo.sh             Creates the scratch git repo used as the bb project.
bb-cli-in-agent-shell.sh    Simulates the agent-shell env (PATH/BB_CLI) and shows node, $BB_CLI and bb failing.
browser-screenshots.js      dev-browser script that captured the two screenshots.
volta-recursion-guard.repro.test.ts
                            Vitest repro for packages/process-utils (FAILS on main, passes with the fix).
proposed-fix.diff           One-hunk fix in packages/process-utils/src/index.ts.

Full sequence:
  export VOLTA_HOME=/tmp/bb-1545-volta
  curl -sSf https://get.volta.sh | bash -s -- --skip-setup            # installs Volta 2.0.2 into $VOLTA_HOME
  PATH=$VOLTA_HOME/bin:/usr/bin:/bin volta install node@24
  export _VOLTA_TOOL_RECURSION=1 SHELL=/tmp/bb-1545-volta/fake-login-shell
  scripts/bb-dev-app current                                          # daemon inherits the guard
  ./make-qa-repo.sh ; create project via curl ; spawn claude-code thread with the prompt in the report

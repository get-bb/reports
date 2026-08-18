#!/bin/bash
cd /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-16
export BB_SERVER_URL=http://localhost:21171 BB_HOST_DAEMON_PORT=29171 BB_PROJECT_ID=proj_personal
bb() { echo "\$ bb $*"; node packages/scripts/dist/commands/run-cli.js "$@"; echo "exit $?"; }
bb plugin install builtin:tasks --yes
bb tasks folder create --name "Old stuff"
bb tasks folder create --name "Archive" --parent "Old stuff"
bb tasks project create --name Alpha --prefix ALP --folder "Old stuff"
bb tasks folder --help
bb tasks folder delete "Old stuff"
bb tasks folder list
bb tasks label create --project ALP --name bug

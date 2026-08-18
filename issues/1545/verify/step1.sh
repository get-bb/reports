#!/bin/bash
export VOLTA_HOME=/tmp/bb-1545v-volta
curl -sSf https://get.volta.sh | bash -s -- --skip-setup 2>&1 | tail -5
export PATH=$VOLTA_HOME/bin:/usr/local/bin:/usr/bin:/bin
volta install node@24 2>&1 | tail -3
volta list | head -1
node --version
_VOLTA_TOOL_RECURSION=1 node --version; echo exit=$?

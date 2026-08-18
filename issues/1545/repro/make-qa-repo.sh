#!/bin/bash
set -e
mkdir -p /tmp/bb-1545-qa-repo
cd /tmp/bb-1545-qa-repo
git init -q
echo hi > README.md
git add -A
git -c user.email=qa@example.com -c user.name=qa commit -qm init
echo created /tmp/bb-1545-qa-repo

#!/bin/zsh
export _ZO_DOCTOR=0
cd /tmp/bb-2072-scratch/bb-plugin-toasty || exit 1
npx tsc --noEmit
echo "tsc exit=$?"

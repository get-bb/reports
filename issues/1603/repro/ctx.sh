#!/bin/bash
cd "$1"
shift
for p in "$@"; do echo "##### $p"; grep -oE -- ".{0,120}$p.{0,120}" *.js | head -4 | cut -c1-420; done

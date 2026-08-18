#!/usr/bin/env bash
until [ "$(grep -c 'restarted\|failed to restart' /tmp/bb1558-two/launcher-variant.log)" -ge 2 ] || ! kill -0 "$1" 2>/dev/null; do sleep 3; done
sed 's/\x1b\[[0-9;]*[A-Za-z]//g' /tmp/bb1558-two/launcher-variant.log | grep -v '^\[.*INFO\|^\[.*WARN' | head -80

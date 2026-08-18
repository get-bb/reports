#!/usr/bin/env bash
# Sample scheduler state + kernel wait channel of the bb server, daemon and hog
# processes from outside the cgroup. usage: wchan-sample.sh <serverPid> <daemonPid> <hogPid> <samples>
S=$1; D=$2; H=$3; N=$4
for i in $(seq 1 $N); do
  printf '%s server(%s) state=%s wchan=%s | daemon(%s) state=%s wchan=%s | hog(%s) state=%s wchan=%s\n' \
    "$(date +%T.%N | cut -c1-12)" \
    "$S" "$(awk '{print $3}' /proc/$S/stat 2>/dev/null)" "$(cat /proc/$S/wchan 2>/dev/null)" \
    "$D" "$(awk '{print $3}' /proc/$D/stat 2>/dev/null)" "$(cat /proc/$D/wchan 2>/dev/null)" \
    "$H" "$(awk '{print $3}' /proc/$H/stat 2>/dev/null)" "$(cat /proc/$H/wchan 2>/dev/null)"
  sleep 0.25
done

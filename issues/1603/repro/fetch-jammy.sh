#!/usr/bin/env bash
# Download jammy (Ubuntu 22.04) runtime libs needed by the Safari-16.4-era
# Playwright WebKit build, and extract them into /tmp/bb-1603-wk/oldroot.
set -e
cd /tmp/bb-1603-wk
mkdir -p olddebs oldroot
if [ ! -f jammy-Packages ]; then
  curl -sSL http://archive.ubuntu.com/ubuntu/dists/jammy/main/binary-amd64/Packages.gz | gunzip > jammy-Packages
fi
for pkg in "$@"; do
  path=$(awk -v p="$pkg" '$1=="Package:"{cur=$2} $1=="Filename:" && cur==p {print $2}' jammy-Packages | head -1)
  if [ -z "$path" ]; then echo "NOT FOUND: $pkg"; continue; fi
  f=olddebs/$(basename "$path")
  [ -f "$f" ] || curl -sSL -o "$f" "http://archive.ubuntu.com/ubuntu/$path"
  dpkg-deb -x "$f" oldroot
  echo "ok $pkg -> $path"
done
# also reuse the resolute libs already extracted for the new webkit
cp -a --update=none root/usr/lib/x86_64-linux-gnu/. oldroot/usr/lib/x86_64-linux-gnu/ 2>/dev/null || true

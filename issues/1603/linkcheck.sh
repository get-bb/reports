#!/usr/bin/env bash
cd /tmp/bb-reports/issues
grep -o 'href="[^"#]*"\|src="[^"]*"' 1603.html | sed 's/.*="\(.*\)"/\1/' | grep -v '^http\|^\.\./' | sort -u | while read -r f; do [ -e "$f" ] || echo "MISSING $f"; done
echo linkcheck done

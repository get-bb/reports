#!/bin/zsh
cd /tmp/bb-reports/issues
grep -o 'src="[^"]*"\|href="[^"]*"' 2166.html | grep -v "github.com" | sort -u
echo ---
for f in $(grep -o 'src="[^"]*"\|href="2166/[^"]*"' 2166.html | sed 's/.*="\(.*\)"/\1/' | sort -u); do
  if [ -e "/tmp/bb-reports/issues/$f" ]; then echo "OK $f"; else echo "MISSING $f"; fi
done
echo ---
grep -n "<h2" 2166.html | sed 's/<[^>]*>//g'
echo --- appendix
sed -n '/9. Appendix/,$p' /tmp/2166-text.txt | grep -n "Commands\|commands\|^\s*\$ " | head -30

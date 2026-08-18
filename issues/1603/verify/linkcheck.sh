cd /tmp/bb-reports/issues
while read h; do test -e "$h" || echo "MISSING $h"; done < /tmp/bb-reports/issues/1603/verify/links.txt
echo linkcheck-done

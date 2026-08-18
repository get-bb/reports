import re, os
s = open('/tmp/bb-reports/issues/1719.html').read()
for m in sorted(set(re.findall(r'(?:src|href)="((?:1719/|assets/)[^"]*)"', s))):
    print(('OK      ' if os.path.exists('/tmp/bb-reports/issues/' + m) else 'MISSING ') + m)

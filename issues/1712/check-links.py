import re, os
base='/tmp/bb-reports/issues/'
s=open(base+'1712.html').read()
missing=[]
for m in set(re.findall(r'(?:href|src)="((?:1712/|assets/)[^"]*)"', s)):
    if not os.path.exists(base+m): missing.append(m)
print('missing:', missing)
import html.parser
html.parser.HTMLParser().feed(s)
print('parsed ok', len(s))

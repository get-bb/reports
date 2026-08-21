import re, os, sys
base = "/tmp/bb-reports/issues"
s = open(os.path.join(base, "2093.html")).read()
links = sorted(set(re.findall(r'(?:href|src)="([^"]+)"', s)))
for l in links:
    if l.startswith("http"):
        print("URL ", l)
    elif l.startswith("#"):
        anchor = l[1:]
        print("ANCH", l, "ok" if re.search(r'id="%s"' % re.escape(anchor), s) else "MISSING")
    else:
        p = os.path.join(base, l)
        print("OK  " if os.path.exists(p) else "MISSING", l)

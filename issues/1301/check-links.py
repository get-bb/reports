import re, pathlib
root = pathlib.Path("/tmp/bb-reports/issues")
doc = (root / "1301.html").read_text()
for m in sorted(set(re.findall(r'(?:src|href)="((?:assets|1301)/[^"]*)"', doc))):
    print(("ok " if (root / m).exists() else "MISSING ") + m)

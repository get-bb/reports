import re, pathlib
html = pathlib.Path("/tmp/bb-reports/issues/2066.html").read_text()
missing = []
for m in sorted(set(re.findall(r'(?:href|src)="((?:2066/repro|assets)/[^"]*)"', html))):
    if not pathlib.Path("/tmp/bb-reports/issues", m).exists():
        missing.append(m)
print("missing:", missing)

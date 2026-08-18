#!/bin/bash
set -e
D=/home/sawyer/.bb-dev/1615-qa-v2
rm -rf $D; mkdir -p $D; cd $D; git init -q
python3 - <<'PY'
import os, csv
os.makedirs("data", exist_ok=True)
with open("data/big.csv","w",newline="") as f:
    w=csv.writer(f)
    w.writerow([f"col_{c}" for c in range(120)])
    for r in range(600):
        w.writerow([f"r{r}c{c}" for c in range(120)])
os.makedirs("manyfiles", exist_ok=True)
for i in range(5000):
    open(f"manyfiles/file_{i:05d}.txt","w").write("x")
PY
git add data && git -c user.email=qa@example.com -c user.name=qa commit -qm init && git log --oneline

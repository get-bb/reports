#!/usr/bin/env bash
# Does a bash shim that sleeps past execFile's timeout still reach its log line?
cat > /tmp/bb-reports/issues/1758/verify/slowchild.sh <<'EOF'
#!/usr/bin/env bash
sleep 6
echo "$(date +%T) survived args=$*" >> /tmp/bb-reports/issues/1758/verify/slowtest.log
EOF
chmod +x /tmp/bb-reports/issues/1758/verify/slowchild.sh
rm -f /tmp/bb-reports/issues/1758/verify/slowtest.log
date +%T
node -e '
const {execFile}=require("child_process");
execFile("/tmp/bb-reports/issues/1758/verify/slowchild.sh",["--version"],{timeout:2000},(e,o,s)=>{console.log("cb", e&&e.message, "killed=",e&&e.killed, e&&e.signal);});
'
sleep 7
cat /tmp/bb-reports/issues/1758/verify/slowtest.log 2>/dev/null || echo "no log line: bash died on SIGTERM"

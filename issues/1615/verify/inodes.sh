#!/bin/bash
ls -d /tmp/*/ /tmp/.*/ 2>/dev/null | while read d; do n=$(find "$d" 2>/dev/null | wc -l); if [ "$n" -gt 5000 ]; then echo "$n $d"; fi; done | sort -n | tail -20

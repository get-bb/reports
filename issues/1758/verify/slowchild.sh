#!/usr/bin/env bash
sleep 6
echo "$(date +%T) survived args=$*" >> /tmp/bb-reports/issues/1758/verify/slowtest.log

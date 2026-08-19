#!/usr/bin/env bash
# Turn on the built-in workflows plugin on the investigation dev instance.
curl -s -X POST http://localhost:19386/api/v1/plugins/workflows/enable
echo

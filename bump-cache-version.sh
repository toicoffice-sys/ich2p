#!/bin/bash
# Stamps a fresh cache-busting version onto every css/style.css and js/main.js
# reference across all HTML pages, using the current timestamp. Run this
# before every deploy/upload if either file changed — removes the failure
# mode where a manually-maintained ?v=N number gets forgotten and browsers
# keep serving a stale cached copy indefinitely.
set -euo pipefail
cd "$(dirname "$0")"

STAMP=$(date +%Y%m%d%H%M%S)

grep -rl 'style\.css?v=[0-9]*' --include="*.html" . | xargs sed -i '' "s/style\.css?v=[0-9]*/style.css?v=${STAMP}/g"
grep -rl 'main\.js?v=[0-9]*' --include="*.html" . | xargs sed -i '' "s/main\.js?v=[0-9]*/main.js?v=${STAMP}/g"

echo "Bumped cache-busting version to ${STAMP} across all pages."

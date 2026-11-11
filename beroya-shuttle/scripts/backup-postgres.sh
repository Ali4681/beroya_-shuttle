#!/bin/sh
set -eu
mkdir -p backups
STAMP=$(date +%Y%m%d)
pg_dump "$DATABASE_URL" -F c -f "backups/beroya-${STAMP}.dump"
echo "Wrote backups/beroya-${STAMP}.dump"

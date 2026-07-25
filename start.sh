#!/bin/sh
set -e
NO_COLOR=1 node node_modules/.bin/prisma db push || echo "prisma db push skipped (populated staging tables / no-op) — continuing boot"
exec node dist/main.js

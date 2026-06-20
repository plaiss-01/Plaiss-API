#!/bin/sh
set -e
NO_COLOR=1 node node_modules/.bin/prisma migrate deploy
exec node dist/main.js

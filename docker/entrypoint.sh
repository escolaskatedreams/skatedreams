#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate

echo "Starting Next.js..."
exec node node_modules/.bin/next start -p 3000

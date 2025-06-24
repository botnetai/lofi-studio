#!/bin/bash

# Run migration for adding video status field
# This script should be run via wrangler d1 execute

echo "Running video status migration..."

# Run the migration using wrangler
bunx wrangler d1 execute lofi-studio-db --local --file=./migrations/add-video-status.sql

echo "Migration complete!"
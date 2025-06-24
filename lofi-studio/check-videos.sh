#!/bin/bash

echo "=== Checking Videos in Database ==="
echo "Querying videos table..."
bunx wrangler d1 execute lofi-studio-db --command="SELECT id, url, artwork_id, created_at, json_extract(metadata, '$.model') as model FROM videos ORDER BY created_at DESC LIMIT 10"

echo -e "\n=== Checking R2 Storage ==="
echo "Listing video files in R2..."
bunx wrangler r2 object list lofi-studio-storage --prefix="videos/"

echo -e "\n=== Checking Recent Video Generation Attempts ==="
echo "Looking for any video-related entries..."
bunx wrangler d1 execute lofi-studio-db --command="SELECT COUNT(*) as total_videos FROM videos"

echo -e "\n=== Checking if videos table exists ==="
bunx wrangler d1 execute lofi-studio-db --command="SELECT name FROM sqlite_master WHERE type='table' AND name='videos'"

echo -e "\n=== Checking artwork table for comparison ==="
bunx wrangler d1 execute lofi-studio-db --command="SELECT COUNT(*) as total_artwork FROM artwork"
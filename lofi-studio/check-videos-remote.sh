#!/bin/bash

echo "=== Checking Videos in REMOTE Database ==="
echo "Querying videos table..."
bunx wrangler d1 execute lofi-studio-db --remote --command="SELECT id, url, artwork_id, created_at, json_extract(metadata, '$.model') as model FROM videos ORDER BY created_at DESC LIMIT 10"

echo -e "\n=== Counting videos in REMOTE database ==="
bunx wrangler d1 execute lofi-studio-db --remote --command="SELECT COUNT(*) as total_videos FROM videos"

echo -e "\n=== Checking R2 Storage for videos ==="
echo "Listing all objects with 'video' prefix..."
bunx wrangler r2 object list lofi-studio-storage --prefix videos/

echo -e "\n=== Checking recent songs for comparison ==="
bunx wrangler d1 execute lofi-studio-db --remote --command="SELECT COUNT(*) as total_songs FROM songs"

echo -e "\n=== Checking recent artwork for comparison ==="
bunx wrangler d1 execute lofi-studio-db --remote --command="SELECT COUNT(*) as total_artwork FROM artwork"
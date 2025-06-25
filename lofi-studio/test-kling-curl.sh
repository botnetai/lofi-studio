#!/bin/bash

# Test Kling 1.6 with curl
# Usage: FAL_KEY=your-key-here ./test-kling-curl.sh
FAL_KEY="${FAL_KEY}"

if [ -z "$FAL_KEY" ]; then
  echo "Error: Please set FAL_KEY environment variable"
  exit 1
fi

echo "Testing Kling 1.6 Standard Image-to-Video API with curl..."
echo "================================================"

curl -X POST "https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=640&h=640&fit=crop",
    "prompt": "smooth camera movement, cinematic",
    "duration": "5",
    "cfg_scale": 0.5
  }' \
  | jq '.'

echo -e "\n\nDone!"
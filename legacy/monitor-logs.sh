#!/bin/bash

echo "Monitoring logs for video generation..."
echo "Please try generating a video in the UI now..."
echo "Press Ctrl+C to stop monitoring"
echo ""

bunx wrangler tail lofi-studio --format pretty | grep -E "video|Video|error|Error|model|endpoint|Saving|Download"
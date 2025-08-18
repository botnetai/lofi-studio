#!/bin/bash

# Script to add API keys as Cloudflare secrets
# IMPORTANT: Only run this after obtaining NEW API keys (the old ones are compromised)

echo "This script will help you add API keys as Cloudflare secrets."
echo "IMPORTANT: Make sure you have obtained NEW API keys from each provider."
echo "The old keys have been exposed and should not be reused."
echo ""

# GOAPI_KEY
echo "Adding GOAPI_KEY..."
echo "Enter your NEW GoAPI key:"
wrangler secret put GOAPI_KEY

# UDIOAPI_KEY
echo ""
echo "Adding UDIOAPI_KEY..."
echo "Enter your NEW UdioAPI key:"
wrangler secret put UDIOAPI_KEY

# FAL_KEY
echo ""
echo "Adding FAL_KEY..."
echo "Enter your NEW Fal.ai key:"
wrangler secret put FAL_KEY

# JSON2VIDEO_KEY
echo ""
echo "Adding JSON2VIDEO_KEY..."
echo "Enter your NEW Json2Video key:"
wrangler secret put JSON2VIDEO_KEY

echo ""
echo "All secrets have been added to Cloudflare Workers!"
echo "Your application should now work with the new API keys."
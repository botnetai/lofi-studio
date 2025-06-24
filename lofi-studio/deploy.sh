#!/bin/bash

echo "🚀 Deploying Lofi Studio to Cloudflare Workers..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install bun first."
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler is not installed. Installing..."
    bun add -g wrangler
fi

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Build the frontend
echo "🔨 Building frontend..."
bun run build

# Deploy to Cloudflare Workers
echo "☁️  Deploying to Cloudflare Workers..."
wrangler deploy

echo "✅ Deployment complete!"
echo ""
echo "📝 Notes:"
echo "- Make sure your API keys are configured in Cloudflare Workers dashboard"
echo "- Ensure D1 database and R2 bucket are properly set up"
echo "- Check the deployment URL in the output above"
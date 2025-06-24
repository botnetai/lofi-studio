#!/bin/bash

echo "Setting up Udio proxy with ngrok..."

# Start ngrok in the background with HTTP tunnel on port 8888
echo "Starting ngrok HTTP tunnel on port 8888..."
ngrok http 8888 > /tmp/ngrok-udio.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get the public URL
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null)

if [ "$PUBLIC_URL" = "null" ] || [ -z "$PUBLIC_URL" ]; then
    echo "Failed to get ngrok URL. Make sure you have added a payment method to ngrok."
    echo "Visit: https://dashboard.ngrok.com/settings#id-verification"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo "Ngrok tunnel established: $PUBLIC_URL"
echo ""
echo "Now update your Udio config with:"
echo "captcha-proxy: $PUBLIC_URL"
echo ""
echo "Ngrok PID: $NGROK_PID"
#!/bin/bash
# Start ngrok in API mode
echo "Starting ngrok API server..."
ngrok start --none > /tmp/ngrok-api.log 2>&1 &
NGROK_PID=$!

# Wait for API to be ready
echo "Waiting for ngrok API to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:4040/api/tunnels >/dev/null 2>&1; then
        echo "ngrok API is ready!"
        break
    fi
    sleep 1
done

echo "ngrok API started with PID: $NGROK_PID"
echo "You can now run musikai generate command"
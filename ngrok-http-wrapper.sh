#!/bin/bash
# ngrok wrapper that converts tcp to http requests

NGROK_BIN="/opt/homebrew/bin/ngrok"

if [ "$1" = "tcp" ] && [ -n "$2" ]; then
    # Use http instead of tcp
    echo "Converting tcp $2 to http://localhost:$2" >&2
    exec $NGROK_BIN http "localhost:$2" --log=stdout
else
    # For other commands, pass through
    exec $NGROK_BIN "$@"
fi
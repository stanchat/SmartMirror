#!/bin/bash

echo "Starting SmartMirror Application..."

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start the combined server (handles both mirror and admin)
cd "$SCRIPT_DIR" && node server.js

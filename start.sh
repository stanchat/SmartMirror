#!/bin/bash

echo "Starting SmartMirror Application..."

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start the MagicMirror server
echo "Starting MagicMirror server on port 5000..."
cd "$SCRIPT_DIR" && npm run server

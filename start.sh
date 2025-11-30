#!/bin/bash

echo "Starting SmartMirror Application..."

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start the combined server (handles Telegram bot, MagicMirror, and admin API)
cd "$SCRIPT_DIR" && node server.js

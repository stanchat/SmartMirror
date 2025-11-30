#!/bin/bash

echo "Starting SmartMirror Application..."

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any existing Telegram bot processes to prevent conflicts
echo "Cleaning up old bot processes..."
pkill -f "python.*telegram_bot.py" 2>/dev/null || true
pkill -f "python3.*telegram_bot.py" 2>/dev/null || true

# Wait a moment for processes to fully terminate
sleep 2

# Start the combined server (handles Telegram bot, MagicMirror, and admin API)
cd "$SCRIPT_DIR" && node server.js

#!/bin/bash

echo "Starting SmartMirror Application..."

# Start the Python Flask backend in the background
echo "Starting Flask backend on port 3001..."
cd backend && python app.py &
BACKEND_PID=$!

# Wait a moment for the backend to start
sleep 2

# Start the MagicMirror server
echo "Starting MagicMirror server on port 5000..."
cd .. && npm run server

# If MagicMirror exits, kill the backend
kill $BACKEND_PID 2>/dev/null

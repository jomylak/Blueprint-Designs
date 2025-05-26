#!/bin/bash
# Start Vite dev server and open in browser

cd "$(dirname "$0")"
npm run dev &

# Wait for Vite to start (adjust the sleep if needed)
sleep 3

# Open in default browser (macOS: open, Linux: xdg-open, Windows: start)
if command -v open >/dev/null 2>&1; then
  open http://localhost:8080
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:8080
elif command -v start >/dev/null 2>&1; then
  start http://localhost:8080
else
  echo "Please open http://localhost:8080 in your browser."
fi

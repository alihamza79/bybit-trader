#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=4123
PID_FILE="$APP_DIR/.server.pid"
LOG_FILE="$APP_DIR/.server.log"

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

case "${1:-toggle}" in
  stop)
    if is_running; then
      kill "$(cat "$PID_FILE")" 2>/dev/null
      rm -f "$PID_FILE"
      echo "Stopped."
    else
      echo "Not running."
      rm -f "$PID_FILE"
    fi
    exit 0
    ;;
  status)
    if is_running; then
      echo "Running at http://localhost:$PORT (PID $(cat "$PID_FILE"))"
    else
      echo "Not running."
      rm -f "$PID_FILE"
    fi
    exit 0
    ;;
  toggle)
    if is_running; then
      kill "$(cat "$PID_FILE")" 2>/dev/null
      rm -f "$PID_FILE"
      echo "Stopped."
      exit 0
    fi
    ;;
  start) ;;
  *)
    echo "Usage: ./start.sh [start|stop|status]"
    echo "       ./start.sh          (toggle: start if stopped, stop if running)"
    exit 1
    ;;
esac

echo "=== Bybit Multi-Account Trader ==="

if ! command -v node &>/dev/null; then
  echo "Node.js not found. Install from https://nodejs.org (v20+)"
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "Missing .env.local — run: cp .env.example .env.local and fill in values"
  exit 1
fi

if is_running; then
  echo "Already running at http://localhost:$PORT (PID $(cat "$PID_FILE"))"
  exit 0
fi

cd "$APP_DIR"

echo "Installing dependencies..."
pnpm install --silent

echo "Building..."
pnpm build

echo "Starting on port $PORT..."
nohup npx next start -p $PORT > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 2

if is_running; then
  echo ""
  echo "Running at http://localhost:$PORT"
  echo ""
  echo "Commands:"
  echo "  ./start.sh           — toggle (start/stop)"
  echo "  ./start.sh status    — check if running"
  echo "  Logs: tail -f .server.log"
else
  echo "Failed to start. Check:"
  echo "  cat $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi

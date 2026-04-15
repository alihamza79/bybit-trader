#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=4123
LOG_FILE="$APP_DIR/.server.log"

get_pid_on_port() {
  lsof -ti :"$PORT" 2>/dev/null | head -1
}

is_running() {
  [ -n "$(get_pid_on_port)" ]
}

do_stop() {
  local pids
  pids=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
    if is_running; then
      echo "Warning: could not kill all processes on port $PORT"
      exit 1
    fi
    echo "Stopped."
  else
    echo "Not running on port $PORT."
  fi
}

case "${1:-toggle}" in
  stop)
    do_stop
    exit 0
    ;;
  status)
    if is_running; then
      echo "Running at http://localhost:$PORT (PID $(get_pid_on_port))"
    else
      echo "Not running."
    fi
    exit 0
    ;;
  toggle)
    if is_running; then
      do_stop
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

if is_running; then
  echo "Already running at http://localhost:$PORT (PID $(get_pid_on_port))"
  exit 0
fi

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

cd "$APP_DIR"

echo "Installing dependencies..."
pnpm install --silent

echo "Building..."
pnpm build

echo "Starting on port $PORT..."
nohup npx next start -p "$PORT" > "$LOG_FILE" 2>&1 &

for i in $(seq 1 10); do
  sleep 1
  if is_running; then
    echo ""
    echo "Running at http://localhost:$PORT (PID $(get_pid_on_port))"
    echo ""
    echo "Commands:"
    echo "  ./start.sh           — toggle (start/stop)"
    echo "  ./start.sh stop      — stop the server"
    echo "  ./start.sh status    — check if running"
    echo "  Logs: tail -f .server.log"
    exit 0
  fi
done

echo "Failed to start. Check:"
echo "  cat $LOG_FILE"
exit 1

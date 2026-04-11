#!/bin/bash
set -e

echo "=== Bybit Multi-Account Trader ==="
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install it from https://nodejs.org (v20+)"
  exit 1
fi

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "📦 Installing pnpm..."
  npm install -g pnpm
fi

# Check .env.local
if [ ! -f .env.local ]; then
  echo "❌ Missing .env.local file!"
  echo ""
  echo "Create it with your Supabase credentials:"
  echo "  cp .env.example .env.local"
  echo "  Then edit .env.local with your values"
  exit 1
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building app..."
pnpm build

echo ""
echo "✅ Starting app at http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""
pnpm start

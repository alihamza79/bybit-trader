# Bybit Multi-Account Trader

Execute a single futures trade across multiple Bybit demo sub-accounts, each with configurable risk. Built with Next.js, Supabase, and the Bybit V5 API.

## Features

- **Multi-account trading** — place one trade across all your sub-accounts simultaneously
- **Per-account risk** — configure risk as percentage or fixed USDT amount per account
- **Market & Limit orders** — with optional Stop Loss and Take Profit
- **Positions management** — view, edit TP/SL, close by percentage
- **Orders management** — view, edit price/qty/SL/TP, cancel, sync risk on SL change
- **Account balances** — live balance display per account
- **Trade logging** — full history of every execution

## Prerequisites

- [Node.js 20+](https://nodejs.org)
- A [Supabase](https://supabase.com) project (free tier works)
- Bybit demo trading API keys

## Quick Start (No Docker)

### macOS / Linux

```bash
git clone https://github.com/alihamza79/bybit-trader.git
cd bybit-trader
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
./start.sh
```

### Windows

```cmd
git clone https://github.com/alihamza79/bybit-trader.git
cd bybit-trader
copy .env.example .env.local
REM Edit .env.local with your Supabase credentials
start.bat
```

Then open **http://localhost:3000** in your browser.

## Quick Start (Docker)

```bash
git clone https://github.com/alihamza79/bybit-trader.git
cd bybit-trader
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
docker compose up --build
```

Then open **http://localhost:3000** in your browser.

## Manual Setup

```bash
git clone https://github.com/alihamza79/bybit-trader.git
cd bybit-trader

# Install dependencies
pnpm install

# Copy and fill in environment variables
cp .env.example .env.local

# Run in development mode
pnpm dev

# Or build and run in production mode
pnpm build
pnpm start
```

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Important Notes

- This app uses **Bybit Demo Trading** (`api-demo.bybit.com`). API keys must be created from Bybit's Demo Trading mode.
- Bybit's demo API blocks requests from cloud hosting providers (Vercel, Netlify, etc.). **Run this app locally** on your own machine.
- All Bybit API calls are server-side only — API keys are never exposed to the browser.

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (auth + database)
- **React Query** (data fetching)
- **react-hook-form + Zod** (form validation)
- **bybit-api** (Bybit V5 SDK)

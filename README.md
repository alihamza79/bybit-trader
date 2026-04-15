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

## Per-Account Proxy (for multiple CFT accounts)

If you manage multiple accounts through services like Crypto Fund Trader that restrict one account per IP, you can assign a different proxy to each account so their API calls originate from different IPs.

Leave Account 1's proxy field **empty** (uses your home IP). Set Account 2's **Proxy URL** to route through a different IP.

### Option 1: Use a second device on a different network

If you have a phone hotspot, a friend's Wi-Fi, or a second internet connection:

1. Run a SOCKS5 proxy on the second network (e.g., a laptop on hotspot)
2. Or use the SSH tunnel method below with any machine on a different IP

### Option 2: SSH Tunnel through any VPS

If you have access to **any** remote server (even a friend's PC with SSH):

```bash
ssh -D 1080 -N -f user@remote-server-ip
```

Then set Account 2's proxy URL to `socks5://127.0.0.1:1080`.

### Option 3: Free residential proxy services

Some services offer free SOCKS5/HTTP proxies. Quality varies, but for low-frequency trading API calls they can work:

- [Webshare](https://www.webshare.io/) — 10 free proxies (no card required)
- [ProxyScrape](https://proxyscrape.com/free-proxy-list) — free rotating list

Set the proxy URL from the provider, e.g. `socks5://user:pass@proxy-host:port`.

### Option 4: VPS with free tier (if you have a card)

Providers like Oracle Cloud (Always Free), AWS Free Tier, or Google Cloud Free Tier give you a VPS with its own IP. Install [microsocks](https://github.com/rofl0r/microsocks) on it for a persistent SOCKS5 server.

### Supported proxy formats

- `socks5://host:port`
- `socks5://user:pass@host:port`
- `http://host:port`
- `http://user:pass@host:port`

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

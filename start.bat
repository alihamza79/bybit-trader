@echo off
echo === Bybit Multi-Account Trader ===
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo X Node.js not found. Install it from https://nodejs.org (v20+^)
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Installing pnpm...
    npm install -g pnpm
)

if not exist .env.local (
    echo X Missing .env.local file!
    echo.
    echo Create it with your Supabase credentials:
    echo   copy .env.example .env.local
    echo   Then edit .env.local with your values
    pause
    exit /b 1
)

echo Installing dependencies...
call pnpm install

echo Building app...
call pnpm build

echo.
echo App starting at http://localhost:3000
echo Press Ctrl+C to stop
echo.
call pnpm start

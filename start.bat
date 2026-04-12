@echo off
setlocal

set PORT=4123
set PID_FILE=%~dp0.server.pid
set LOG_FILE=%~dp0.server.log

set ACTION=%1
if "%ACTION%"=="" set ACTION=toggle

if /i "%ACTION%"=="stop" goto :do_stop
if /i "%ACTION%"=="status" goto :do_status
if /i "%ACTION%"=="start" goto :do_start
if /i "%ACTION%"=="toggle" goto :do_toggle

echo Usage: start.bat [start^|stop^|status]
echo        start.bat          (toggle: start if stopped, stop if running)
exit /b 1

:is_running
if not exist "%PID_FILE%" exit /b 1
set /p SAVED_PID=<"%PID_FILE%"
tasklist /FI "PID eq %SAVED_PID%" 2>nul | findstr /i "node" >nul 2>nul
exit /b %ERRORLEVEL%

:do_stop
call :is_running
if %ERRORLEVEL% equ 0 (
    set /p SAVED_PID=<"%PID_FILE%"
    taskkill /PID %SAVED_PID% /T /F >nul 2>nul
    del "%PID_FILE%" >nul 2>nul
    echo Stopped.
) else (
    echo Not running.
    del "%PID_FILE%" >nul 2>nul
)
exit /b 0

:do_status
call :is_running
if %ERRORLEVEL% equ 0 (
    set /p SAVED_PID=<"%PID_FILE%"
    echo Running at http://localhost:%PORT% (PID %SAVED_PID%^)
) else (
    echo Not running.
    del "%PID_FILE%" >nul 2>nul
)
exit /b 0

:do_toggle
call :is_running
if %ERRORLEVEL% equ 0 (
    set /p SAVED_PID=<"%PID_FILE%"
    taskkill /PID %SAVED_PID% /T /F >nul 2>nul
    del "%PID_FILE%" >nul 2>nul
    echo Stopped.
    exit /b 0
)
goto :do_start

:do_start
call :is_running
if %ERRORLEVEL% equ 0 (
    set /p SAVED_PID=<"%PID_FILE%"
    echo Already running at http://localhost:%PORT% (PID %SAVED_PID%^)
    exit /b 0
)

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

if not exist "%~dp0.env.local" (
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

echo Building...
call pnpm build

echo Starting on port %PORT%...

start /b cmd /c "npx next start -p %PORT% > "%LOG_FILE%" 2>&1" & (
    for /f "tokens=2" %%a in ('tasklist /v /fo list /fi "WINDOWTITLE eq npx" 2^>nul ^| findstr "PID"') do (
        echo %%a> "%PID_FILE%"
    )
)

timeout /t 3 /nobreak >nul

for /f "usebackq tokens=5" %%p in (`netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"`) do (
    echo %%p> "%PID_FILE%"
    goto :started
)

echo Failed to start. Check:
echo   type %LOG_FILE%
del "%PID_FILE%" >nul 2>nul
exit /b 1

:started
set /p SAVED_PID=<"%PID_FILE%"
echo.
echo Running at http://localhost:%PORT%
echo.
echo Commands:
echo   start.bat           - toggle (start/stop^)
echo   start.bat status    - check if running
echo   Logs: type .server.log
exit /b 0

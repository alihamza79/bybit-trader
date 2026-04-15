@echo off
setlocal enabledelayedexpansion

set PORT=4123
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

:get_pid
set "PORT_PID="
for /f "usebackq tokens=5" %%p in (`netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"`) do (
    if "!PORT_PID!"=="" set "PORT_PID=%%p"
)
exit /b 0

:is_running
call :get_pid
if defined PORT_PID (exit /b 0) else (exit /b 1)

:do_stop
call :is_running
if %ERRORLEVEL% equ 0 (
    echo Stopping PID !PORT_PID!...
    taskkill /PID !PORT_PID! /T /F >nul 2>nul
    timeout /t 2 /nobreak >nul
    call :is_running
    if %ERRORLEVEL% equ 0 (
        echo Warning: could not kill process on port %PORT%.
        exit /b 1
    )
    echo Stopped.
) else (
    echo Not running on port %PORT%.
)
exit /b 0

:do_status
call :is_running
if %ERRORLEVEL% equ 0 (
    echo Running at http://localhost:%PORT% (PID !PORT_PID!^)
) else (
    echo Not running.
)
exit /b 0

:do_toggle
call :is_running
if %ERRORLEVEL% equ 0 (
    echo Stopping PID !PORT_PID!...
    taskkill /PID !PORT_PID! /T /F >nul 2>nul
    timeout /t 2 /nobreak >nul
    echo Stopped.
    exit /b 0
)
goto :do_start

:do_start
call :is_running
if %ERRORLEVEL% equ 0 (
    echo Already running at http://localhost:%PORT% (PID !PORT_PID!^)
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
start /b cmd /c "npx next start -p %PORT% > "%LOG_FILE%" 2>&1"

set ATTEMPTS=0
:wait_loop
if %ATTEMPTS% geq 10 goto :start_failed
timeout /t 1 /nobreak >nul
set /a ATTEMPTS+=1
call :is_running
if %ERRORLEVEL% equ 0 goto :started
goto :wait_loop

:start_failed
echo Failed to start. Check:
echo   type %LOG_FILE%
exit /b 1

:started
echo.
echo Running at http://localhost:%PORT% (PID !PORT_PID!^)
echo.
echo Commands:
echo   start.bat           - toggle (start/stop^)
echo   start.bat stop      - stop the server
echo   start.bat status    - check if running
echo   Logs: type .server.log
exit /b 0

@echo off
title DataLyze - Stopping all services
echo Stopping Node processes (backend + frontend)...
taskkill /F /IM node.exe >nul 2>nul

echo Stopping Python processes (ML service)...
taskkill /F /IM python.exe >nul 2>nul

echo Stopping mongod...
taskkill /F /IM mongod.exe >nul 2>nul

echo.
echo All DataLyze services stopped.
timeout /t 2 /nobreak >nul
@echo off
cd /d "%~dp0"
echo ========================================================
echo  CivicConnect AI - Starting Vite Frontend Dev Server
echo ========================================================
echo Local dev proxy: http://localhost:5173 -> http://localhost:5000
echo ========================================================

call npm.cmd run client
pause


@echo off
cd /d "%~dp0"
echo ========================================================
echo  CivicConnect AI - Seeding Database
echo ========================================================

"C:\Users\Lucid\civicpulse-ai\backend\venv\Scripts\python.exe" backend_py\app\seed.py
pause


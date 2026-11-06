@echo off
cd /d "%~dp0"
echo ========================================================
echo  CivicConnect AI - Starting Unified FastAPI Backend Core
echo ========================================================
echo Port: 5000 (Serving REST API + SPA Frontend)
echo Swagger Docs: http://localhost:5000/docs
echo Web App: http://localhost:5000
echo ========================================================

"C:\Users\Lucid\civicpulse-ai\backend\venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir backend_py --host 127.0.0.1 --port 5000 --reload
pause


@echo off
title SpikingBrain AI Studio
cd /d "%~dp0"
echo ========================================================
echo        Avvio di SpikingBrain AI Studio 2.0
echo ========================================================
echo.
echo Attivazione ambiente virtuale...
call .\.venv\Scripts\activate.bat

echo Apertura del browser su http://localhost:8000...
start http://localhost:8000

echo Avvio server FastAPI...
python app\main.py
pause

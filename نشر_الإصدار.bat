@echo off
chcp 65001 >nul
title Viora - Publish Release
cd /d "%~dp0"
node scripts/publish-release.mjs %*
echo.
pause

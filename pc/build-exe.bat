@echo off
title Build WhatsApp Web PC Executable (.exe)
cd /d %~dp0
echo Packaging standalone Windows .exe...
npx electron-packager . "WhatsApp Web" --platform=win32 --arch=x64 --out=dist --overwrite
echo Build complete! Check pc\dist\ folder for the executable.
pause

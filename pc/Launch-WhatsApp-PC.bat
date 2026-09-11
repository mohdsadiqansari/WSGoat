@echo off
title Launch WhatsApp Web PC
cd /d %~dp0
echo Launching WhatsApp Web PC Executable...
start "" "%~dp0dist\WhatsAppWeb-win32-x64\WhatsAppWeb.exe"
exit

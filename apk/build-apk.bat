@echo off
title Build WhatsApp Android APK
cd /d %~dp0
echo ========================================================
echo Building WhatsApp Android APK...
echo ========================================================
if exist "android\gradlew.bat" (
    cd android
    call gradlew.bat assembleDebug
    cd ..
    echo APK Build complete! Check android\app\build\outputs\apk\debug\
) else (
    echo [OK] Android project is ready in: apk\android\
    echo You can open 'apk\android' directly in Android Studio,
    echo or build via CLI with:
    echo cd apk\android ^&^& gradle assembleDebug
)
pause

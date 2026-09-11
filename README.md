# WhatsApp Web Edition (WSGoat)

A complete WhatsApp Web messaging experience with real-time WebSocket communication, profile photo management, and private encrypted user code channels.

## Project Structure (Separated Editions)

```
WSGoat/
├── web/               # 🌐 Web Edition (Node.js + Express + WebSocket backend & WhatsApp Web UI)
├── pc/                # 💻 PC Desktop Edition (Windows .exe application)
└── apk/               # 📱 Android Mobile Edition (Android Studio project & APK builder)
```

---

### 1. 🌐 Web Edition (`web/`)
- Run with Node.js or Docker:
```bash
cd web
npm install
npm start
```
- Open `http://localhost:3000/` in any browser.

---

### 2. 💻 PC Windows Desktop Edition (`pc/`)
- **Direct Run**: Double-click `pc\Launch-WhatsApp-PC.bat`
- **Pre-packaged .exe**: Located in `pc\dist\WhatsAppWeb-win32-x64\WhatsAppWeb.exe`
- **Rebuild .exe**: Double-click `pc\build-exe.bat` or run `npm run build:exe` inside `pc/`.

---

### 3. 📱 Android Mobile Edition (`apk/`)
- Located in `apk/` with a complete native Android project in `apk/android/`.
- Open `apk/android` in **Android Studio** and click **Build > Build APK(s)**.
- Or run `apk\build-apk.bat` on command line.

---

## Pre-seeded Lab Accounts
- **Alice**: username `alice` | password `password123` | code `A1B2C3D4`
- **Bob**: username `bob` | password `password123` | code `E5F6G7H8`

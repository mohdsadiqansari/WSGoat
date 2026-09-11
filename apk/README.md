# WhatsApp Android Edition (.apk)

Multiple practical ways to build or install the WhatsApp Android `.apk`.

---

## 🚀 Method 1: Automated GitHub Actions (Recommended & Free)
**No Android SDK or Android Studio required on your computer!**

1. Push this repository to **GitHub**.
2. Go to your repository's **Actions** tab.
3. Click on the **Build Android APK** workflow and click **Run workflow**.
4. When finished (~2 minutes), download the **`WhatsApp-Web-Debug-APK`** artifact, which contains your compiled:
   `app-debug.apk`

---

## 📱 Method 2: Instant WebAPK Install (No Build Tools Required)
**Google's official WebAPK engine compiles a real native Android APK directly on your phone:**

1. Open your phone's browser (Chrome, Edge, or Brave).
2. Visit your running WhatsApp server URL: `http://<YOUR_COMPUTER_IP>:3000/`.
3. Tap the browser menu (**⋮**) and select **Install App** (or **Add to Home Screen**).
4. Android will automatically compile and install the native WebAPK package with full screen, app icon, and push notification capabilities!

---

## 🌐 Method 3: Microsoft PWABuilder (Instant APK Generation)
1. Go to **[pwabuilder.com](https://www.pwabuilder.com/)**.
2. Enter your app URL or upload the `apk/public` folder.
3. Click **Package for Stores > Android**.
4. Download the generated APK directly to your device!

---

## 🛠️ Method 4: Android Studio (Local IDE)
1. Open **Android Studio**.
2. Select **Open Project** and choose the `apk/android/` folder.
3. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. Android Studio will build the APK in:
   `apk/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 💻 Method 5: Local Gradle Command Line
If you have the Android SDK installed on your PC:
1. Create `apk/android/local.properties` with:
   ```properties
   sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk
   ```
2. Run:
   ```cmd
   cd apk\android
   .\gradlew.bat assembleDebug
   ```

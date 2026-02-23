# Building and Installing AssistLink on Android

## Why Expo Go Won't Work
This app uses native modules (`react-native-maps` and `expo-location`) that are not supported in Expo Go. You need to build a development build.

---

## Ways to Build an APK (choose one)

| Method | Command / Steps | Use when |
|--------|-----------------|----------|
| **1. Local APK (one command)** | `npm run build:android:local` | You have Android SDK; want a file without EAS/cloud |
| **2. EAS Build (cloud)** | `npm run build:android` or `eas build --platform android --profile preview` | No local Android SDK; build in Expo cloud |
| **3. USB + install** | `npm run android` or `npx expo run:android` | Device connected; build and install in one step |
| **4. Prebuild + Gradle** | See Option 2 below | Manual control; debug or release APK |
| **5. Android Studio** | Prebuild then open `android/` in Android Studio | Prefer GUI to build APK |

---

## Option 1: Build and Install via USB (Recommended)

### Prerequisites
1. Enable USB Debugging on your Android phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times to enable Developer Options
   - Go back to Settings → Developer Options
   - Enable "USB Debugging"
   - Connect your phone via USB to your computer

2. Make sure your phone and computer are on the same Wi-Fi network

### Build and Install
```bash
cd frontend
npx expo run:android
```

This will:
- Build the Android app with native modules
- Install it on your connected device
- Start the Metro bundler

### After Installation
Once installed, you can:
- Open the app on your phone
- Run `npx expo start --dev-client` to start the development server
- The app will automatically connect to the development server

## Option 2: Prebuild + Gradle (standalone APK)

**One command (macOS/Linux):** from `frontend/` run:
```bash
npm run build:android:local
```
APK output: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

Or do it step by step (generates the native `android/` folder):

```bash
cd frontend
npx expo prebuild --platform android
cd android
# macOS / Linux:
./gradlew assembleDebug
# Windows:
# .\gradlew.bat assembleDebug
```

- **Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`  
- **Release APK** (signed): `./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk` (requires signing config).

Transfer the APK to your phone and install it.

---

## Option 3: EAS Build (Expo cloud)

No local Android SDK needed. Build in the cloud and download the APK.

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Configure (first time): `eas build:configure`
4. Build APK: `eas build --platform android --profile preview` (or `production`)

Download the APK from the link in the terminal or from [expo.dev](https://expo.dev) → your project → Builds.

---

## Option 4: Android Studio

After generating the native project (Option 2):

1. Run `npx expo prebuild --platform android` from `frontend/`.
2. Open **Android Studio** → **Open** → select the `frontend/android` folder.
3. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)** (or **Build Signed Bundle / APK** for release).
4. APK path: `frontend/android/app/build/outputs/apk/debug/app-debug.apk` (or release).

## Network Configuration

Make sure:
1. Your phone and computer are on the same Wi-Fi network
2. Your computer's IP address is `192.168.0.115` (check with `ipconfig`)
3. The backend is running on port 8000
4. Windows Firewall allows connections on port 8000

## Troubleshooting

### "Network request failed" errors
- Verify both devices are on the same Wi-Fi network
- Check Windows Firewall settings
- Try accessing `http://192.168.0.115:8000` from your phone's browser

### "No Android device found"
- Make sure USB debugging is enabled
- Try different USB cables/ports
- Run `adb devices` to verify device is detected

### "device 'adb-ef13f485-...' not found" (wireless debugging)
This happens when the phone is connected via **Wireless debugging** instead of USB. Expo/ADB use the device serial with `-s`, which often fails over wireless.

**Fix: use USB for development builds**
1. On the phone: **Settings → Developer options → Wireless debugging** → turn **Off**.
2. Connect the phone with a **USB cable**.
3. Run `adb devices` — you should see the device with a USB serial (not `adb-ef13f485-...`).
4. Run `npm run android` (or `npx expo run:android`).

**If you can’t use USB:** use **Expo Go** instead: run `npm start`, then scan the QR code with Expo Go on the phone (same Wi‑Fi). No native build required.



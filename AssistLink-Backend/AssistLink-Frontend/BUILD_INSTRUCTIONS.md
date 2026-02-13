# Building and Installing AssistLink on Android

## Why Expo Go Won't Work
This app uses native modules (`react-native-maps` and `expo-location`) that are not supported in Expo Go. You need to build a development build.

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
cd AssistLink-Backend/AssistLink-Frontend
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

## Option 2: Build APK and Install Manually

If you can't connect via USB, you can build an APK:

```bash
cd AssistLink-Backend/AssistLink-Frontend
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleDebug
```

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

Transfer this APK to your phone and install it.

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



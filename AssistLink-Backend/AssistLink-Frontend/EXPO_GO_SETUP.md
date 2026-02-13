# Running AssistLink in Expo Go

## Prerequisites
1. Install Expo Go app on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Make sure your phone and computer are on the same Wi-Fi network

## Steps to Run

1. **Clear Metro cache** (if you see errors):
   ```bash
   npx expo start --clear
   ```

2. **Start Expo development server**:
   ```bash
   npm start
   ```
   or
   ```bash
   npx expo start
   ```

3. **Scan QR code**:
   - **iOS**: Open Camera app and scan the QR code, then tap the notification
   - **Android**: Open Expo Go app and tap "Scan QR code"

## Important Notes

⚠️ **Limitations in Expo Go:**
- `react-native-maps` will show a fallback UI (maps won't work but app won't crash)
- Some native features may not be available
- For full functionality, you'll need to build a development build

## Troubleshooting

### If you see "setCustomSourceTransformer" error:
```bash
# Clear cache and restart
npx expo start --clear
```

### If maps don't work:
This is expected in Expo Go. Maps will show a fallback message. To use maps, you'll need to create a development build.

### If connection issues:
- Make sure phone and computer are on same Wi-Fi
- Try tunnel mode: `npx expo start --tunnel`
- Or use USB: `npx expo start --localhost`

## Alternative: Use Web Version
```bash
npm run web
```
This will open in your browser at `http://localhost:8081`


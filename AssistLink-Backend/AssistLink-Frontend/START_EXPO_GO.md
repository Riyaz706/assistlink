# How to Start Expo Go - Quick Guide

## The "fetch failed" Error
The `TypeError: fetch failed` is just a warning about Expo API connectivity. **It won't prevent your app from running!** The Metro bundler should still start.

## Quick Start

1. **Navigate to the frontend folder**:
   ```powershell
   cd AssistLink-Backend\AssistLink-Frontend
   ```

2. **Start Expo (ignore the fetch warning)**:
   ```powershell
   npx expo start --clear
   ```

3. **Wait for Metro Bundler** - Look for:
   ```
   Metro waiting on exp://...
   Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
   ```

4. **Scan QR code** with Expo Go app on your phone

## Alternative: Start with Tunnel (if network issues)
```powershell
npx expo start --tunnel --clear
```

## Alternative: Skip Dependency Check
If the fetch error blocks startup, set this environment variable:
```powershell
$env:EXPO_NO_DOTENV="1"
npx expo start --clear
```

## Troubleshooting

### If Metro doesn't start:
1. Check if port 8081 is in use
2. Try: `npx expo start --port 8082`
3. Or: `npx kill-port 8081` then restart

### If QR code doesn't appear:
- Make sure your phone and computer are on the same Wi-Fi
- Try tunnel mode: `npx expo start --tunnel`
- Or use USB: `npx expo start --localhost`

### If app crashes on load:
- The `setCustomSourceTransformer` error should be fixed now
- Make sure you cleared cache: `npx expo start --clear`
- Check the console for other errors

## Expected Output
When successful, you should see:
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go
```

The fetch warning can be ignored - your app will still work!


# Running AssistLink in Expo Go

## Prerequisites
- **Expo Go app** installed on your Android/iOS device
- **Same WiFi network** for both your computer and mobile device
- **Backend running** at `https://assistlink-nd65.onrender.com`

## Step-by-Step Instructions

### 1. Stop Current Expo Server (if running)
```bash
# Press Ctrl+C in the terminal where Expo is running
```

### 2. Clear Cache and Start Fresh
```bash
cd /Users/mdriyaz/Downloads/ASSISTLINKFINAL-main/AssistLink-Backend/AssistLink-Frontend
npx expo start -c
```

**What `-c` does:** Clears the Metro bundler cache to ensure fresh environment variables are loaded.

### 3. Wait for QR Code
You'll see output like:
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### 4. Connect with Expo Go

#### **For Android:**
1. Open **Expo Go** app on your phone
2. Tap **"Scan QR Code"**
3. Point camera at the QR code in your terminal
4. Wait for the app to load

#### **For iOS:**
1. Open the **Camera** app
2. Point at the QR code
3. Tap the notification that appears
4. Opens in Expo Go automatically

### 5. Alternative: Manual Connection
If QR code doesn't work:

1. In Expo Go app, tap **"Enter URL manually"**
2. Type: `exp://YOUR_COMPUTER_IP:8081`
   - Find your IP in the terminal output (e.g., `192.168.1.5`)
3. Tap **"Connect"**

### 6. Verify Connection
Once loaded, you should see:
- **Splash screen** → **Login screen**
- Try logging in to test backend connectivity
- Check for the enhanced error messages if login fails

## Troubleshooting

### "Unable to connect to Metro"
- **Cause:** Phone and computer on different networks
- **Fix:** Connect both to the same WiFi network

### "Network request failed"
- **Cause:** Backend URL not configured
- **Fix:** Already fixed! The app now uses `https://assistlink-nd65.onrender.com` as fallback

### Login shows "API Error [404]"
- **Check the error message** - it now shows the exact URL being called
- **Report the full error** so we can diagnose the routing issue

### App crashes or won't load
```bash
# Clear everything and restart
npx expo start -c --clear
```

## Quick Commands Reference

```bash
# Start normally
npx expo start

# Start with cache clear (recommended after config changes)
npx expo start -c

# Start in offline mode (no updates check)
npx expo start --offline

# Start with tunnel (if same network doesn't work)
npx expo start --tunnel
```

## Current Status
✅ Backend is live at `https://assistlink-nd65.onrender.com`  
✅ API client configured with fallback URL  
✅ Enhanced error reporting enabled  
⏳ Ready to test in Expo Go!

---

**Need help?** The app now shows detailed error messages including the exact URL and HTTP status code if something goes wrong.

# Building AssistLink APK

## Prerequisites
✅ EAS CLI installed (`/opt/homebrew/bin/eas`)  
✅ `eas.json` configured with production settings  
✅ Backend URL: `https://assistlink-backend-1qjd.onrender.com`  
✅ Google OAuth Client IDs configured

## Quick Build (Recommended)

### Option 1: Production APK
```bash
cd /Users/mdriyaz/Downloads/ASSISTLINKFINAL-main/frontend
eas build --profile production --platform android
```

### Option 2: Preview APK (Faster, for testing)
```bash
eas build --profile preview --platform android
```

## Step-by-Step Instructions

### 1. Login to EAS (if not already logged in)
```bash
eas login
```
Enter your Expo account credentials.

### 2. Start the Build
```bash
# For production APK
eas build --profile production --platform android

# OR for preview/testing APK
eas build --profile preview --platform android
```

### 3. Follow the Prompts
- **Generate a new Android Keystore?** → Yes (first time only)
- **Commit changes?** → Yes (if prompted)

### 4. Wait for Build
- Build happens on Expo's cloud servers
- Takes approximately 10-20 minutes
- You'll see a build URL in the terminal

### 5. Download APK
Once complete:
- Click the build URL in terminal, OR
- Visit: https://expo.dev/accounts/riyaz_26/projects/assistlink/builds
- Download the `.apk` file

### 6. Install on Android Device
- Transfer APK to your phone
- Enable "Install from Unknown Sources" in Settings
- Tap the APK file to install

## Build Profiles Explained

### `production`
- **Use for:** Final release, Play Store submission
- **Includes:** All optimizations, minification
- **Environment:** Production backend URL

### `preview`
- **Use for:** Testing, sharing with testers
- **Faster build:** Less optimization
- **Same environment:** Production backend URL

## Environment Variables (Already Configured)

Both profiles include:
```json
{
  "EXPO_PUBLIC_API_BASE_URL": "https://assistlink-backend-1qjd.onrender.com",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "993827486634-...",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "993827486634-...",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "993827486634-..."
}
```

## Troubleshooting

### "Not logged in"
```bash
eas login
```

### "Project not configured"
```bash
eas build:configure
```

### Build fails
- Check the build logs in the Expo dashboard
- Common issues: Missing dependencies, configuration errors

### APK won't install
- Enable "Install from Unknown Sources"
- Check if you have enough storage space

## Quick Commands

```bash
# Check build status
eas build:list

# View specific build
eas build:view [BUILD_ID]

# Cancel a build
eas build:cancel

# Check EAS account
eas whoami
```

## What Happens During Build

1. **Code Upload:** Your code is sent to Expo servers
2. **Dependencies Install:** npm packages are installed
3. **Native Build:** Android native code is compiled
4. **APK Generation:** Final APK is created and signed
5. **Upload:** APK is uploaded to Expo's CDN

## Next Steps After Build

1. **Download APK** from the build URL
2. **Test on device** to verify login and features work
3. **Share with testers** if needed
4. **Submit to Play Store** (optional, requires additional setup)

---

**Ready to build?** Run:
```bash
eas build --profile preview --platform android
```

This will create a production-ready APK with your backend properly configured! 🚀

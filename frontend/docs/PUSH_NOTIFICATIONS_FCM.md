# Android Push Notifications (FCM)

If you see:

**"Default FirebaseApp is not initialized"** or **"Make sure to complete the guide at https://docs.expo.dev/push-notifications/fcm-credentials/"**

then FCM (Firebase Cloud Messaging) is not set up yet. The app still works: in-app notifications and the emergency alert popup/vibration work. Only **push when the app is in the background** won’t be sent until FCM is configured.

## Quick fix (stop the error)

The app now treats this as a warning and continues. No code change needed.

## Enable background push on Android

1. **Create a Firebase project** (or use an existing one): [Firebase Console](https://console.firebase.google.com/).

2. **Add an Android app** in Firebase with package name `com.assistlink.app`. Download **google-services.json**.

3. **Put the file in the frontend folder**:
   ```text
   frontend/google-services.json
   ```

4. **Rebuild the app** (the config will pick up the file automatically):
   ```bash
   cd frontend
   npx expo prebuild --clean
   npx expo run:android
   ```
   Or with EAS:
   ```bash
   eas build --platform android --profile production
   ```

5. **Upload FCM credentials to EAS** (so Expo can send push for you):
   - In Firebase: Project settings → Service accounts → Generate new private key (JSON).
   - Run `eas credentials` → Android → production → Set up Google Service Account Key for Push Notifications (FCM V1) → Upload the JSON.

Full steps: [Expo – FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).

## Skip FCM (no background push)

To avoid any Firebase-related config, set:

```bash
EXPO_PUBLIC_GOOGLE_SERVICES_FILE=false
```

Then the app won’t try to use `google-services.json`. In-app and emergency notifications still work.

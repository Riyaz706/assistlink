# Android Push Notifications (FCM)

## Implementation summary

- **Expo push tokens**: The app uses `expo-notifications` and registers an **Expo push token** with the backend. The backend sends notifications via the **Expo Push API** (Expo’s servers use FCM to deliver to Android).
- **When logged in**: The device is registered for push only after the user is logged in (`useNotifications` + `useAuth`). On login, the app gets the token and calls `POST /notifications/devices`.
- **On logout**: The device is unregistered by calling `DELETE /notifications/devices/:token`, so the user stops receiving push on that device.
- **EAS build**: For **background** push on Android, FCM must be set up: `google-services.json` in the project and FCM credentials (preferably **FCM V1**) uploaded to EAS.

---

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
   - **FCM V1 (recommended):**
     - Firebase Console → Project settings → **Service accounts** → **Generate new private key** (downloads a JSON file).
     - In terminal: `cd frontend` then `eas credentials -p android`.
     - Choose your build profile (e.g. **production**).
     - Under **Push Notifications (FCM V1)** choose **Set up a FCM V1 key** (or **Upload a FCM V1 key**) and upload the service account JSON.
     - Rebuild the app so the new credentials are used: `eas build --platform android --profile production`.
   - **FCM Legacy:** You can also add a Legacy server key under **Push Notifications (FCM Legacy)** if needed; Expo recommends FCM V1 for new projects.
   - Full steps: [Expo – FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).

## Skip FCM (no background push)

To avoid any Firebase-related config, set:

```bash
EXPO_PUBLIC_GOOGLE_SERVICES_FILE=false
```

Then the app won’t try to use `google-services.json`. In-app and emergency notifications still work.

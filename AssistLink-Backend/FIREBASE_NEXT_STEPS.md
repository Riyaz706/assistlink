# Firebase Setup - Next Steps

## Current Status
✅ Step 1: Register app - **COMPLETE**
- Android package name: `com.AssistLink.assistlink`

⏳ Step 2: Download and add config file - **IN PROGRESS**

---

## Immediate Next Steps

### 1. Download `google-services.json`
- Click the **"Download google-services.json"** button in Firebase Console
- Save the file to your computer (remember where you saved it!)

### 2. Add to Android Project
**Important:** This file goes in your **Android app project**, NOT in this backend repository.

**Steps:**
1. Open your Android project in Android Studio
2. Switch to **Project view** (not Android view) - use the dropdown at top
3. Navigate to: `app/` folder (module root)
4. Copy the downloaded `google-services.json` file into the `app/` folder
   - Should be at: `app/google-services.json`
   - Same level as `build.gradle`, `src/`, etc.

**Visual Guide:**
```
MyApplication/
├── .gradle/
├── .idea/
└── app/
    ├── google-services.json  ← Place it here!
    ├── build.gradle
    ├── src/
    └── ...
```

### 3. Add Google Services Plugin (if not already added)

In your **project-level** `build.gradle` (or `build.gradle.kts`):
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

In your **app-level** `build.gradle` (or `build.gradle.kts`):
```gradle
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services'  // Add this line
}
```

### 4. Sync Project
- Click **"Sync Now"** in Android Studio
- Wait for Gradle sync to complete

### 5. Click "Next" in Firebase Console
- After adding the file, go back to Firebase Console
- Click the **"Next"** button to continue

---

## After Android Setup

### For Backend (This Repository):

1. **Get FCM Server Key**
   - In Firebase Console, go to **Project Settings** (gear icon ⚙️)
   - Click **"Cloud Messaging"** tab
   - Under **"Cloud Messaging API (Legacy)"**, copy the **Server key**
   - It looks like: `AAAA...` (long string)

2. **Add to Backend `.env`**
   ```env
   FCM_SERVER_KEY=AAAA...your_server_key_here...
   ```

3. **Restart Backend Server**
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart
   python run.py
   ```

### For Frontend (Android App):

1. **Add Firebase SDK Dependencies**

   In `app/build.gradle`:
   ```gradle
   dependencies {
       // Firebase Cloud Messaging
       implementation 'com.google.firebase:firebase-messaging:23.4.0'
       implementation 'com.google.firebase:firebase-analytics:21.5.0'
   }
   ```

2. **Initialize Firebase in Your App**

   ```kotlin
   // In Application class or MainActivity
   import com.google.firebase.FirebaseApp
   import com.google.firebase.messaging.FirebaseMessaging
   
   // Firebase is auto-initialized with google-services.json
   // Get FCM token:
   FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
       if (!task.isSuccessful) {
           Log.w(TAG, "Fetching FCM registration token failed", task.exception)
           return@addOnCompleteListener
       }
       
       // Get new FCM registration token
       val token = task.result
       Log.d(TAG, "FCM Token: $token")
       
       // Register with backend
       registerDeviceWithBackend(token)
   }
   ```

3. **Register Device Token with Backend**

   ```kotlin
   suspend fun registerDeviceWithBackend(token: String) {
       val deviceInfo = mapOf(
           "model" to Build.MODEL,
           "manufacturer" to Build.MANUFACTURER,
           "os_version" to Build.VERSION.RELEASE
       )
       
       val response = httpClient.post("http://your-backend-url/api/notifications/devices") {
           header("Authorization", "Bearer $accessToken")
           contentType(ContentType.Application.Json)
           body = json {
               "device_token" to token
               "platform" to "android"
               "device_info" to deviceInfo
           }
       }
   }
   ```

---

## Complete Setup Checklist

### Firebase Console:
- [x] Project created
- [x] Android app registered
- [ ] `google-services.json` downloaded
- [ ] `google-services.json` added to Android project
- [ ] Google Services plugin added
- [ ] Project synced in Android Studio
- [ ] FCM Server Key copied
- [ ] FCM Server Key added to backend `.env`

### Android App:
- [ ] Firebase SDK dependencies added
- [ ] Firebase initialized
- [ ] FCM token retrieved
- [ ] Device registered with backend API

### Backend (This Repo):
- [ ] `FCM_SERVER_KEY` added to `.env`
- [ ] Backend server restarted
- [ ] Push notifications tested

---

## Testing Push Notifications

### Option 1: Test from Firebase Console
1. Go to **Cloud Messaging** in Firebase Console
2. Click **"Send test message"**
3. Enter your FCM token (from Android app logs)
4. Enter title and message
5. Click **Test**

### Option 2: Test from Backend
1. Create a notification via API (e.g., video call request)
2. Push notification should automatically send
3. Check Android device for notification

---

## Troubleshooting

### "google-services.json not found"
- Make sure file is in `app/` folder (not project root)
- Check file name is exactly `google-services.json` (case-sensitive)
- Sync project again

### "Plugin with id 'com.google.gms.google-services' not found"
- Add Google Services plugin to project-level `build.gradle`
- Sync project

### "No token available"
- Check internet connection
- Verify `google-services.json` is correct
- Check Android logs for errors

### Push notifications not received
- Verify `FCM_SERVER_KEY` is in backend `.env`
- Check device token is registered
- Test from Firebase Console first

---

## Next Actions

1. **Right Now:**
   - Download `google-services.json`
   - Add it to your Android project's `app/` folder
   - Add Google Services plugin
   - Sync project
   - Click "Next" in Firebase Console

2. **Then:**
   - Get FCM Server Key from Firebase Console
   - Add to backend `.env` file
   - Restart backend server

3. **Finally:**
   - Add Firebase SDK to Android app
   - Get device token
   - Register with backend
   - Test push notifications

---

## Need Help?

- **Firebase Setup Guide**: See `FIREBASE_SETUP_GUIDE.md`
- **Device Token Guide**: See `DEVICE_TOKEN_GUIDE.md`
- **Firebase Docs**: https://firebase.google.com/docs/android/setup



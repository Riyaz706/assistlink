# Firebase Cloud Messaging (FCM) Setup Guide

Complete step-by-step guide to set up Firebase for push notifications in AssistLink.

---

## 📋 Prerequisites

- Google account
- Access to Firebase Console
- Your app's domain/package name ready

---

## Step 1: Create Firebase Project

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Sign in with your Google account

2. **Create New Project**
   - Click **"Add project"** or **"Create a project"**
   - Enter project name: `AssistLink` (or your preferred name)
   - Click **Continue**

3. **Configure Google Analytics (Optional)**
   - Choose whether to enable Google Analytics
   - If enabled, select or create an Analytics account
   - Click **Continue** → **Create project**
   - Wait for project creation (30-60 seconds)
   - Click **Continue**

---

## Step 2: Add Your App(s)

You can add multiple platforms (Web, Android, iOS) to the same project.

### For Web App:

1. **Add Web App**
   - In Firebase Console, click the **Web icon** (`</>`) or **"Add app"** → **Web**
   - Register app nickname: `AssistLink Web` (optional)
   - **Don't check** "Also set up Firebase Hosting" (unless you need it)
   - Click **Register app**

2. **Copy Firebase Config**
   - You'll see a config object like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "assistlink.firebaseapp.com",
     projectId: "assistlink",
     storageBucket: "assistlink.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
   - **Save this config** - you'll need it in your frontend
   - Click **Continue to console**

### For Android App (if applicable):

1. **Add Android App**
   - Click **Android icon** or **"Add app"** → **Android**
   - Android package name: `com.assistlink.app` (use your actual package name)
   - App nickname: `AssistLink Android` (optional)
   - Click **Register app**

2. **Download `google-services.json`**
   - Click **Download google-services.json**
   - **Save this file** - you'll need to add it to your Android project
   - Place it in: `android/app/google-services.json`
   - Click **Next** → **Next** → **Continue to console**

### For iOS App (if applicable):

1. **Add iOS App**
   - Click **iOS icon** or **"Add app"** → **iOS**
   - iOS bundle ID: `com.assistlink.app` (use your actual bundle ID)
   - App nickname: `AssistLink iOS` (optional)
   - Click **Register app**

2. **Download `GoogleService-Info.plist`**
   - Click **Download GoogleService-Info.plist**
   - **Save this file** - you'll need to add it to your iOS project
   - Place it in your iOS project root
   - Click **Next** → **Next** → **Continue to console**

---

## Step 3: Enable Cloud Messaging

1. **Go to Cloud Messaging**
   - In Firebase Console, click **Build** → **Cloud Messaging** (or **Messaging**)
   - If you see "Get started", click it

2. **For Web: Generate VAPID Key**
   - Scroll down to **"Web configuration"** section
   - Click **"Generate key pair"** (or **"Web Push certificates"**)
   - A VAPID key will be generated (looks like: `BEl...`)
   - **Copy and save this VAPID key** - you'll need it in your frontend
   - This is used for web push notifications

3. **For Android/iOS:**
   - Cloud Messaging is automatically enabled
   - No additional setup needed (if you added the app correctly)

---

## Step 4: Get FCM Server Key (For Backend)

1. **Go to Project Settings**
   - Click the **gear icon** ⚙️ next to "Project Overview"
   - Select **"Project settings"**

2. **Go to Cloud Messaging Tab**
   - Click **"Cloud Messaging"** tab

3. **Get Server Key**
   - Under **"Cloud Messaging API (Legacy)"**, you'll see:
     - **Server key**: `AAAA...` (long string)
   - **Copy this Server key**
   - ⚠️ **Keep this secret!** Don't commit it to version control

   **OR** (Recommended for production):

4. **Create Service Account (Better for Production)**
   - Go to **Project Settings** → **Service Accounts**
   - Click **"Generate new private key"**
   - Download the JSON file
   - Use this for Firebase Admin SDK (more secure)

---

## Step 5: Add to Backend `.env`

Add the FCM Server Key to your backend `.env` file:

```env
# Firebase Cloud Messaging
FCM_SERVER_KEY=AAAA...your_server_key_here...
```

**For Service Account (Alternative):**
```env
# If using Service Account JSON file
FCM_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json
```

---

## Step 6: Install Firebase SDK in Frontend

### For Web (React/Vue/Plain JS):

```bash
npm install firebase
# or
yarn add firebase
```

### For React Native:

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
# or
yarn add @react-native-firebase/app @react-native-firebase/messaging
```

---

## Step 7: Initialize Firebase in Frontend

### Web Example:

```javascript
// firebase.js or firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSy...", // From Step 2
  authDomain: "assistlink.firebaseapp.com",
  projectId: "assistlink",
  storageBucket: "assistlink.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Messaging and get a reference to the service
let messaging = null;

if (typeof window !== 'undefined') {
  messaging = getMessaging(app);
}

export { messaging, getToken, onMessage };
```

### Get Device Token:

```javascript
// In your app initialization
import { messaging, getToken } from './firebase';

async function initializePushNotifications() {
  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Get VAPID key from Firebase Console (Step 3)
      const vapidKey = 'BEl...your-vapid-key';
      
      // Get device token
      const token = await getToken(messaging, { vapidKey });
      
      if (token) {
        console.log('FCM Token:', token);
        
        // Register with your backend
        await registerDeviceWithBackend(token);
      } else {
        console.log('No registration token available.');
      }
    } else {
      console.log('Notification permission denied.');
    }
  } catch (error) {
    console.error('Error getting token:', error);
  }
}

async function registerDeviceWithBackend(token) {
  const response = await fetch('/api/notifications/devices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_token: token,
      platform: 'web',
      device_info: {
        user_agent: navigator.userAgent,
        language: navigator.language
      }
    })
  });
  
  if (response.ok) {
    console.log('Device registered successfully!');
  }
}
```

---

## Step 8: Test Push Notifications

### Option 1: Test from Firebase Console

1. Go to **Cloud Messaging** in Firebase Console
2. Click **"Send test message"**
3. Enter your FCM token (from frontend)
4. Enter notification title and text
5. Click **Test**

You should receive a push notification!

### Option 2: Test from Backend

After creating a notification via your API, it should automatically send a push notification if:
- ✅ FCM_SERVER_KEY is set in `.env`
- ✅ Device token is registered
- ✅ User has granted notification permission

---

## Step 9: Handle Push Notifications in Frontend

### Web:

```javascript
import { onMessage } from 'firebase/messaging';
import { messaging } from './firebase';

// Handle foreground messages (when app is open)
onMessage(messaging, (payload) => {
  console.log('Message received:', payload);
  
  // Show notification
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };
  
  new Notification(notificationTitle, notificationOptions);
});
```

### Service Worker (for background notifications):

Create `firebase-messaging-sw.js` in your `public` folder:

```javascript
// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "assistlink.firebaseapp.com",
  projectId: "assistlink",
  storageBucket: "assistlink.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});
```

---

## ✅ Checklist

- [ ] Firebase project created
- [ ] Web app added (or Android/iOS)
- [ ] Firebase config copied
- [ ] VAPID key generated (for web)
- [ ] FCM Server Key copied
- [ ] FCM_SERVER_KEY added to backend `.env`
- [ ] Firebase SDK installed in frontend
- [ ] Firebase initialized in frontend
- [ ] Device token retrieved
- [ ] Device registered with backend
- [ ] Test notification sent successfully

---

## 🔒 Security Notes

1. **Never commit FCM Server Key to version control**
   - Keep it in `.env` file
   - Add `.env` to `.gitignore`

2. **Restrict API Key (Optional but Recommended)**
   - Go to Google Cloud Console
   - APIs & Services → Credentials
   - Restrict API key to your domain

3. **Use Service Account for Production**
   - More secure than Server Key
   - Better for production environments

---

## 🐛 Troubleshooting

### "No token available"
- Check notification permission is granted
- Verify VAPID key is correct
- Check Firebase config is correct

### "Permission denied"
- User needs to grant notification permission
- Some browsers require HTTPS for notifications

### "Token not registered"
- Check backend endpoint is working
- Verify authentication token is valid
- Check RLS policies allow device registration

### Push notifications not received
- Verify FCM_SERVER_KEY is set in backend
- Check device token is registered
- Test from Firebase Console first
- Check browser console for errors

---

## 📚 Next Steps

1. ✅ Complete Firebase setup
2. ✅ Add FCM_SERVER_KEY to backend `.env`
3. ✅ Install Firebase SDK in frontend
4. ✅ Get device token and register with backend
5. ✅ Test push notifications
6. ✅ Handle foreground/background notifications

---

## 📖 Resources

- **Firebase Console**: https://console.firebase.google.com
- **FCM Documentation**: https://firebase.google.com/docs/cloud-messaging
- **Web Setup**: https://firebase.google.com/docs/cloud-messaging/js/client
- **React Native**: https://rnfirebase.io/messaging/usage



# Google OAuth on Android – Fixes

## Fix 1: "Custom URI scheme is not enabled for your Android client" (Error 400: invalid_request)

This error appears when the app uses the **Android** OAuth client and redirects back with a **custom URI scheme** (e.g. `assistlink://`). Google disables custom URI schemes for Android clients by default.

**What to do:**

1. Open [Google Cloud Console](https://console.cloud.google.com/) → your project → **APIs & Credentials**.
2. Under **OAuth 2.0 Client IDs**, click your **Android** client (the one with package `com.assistlink.app`).
3. Scroll to **Advanced settings** (or open the client and look for it).
4. Find **Custom URI scheme** and **enable** it (e.g. turn on “Allow custom URI scheme” or the equivalent toggle).
5. Save the client.

After saving, try “Sign in with Google” again. Changes can take a few minutes to apply.

Google recommends using their native SDK instead of custom schemes for new apps; enabling the custom scheme is the quick fix so Expo’s `expo-auth-session` flow (which uses `assistlink://` redirect) keeps working.

---

## Fix 2: "Custom scheme URIs are not allowed for 'WEB' client type"

This error happens when the app uses a **Web** OAuth client ID on Android but sends a custom redirect URI (e.g. `exp://...` or `assistlink://...`). Google only allows **https** redirects for Web clients.

## What we changed

The app now uses the **Android** OAuth client ID when running on Android (and **iOS** on iOS). For Android, Google validates the app by **package name + SHA-1 certificate**, not by redirect URI, so the custom scheme is allowed.

## What you need to do in Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → your project → **APIs & Credentials**.
2. Create an **OAuth 2.0 Client ID** (or edit an existing one):
   - Application type: **Android**
   - Name: e.g. "AssistLink Android"
   - **Package name**:
     - For **Expo Go** testing: `host.exp.exponent`
     - For **your built app** (EAS / dev build): `com.assistlink.app`
   - **SHA-1 certificate fingerprint**:
     - For Expo Go: use the Expo Go app’s SHA-1 (see [Expo docs](https://docs.expo.dev/guides/google-authentication/) or run your app and check logcat).
     - For your build: get it with  
       `cd android && ./gradlew signingReport`  
       or from EAS: `eas credentials` → Android → view signing key.
3. Use the **same** client ID value in your app config as `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (in `.env`, `app.config.js`, or EAS env). Your backend also needs the same client IDs in `GOOGLE_ANDROID_CLIENT_ID` (and Web/iOS) to verify the ID token.
4. If you test in **Expo Go** and also ship a **built APK**, you can create two Android clients (one with `host.exp.exponent`, one with `com.assistlink.app`) and use the Expo Go client ID only in development env if you want.

After adding the Android client with the correct package name and SHA-1, "Sign in with Google" on Android should work without the "Custom scheme URIs are not allowed for 'WEB' client type" error.

---

## Current EAS production build (riyaz_08/assistlink)

For the APK built from **frontend** with EAS project `99c43cf1-633b-4c83-9bfd-7504a93229a5` (production profile):

| Field | Value |
|-------|--------|
| **Package name** | `com.assistlink.app` |
| **SHA-1** | `B5:6A:9D:69:2A:E8:FE:10:09:0D:23:64:01:2B:98:2B:3D:17:DD:6A` |

**To enable Google Sign-In for this APK:** In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your **Android** OAuth client (package `com.assistlink.app`) → add the SHA-1 above to the certificate fingerprints (or add a second Android client with this package + SHA-1 if you already have one with a different SHA-1). No code or client ID changes needed.

---

## Option A: Get SHA-1 using EAS (development / EAS build)

Use this when you build with EAS (e.g. `eas build --platform android`) or use a dev build. The app package name is **com.assistlink.app**.

### 1. Get your app’s SHA-1

1. In the project root (e.g. `frontend/` or repo root), run:
   ```bash
   eas credentials -p android
   ```
2. Choose your **build profile** when asked (e.g. `preview` or `production`).
3. In the menu, choose **Keystore: Set up a new keystore** (first time) or **Keystore: View credentials**.
4. EAS shows the keystore details; find **SHA-1 certificate fingerprint** and copy it (e.g. `A1:B2:C3:...`).

If you have never run an EAS Android build, run one first so a keystore exists:

```bash
eas build --platform android --profile preview
```

Then run `eas credentials -p android` again and view the keystore to get the SHA-1.

### 2. Create Android OAuth client in Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) → your project → **APIs & Services** → **Credentials** (or **Google Auth Platform** → **Clients**).
2. **Create Credentials** → **OAuth client ID**.
3. Application type: **Android**.
4. **Name:** e.g. "AssistLink Android".
5. **Package name:** `com.assistlink.app`
6. **SHA-1 certificate fingerprint:** paste the SHA-1 from step 1.
7. Click **Create** and copy the new **Client ID**.

### 3. Use the Client ID in app and backend

- **Frontend:** Set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` to that Client ID (in `.env`, `app.config.js`, or EAS build env in `eas.json`).
- **Backend:** Set `GOOGLE_ANDROID_CLIENT_ID` in `backend/.env` to the same value.

Then run or install your EAS-built (or dev-built) Android app and try “Sign in with Google.”

---

## Option B: Expo Go (testing only)

Use this only if you want to test Google sign-in inside the **Expo Go** app. Package name is **host.exp.exponent**; the SHA-1 must be the one that signs the Expo Go app (from Expo/Play Store), not your keystore.

### 1. Get Expo Go’s SHA-1

Expo Go is signed by Expo. You can:

- **From device:** With Expo Go installed and USB debugging on, run your app in Expo Go, then:
  ```bash
  adb logcat | grep -i "sha\|fingerprint"
  ```
  Some flows log the signing cert; copy the SHA-1 if shown.
- **Or** use the value published by Expo for the current Expo Go build (see [Expo Google auth docs](https://docs.expo.dev/guides/google-authentication/) or Expo app-signing docs).
- **Simpler:** Prefer **Option A** and test with an EAS or dev build (package `com.assistlink.app`, SHA-1 from `eas credentials`).

### 2. Create Android OAuth client for Expo Go

1. Google Cloud Console → **Credentials** (or **Google Auth Platform** → **Clients**) → **Create Credentials** → **OAuth client ID**.
2. Application type: **Android**.
3. **Name:** e.g. "AssistLink Android (Expo Go)".
4. **Package name:** `host.exp.exponent`
5. **SHA-1 certificate fingerprint:** the Expo Go SHA-1 from step 1.
6. Create and copy the **Client ID**.

### 3. Use this Client ID only for Expo Go

- For Expo Go testing, set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` to this new Client ID (e.g. in a `.env` used only when running in Expo Go).
- **Backend:** Add this same Client ID to your backend’s allowed Google client IDs (e.g. in `GOOGLE_ANDROID_CLIENT_ID` or your backend’s list). If the backend accepts multiple Android client IDs, add both the Expo Go one and the `com.assistlink.app` one.

For production, use **Option A** with `com.assistlink.app` and your own SHA-1. Option B is only for quick testing in Expo Go.

---

## Summary

| Scenario              | Package name           | SHA-1 from                    |
|-----------------------|------------------------|-------------------------------|
| EAS / dev build (app) | `com.assistlink.app`   | `eas credentials -p android`   |
| Expo Go (testing)     | `host.exp.exponent`    | Expo Go app / Expo docs       |

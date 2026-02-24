# Google Sign-In Not Working – Troubleshooting

If "Sign in with Google" fails, times out, or nothing happens, check these in order.

---

## 1. Backend env vars (Render)

The backend **must** have these set to verify the ID token:

| Variable | Where to get | Required for |
|----------|--------------|--------------|
| `GOOGLE_WEB_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Web client | All platforms |
| `GOOGLE_ANDROID_CLIENT_ID` | Same → Android client (package `com.assistlink.app`) | Android app |
| `GOOGLE_IOS_CLIENT_ID` | Same → iOS client (or reuse Web) | iOS app |

**Render → your backend service → Environment** → add each value → Save → Redeploy.

If missing, you’ll see **"Invalid Google ID token"** after signing in.

---

## 2. SHA-1 fingerprint (Android)

Google validates Android apps by package name + SHA-1. If the SHA-1 is wrong or missing, sign-in fails.

### Get your APK’s SHA-1 (EAS build)

```bash
cd frontend
eas credentials -p android
```

Select your build profile → Keystore → view SHA-1.

### Add it in Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create Credentials** → **OAuth client ID**
2. **Application type:** Android
3. **Package name:** `com.assistlink.app`
4. **SHA-1:** paste the value from `eas credentials`
5. Create and copy the **Client ID**

### Use it in the app

- **EAS build:** Set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` in EAS env (already in `eas.json` for preview/production).
- **Backend:** Set `GOOGLE_ANDROID_CLIENT_ID` in Render to the same value.

---

## 3. Running in Expo Go vs built APK

| Environment | Package name | OAuth client |
|-------------|--------------|--------------|
| EAS-built APK | `com.assistlink.app` | Android client with your keystore SHA-1 |
| Expo Go | `host.exp.exponent` | Separate Android client with Expo Go SHA-1 |

For production, test with an EAS-built APK, not Expo Go. See `frontend/docs/GOOGLE_OAUTH_ANDROID.md` for Expo Go setup.

---

## 4. Local dev (.env)

If you run `expo start` or `npx expo start`, create `frontend/.env`:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=993827486634-xxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=85121460393-xxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=993827486634-xxx.apps.googleusercontent.com
```

Restart the dev server after adding or changing `.env`.

---

## 5. "Redirecting to browser" / Browser doesn't return to app (Android)

If you sign in on Google successfully but the browser stays open or doesn't return to the app, the app now uses an **HTTPS redirect** to work around Chrome Custom Tabs limitations.

### Setup required

1. **Deploy the OAuth redirect page** (one-time):
   ```bash
   cd frontend
   npm run deploy:web
   ```
   This deploys `oauth-redirect.html` to Firebase Hosting. The redirect URL is `https://assistlink-67bb3-1a64d.web.app/oauth-redirect`.

2. **Add the redirect URI to Google Cloud Console:**
   - Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your **Web** OAuth client (not Android).
   - Go to **Authorized redirect URIs**.
   - Add: `https://assistlink-67bb3-1a64d.web.app/oauth-redirect`
   - Save.

3. **Use an EAS-built APK** for testing, not Expo Go.

---

## 6. Web: Redirect URI mismatch

If sign-in works in the app but **on web** the browser redirects and nothing happens:

1. Check the console log `[GoogleAuth] Ready. Redirect URI: ...` to see the exact redirect URI your app uses.
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your **Web** OAuth client → **Authorized redirect URIs**.
3. Add the **exact** redirect URI (e.g. `http://localhost:19006` for local dev, `https://yourdomain.com` for production). Google must have an exact match.

---

## 7. Console logs

Check logs after tapping "Sign in with Google":

- **`[GoogleAuth] Missing client IDs`** → Add client IDs to `.env` (dev) or EAS env (build)
- **`[GoogleAuth] Ready. Redirect URI: ...`** → Config loaded; copy this URI into Google Cloud Web client's Authorized redirect URIs if testing on web. If sign-in still fails, check backend and SHA-1.

---

## Quick checklist

- [ ] Render has `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`
- [ ] Google Cloud Android OAuth client has correct package `com.assistlink.app` and SHA-1
- [ ] **Android:** OAuth redirect page deployed (`npm run deploy:web`) and `https://assistlink-67bb3-1a64d.web.app/oauth-redirect` added to Web client's Authorized redirect URIs
- [ ] **Web:** Redirect URI from `[GoogleAuth] Ready` is added to Web client's Authorized redirect URIs
- [ ] `GOOGLE_ANDROID_CLIENT_ID` in app matches the backend and the Android client in Google Cloud
- [ ] For local dev: `frontend/.env` has the Google client IDs
- [ ] Redeployed backend after changing Render env vars

# AssistLink — Build Readiness

## Is the project ready to build?

**Short answer:** **Almost.** The app is configured for building; you need to ensure **assets exist** and (optionally) set **environment variables** for your environment.

---

## What’s already in place

| Item | Status |
|------|--------|
| **Expo app.config.js** | ✅ App name, version, bundle IDs (`com.assistlink.app`), icon/splash paths, permissions, scheme |
| **EAS Build (eas.json)** | ✅ `preview` and `production` profiles; APK for Android; env vars set for EAS cloud builds |
| **API base URL** | ✅ Default `https://assistlink-backend.onrender.com` in app.config and eas.json |
| **Google OAuth / Maps** | ✅ Client IDs and Maps key in eas.json (preview/production); app uses `expo-constants` extra as fallback |
| **iOS / Android config** | ✅ Bundle ID, permissions (camera, mic), adaptive icon, Google Maps config |
| **Backend** | ✅ FastAPI app; deploy separately (e.g. Render); frontend points to it via `EXPO_PUBLIC_API_BASE_URL` |

---

## Before you build: required

### 1. Frontend assets

`app.config.js` expects these files under `frontend/`:

- `./assets/icon.png` — app icon (e.g. 1024×1024)
- `./assets/splash.png` — splash screen
- `./assets/adaptive-icon.png` — Android adaptive icon (foreground)
- `./assets/favicon.png` — web favicon

If any of these are missing, the build can fail. Add them or adjust paths in `app.config.js`.

### 2. Backend is running and reachable

For the built app to work:

- Backend must be deployed and publicly reachable (e.g. `https://assistlink-backend.onrender.com`).
- If you use a different URL, set `EXPO_PUBLIC_API_BASE_URL` in your build env (see below).

---

## How to build

### Option A: EAS Build (recommended for APK/IPA)

```bash
cd frontend
npm install
npx eas build --platform android --profile preview   # APK for testing
npx eas build --platform android --profile production
npx eas build --platform ios --profile production    # requires Apple dev account
```

Env vars for these builds are already in `eas.json` (preview/production). To override (e.g. different API URL), use EAS Secrets or `eas build` with `--env` or a custom profile.

### Option B: Local dev / run on device

```bash
cd frontend
npm install
npx expo start
# Then: press 'a' for Android, 'i' for iOS, or 'w' for web
```

For a **local native build** (no EAS):

```bash
npx expo run:android   # needs Android SDK
npx expo run:ios       # needs Xcode (mac only)
```

### Option C: Web build

```bash
cd frontend
npx expo export --platform web
# Output in dist/ (or as per Expo docs)
```

---

## Environment variables (optional override)

If you don’t use the values in `eas.json`, you can set:

| Variable | Purpose | Default in project |
|----------|--------|---------------------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API URL | `https://assistlink-backend.onrender.com` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth (web) | Set in eas.json |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth (iOS) | Set in eas.json |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth (Android) | Set in eas.json |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps (Android) | Set in eas.json |

Create `frontend/.env` for local runs; for EAS Build, use EAS Secrets or the `env` block in `eas.json`.

---

## Security note

`eas.json` currently contains Google client IDs and a Maps API key. For production:

- Prefer **EAS Secrets** for sensitive values and reference them in build profiles.
- Restrict Maps and OAuth keys (e.g. by bundle ID / package name, HTTP referrer) in Google Cloud Console.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Add or verify `frontend/assets/icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png` |
| 2 | Ensure backend is deployed and `EXPO_PUBLIC_API_BASE_URL` points to it (or use default) |
| 3 | Run `cd frontend && npm install && npx eas build --platform android --profile preview` (or production) |
| 4 | (Optional) Move secrets to EAS Secrets and restrict API keys |

After step 1 and 2, the project is ready for building the application.

# Google Maps Setup (AssistLink)

The app uses **Google Maps** on Android (and optionally on iOS) for the Track/Caregiver Map screen. Follow these steps to enable in-app maps.

## 1. Get a Google Maps API key

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable **Maps SDK for Android** (and **Maps SDK for iOS** if you build for iOS):
   - APIs & Services → Library → search “Maps SDK for Android” → Enable.
4. Create an API key:
   - APIs & Services → Credentials → Create Credentials → API Key.
5. Restrict the key (recommended):
   - **Android**: Application restrictions → Android apps → Add your package name `com.assistlink.app` and SHA-1 fingerprint.
   - **iOS**: Application restrictions → iOS apps → Add your bundle ID `com.assistlink.app`.

## 2. Configure the app

In the **frontend** folder, set the API key in `.env`:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

The key is read in `app.config.js` under `android.config.googleMaps.apiKey` (and iOS if you add it).

## 3. Run with real maps (development build)

Maps require a **development build** (not Expo Go). Use one of these:

**Option A – Use the script (recommended):**

```bash
cd frontend
npm run android:maps
```

This sets `EXPO_PUBLIC_USE_REAL_MAPS=true` and runs `expo run:android` so the app loads the real `react-native-maps` and uses Google Maps.

**Option B – Set the env yourself:**

```bash
cd frontend
export EXPO_PUBLIC_USE_REAL_MAPS=true   # macOS/Linux
# set EXPO_PUBLIC_USE_REAL_MAPS=true    # Windows CMD
# $env:EXPO_PUBLIC_USE_REAL_MAPS="true"  # Windows PowerShell

npx expo run:android
```

## 4. Rebuild after changing the API key

If you add or change `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, rebuild the native app:

```bash
cd frontend
npx expo prebuild --clean
npm run android:maps
```

## Summary

| Step | Action |
|------|--------|
| 1 | Create Google Cloud project, enable Maps SDK for Android (and iOS if needed), create and restrict API key. |
| 2 | Put the key in `frontend/.env` as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...`. |
| 3 | Run `npm run android:maps` (or set `EXPO_PUBLIC_USE_REAL_MAPS=true` and `expo run:android`). |
| 4 | After changing the key, run `expo prebuild --clean` then build again. |

Without the API key or without a dev build, the Track screen shows a “Map view unavailable” message and an **Open in Google Maps** button so users can still get directions in the browser/app.

# EAS Build: Environment variables for a working app

After building with **EAS** (preview or production), the app needs these at **build time** so the built APK has the right config.

---

## Fix: "Entity not authorized" / "You don't have the required permissions"

This happens when the EAS project is owned by a **different Expo account** than the one you're logged in as (e.g. project was created under `riyaz_26` but you're logged in as `riyaz_08`).

**Option 1 – Use the account that owns the project**

- Run `eas whoami` to see who you're logged in as.
- Run `eas login` and sign in as the account that owns the project (the one that created it on expo.dev).
- Then run `eas build --platform android --profile production` again.

**Option 2 – Link this app to your current account (riyaz_08)**

1. **Create a new EAS project** under your account:
   - Go to [expo.dev](https://expo.dev) and log in as **riyaz_08**.
   - Click **Create a project** → choose **"For an existing codebase"**.
   - Name it (e.g. AssistLink) and create it. Copy the **Project ID** (e.g. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

2. **Link the repo to the new project** (in `frontend/`):
   ```bash
   eas init --id YOUR_NEW_PROJECT_ID
   ```
   Use the Project ID from step 1. This updates `frontend/app.json` with the new project.

3. **Build:**
   ```bash
   eas build --platform android --profile production
   ```

The app config is set up so that the project ID in `frontend/app.json` (written by `eas init`) is used for builds and for EAS features (e.g. notifications).

---

## Already in `eas.json`

- `EXPO_PUBLIC_APP_ENV` = `production` (set in eas.json for next build)
- `EXPO_PUBLIC_API_BASE_URL` = your Render URL
- Google Client IDs and Maps API key

## Set in EAS Dashboard (required for full features)

For **Supabase** (realtime notifications, video-call signaling), set in [expo.dev](https://expo.dev) → your project → **Environment variables** (for the **preview** and **production** profiles):

| Name | Description |
|------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Copy the values from your **frontend/.env** (same as you use for local/development). Without these, the built app will still run but **realtime notifications** and **video-call signaling** may not work.

## After changing env

Redeploy the build: run from the **frontend** directory (required so Metro and `expo/metro-config` find `node_modules`):

```bash
cd frontend
eas build --platform android --profile preview
```

(or `production`). From repo root you can run: `npm run build:android` or `npm run build:android:preview`. The new build will include the env you set.

---

## Fix: "Cannot find module 'expo/metro-config'"

This happens when EAS Build runs from the **repo root** instead of the **frontend** folder. Then `npm install` runs at root and `frontend/node_modules` is missing, so Metro in `frontend/metro.config.js` can't find `expo/metro-config`.

**Fix:** Always run EAS Build from the **frontend** directory:

```bash
cd frontend
eas build --platform android --profile production
```

Or from repo root use the script (which changes into frontend first):

```bash
npm run build:android
```

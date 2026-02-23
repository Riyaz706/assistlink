# EAS Build: Environment variables for a working app

After building with **EAS** (preview or production), the app needs these at **build time** so the built APK has the right config.

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

Redeploy the build: from `frontend/` run:

```bash
eas build --platform android --profile preview
```

(or `production`). The new build will include the env you set.

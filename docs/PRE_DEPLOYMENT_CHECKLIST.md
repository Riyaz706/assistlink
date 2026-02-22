# Pre-Deployment Checklist — Cloud Deployment (No Localhost / Local IP)

Follow these steps **before** deploying so the app works in production with **no network, database, or frontend/backend URL errors**.

---

## 1. Backend (Render) — Environment Variables

Set these in **Render Dashboard → Your Web Service → Environment**.

| Variable | Required | Value / Where to get it |
|----------|----------|-------------------------|
| **SUPABASE_URL** | Yes | Supabase → Project Settings → API → **Project URL** (e.g. `https://xxxx.supabase.co`) |
| **SUPABASE_ANON_KEY** | Yes | Supabase → Project Settings → API → **anon public** |
| **SUPABASE_SERVICE_ROLE_KEY** | Yes | Supabase → Project Settings → API → **service_role** (keep secret) |
| **DATABASE_URL** | Yes (recommended) | Supabase → Settings → Database → **Connection string** → **URI** → use **Session mode** (port **6543**), e.g. `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require` |
| **SECRET_KEY** | Yes | A long random string (e.g. 32+ chars). Used for JWT/sessions. **Do not** use `default-secret-key-please-change` in production. |
| **CORS_ORIGINS** | Yes | Either `*` (allow all) or comma-separated: your Firebase Hosting URL, Expo web URL, e.g. `https://your-app.web.app,https://your-app.firebaseapp.com` |
| **ENVIRONMENT** | Optional | Set to `production` (render.yaml sets this by default) |

- **Do not** set `SUPABASE_DB_PASSWORD` if you are using **DATABASE_URL** (pooler).  
- If the backend shows database errors, use the **pooler** URL (port **6543**), not the direct URL (port 5432). See `docs/RENDER_DATABASE_FIX.md`.

---

## 2. Frontend — No Localhost or Local IP

The app must call your **deployed backend URL** (HTTPS), not `localhost` or a LAN IP.

### 2.1 Production backend URL

- **Option A — Default in code:**  
  `frontend/app.config.js` already falls back to:
  ```js
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://assistlink-backend-1qjd.onrender.com';
  ```
  If your Render service has a **different** URL, set `EXPO_PUBLIC_API_BASE_URL` at build time (see 2.2).

- **Option B — Your own backend URL:**  
  Use your Render URL, e.g. `https://your-service-name.onrender.com` (no trailing slash).

### 2.2 Supabase (Realtime / WebRTC) — optional but recommended

If you use Realtime or video signaling, set in your build env or `frontend/.env` (and in EAS build env for mobile):

- `EXPO_PUBLIC_SUPABASE_URL` — same as backend (e.g. `https://xxxx.supabase.co`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (same as backend’s SUPABASE_ANON_KEY)

In `frontend/eas.json`, add these to the `env` block of your build profile if not already set.

### 2.3 Set API URL for builds

- **EAS (mobile):**  
  In `frontend/eas.json`, the `preview` and `production` profiles already set:
  ```json
  "EXPO_PUBLIC_API_BASE_URL": "https://assistlink-backend-1qjd.onrender.com"
  ```
  Change this to **your** Render backend URL if different.

- **Expo web / Firebase:**  
  When building or serving, set the env:
  ```bash
  EXPO_PUBLIC_API_BASE_URL=https://YOUR-BACKEND-URL.onrender.com npx expo export --platform web
  ```
  Or create a `frontend/.env.production` (and load it in your build) with:
  ```
  EXPO_PUBLIC_API_BASE_URL=https://YOUR-BACKEND-URL.onrender.com
  ```

### 2.4 Local development .env (do not use for deployment)

- Your local `frontend/.env` may have a **LAN IP** for testing (e.g. `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.21:8000`).
- **That file must not be used for production builds.** Production builds must get the **HTTPS backend URL** from:
  - EAS build env (eas.json), or  
  - `EXPO_PUBLIC_API_BASE_URL` set in the CI/build environment when running `expo export` or `eas build`.

---

## 3. Database (Supabase) — Already Cloud

- Supabase is cloud-hosted; no local DB needed for deployment.
- Ensure **migrations** are applied (e.g. run SQL from `backend/database/` and `backend/supabase/migrations/` in Supabase SQL Editor if not using Supabase CLI).
- For **emergencies** table: run `backend/database/schema_emergency.sql` (or the migration that creates `emergencies`) so emergency alerts work.
- For **notifications** with type `emergency`: if your DB has a strict `type` CHECK, run `backend/database/migrations/allow_emergency_notification_type.sql`.

---

## 4. CORS (Backend)

- In Render, **CORS_ORIGINS** must allow your frontend origin(s).
- For maximum compatibility during setup use: `*`
- For production you can restrict to:
  - Your Firebase Hosting URL(s), e.g. `https://your-app.web.app,https://your-app.firebaseapp.com`
  - Expo web URL if you host there
  - No `localhost` or `http://` in production CORS for the live app.

---

## 5. Quick Checklist Before Deploy

- [ ] **Backend (Render):** All env vars set (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, SECRET_KEY, CORS_ORIGINS). No localhost.
- [ ] **Database:** Using Supabase pooler URL (port 6543) in DATABASE_URL. Migrations applied (e.g. emergencies table, notifications type).
- [ ] **Frontend:** No localhost or 192.168.x.x in **production** build. `EXPO_PUBLIC_API_BASE_URL` points to `https://....onrender.com` in EAS / build env. If using Realtime/WebRTC, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in build env.
- [ ] **App config:** `frontend/app.config.js` default API URL is your production backend (or overridden by env in builds).
- [ ] **EAS:** In `frontend/eas.json`, `EXPO_PUBLIC_API_BASE_URL` in preview/production is your production backend URL.
- [ ] **CORS:** Backend CORS_ORIGINS includes `*` or your deployed frontend origin(s).

---

## 6. After Deployment

1. **Health check:** Open `https://YOUR-BACKEND-URL.onrender.com/health` — should return `{"status":"ok",...}`.
2. **Database check:** Open `https://YOUR-BACKEND-URL.onrender.com/health/db` (if available) to confirm DB connection.
3. **App:** In the built app, open **Settings → Connection** (if available) and run “Test connection” to confirm the app can reach the backend.
4. **Login:** Test login; if it fails, check Render logs and CORS_ORIGINS.

---

## 7. Summary of “No Localhost / No Local IP” Rules

| Item | Do **not** use in production | Use instead |
|------|------------------------------|-------------|
| Frontend API URL | `localhost`, `127.0.0.1`, `192.168.x.x`, `10.0.2.2` | `https://your-backend.onrender.com` |
| Backend CORS | Only `http://localhost:...` | `*` or your Firebase/Expo web URL(s) |
| Database | Local Postgres URL | Supabase pooler URL (port 6543) |
| Build env | `frontend/.env` with LAN IP | EAS env or `EXPO_PUBLIC_API_BASE_URL` = production URL |

Once these are set, the app is ready for cloud deployment without network, database, or frontend/backend URL errors caused by localhost or local IP.

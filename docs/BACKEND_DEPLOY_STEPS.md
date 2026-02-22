# Backend deploy steps (Render)

Follow the [PRE_DEPLOYMENT_CHECKLIST](PRE_DEPLOYMENT_CHECKLIST.md) section 1, then deploy as below.

---

## 1. Get your values

### Supabase (Dashboard → Project Settings → API)

| Variable | Where |
|----------|--------|
| **SUPABASE_URL** | API → **Project URL** (e.g. `https://xxxx.supabase.co`) |
| **SUPABASE_ANON_KEY** | API → **anon public** |
| **SUPABASE_SERVICE_ROLE_KEY** | API → **service_role** (keep secret) |

### Database (Session pooler — use port 6543)

- **Dashboard → Settings → Database → Connection string → URI**
- Choose **Session mode** (port **6543**), copy the URI.
- Example: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require`
- Set as **DATABASE_URL**. Do **not** set `SUPABASE_DB_PASSWORD` when using `DATABASE_URL`.

### SECRET_KEY

Generate a random key (run locally):

```bash
openssl rand -hex 32
```

Use the output as **SECRET_KEY** in Render. Do not use `default-secret-key-please-change` in production.

### CORS_ORIGINS

Use your frontend URLs (comma-separated, no spaces). For your current Firebase Hosting app:

```
https://assistlink-67bb3-1a64d.web.app,https://assistlink-67bb3-1a64d.firebaseapp.com
```

Or allow all (less secure): `*`

---

## 2. Create or update the service on Render

**Option A — Blueprint (recommended if repo has `render.yaml`)**  
1. [Render Dashboard](https://dashboard.render.com) → **New +** → **Blueprint**.  
2. Connect GitHub and select this repo. Render will read `render.yaml` and create the web service.  
3. For each secret env var (SUPABASE_*, DATABASE_URL, SECRET_KEY, CORS_ORIGINS), fill in the value in the dashboard. Then **Apply**.

**Option B — Manual**  
1. Go to [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**.
2. Connect your **GitHub** account and select the repo (e.g. `ASSISTLINKFINAL-main` or your fork).
3. Configure:
   - **Name:** `assistlink-backend` (or any name; your URL will be `https://<name>.onrender.com`)
   - **Region:** e.g. Singapore (or your choice)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Environment variables** — Add each key and value (click **Add Environment Variable**):

   | Key | Value |
   |-----|--------|
   | `PYTHON_VERSION` | `3.9.18` |
   | `ENVIRONMENT` | `production` |
   | `SUPABASE_URL` | *(from Supabase)* |
   | `SUPABASE_ANON_KEY` | *(from Supabase)* |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase)* |
   | `DATABASE_URL` | *(Supabase Session pooler URI, port 6543)* |
   | `SECRET_KEY` | *(output of `openssl rand -hex 32`)* |
   | `CORS_ORIGINS` | `https://assistlink-67bb3-1a64d.web.app,https://assistlink-67bb3-1a64d.firebaseapp.com` |

   Optional (can add later): `TWILIO_*`, `FCM_*`, `RAZORPAY_*`, `GOOGLE_*`.

5. Click **Create Web Service**. Render will build and deploy.

---

## 3. Deploy (or redeploy)

- **First time:** The service deploys after creation.
- **Later:** Push to `main` to auto-deploy, or use **Manual Deploy** in the Render dashboard.

---

## 4. Verify

- **Health:** `https://<your-service-name>.onrender.com/health`
- **DB hint:** `https://<your-service-name>.onrender.com/debug/db`  
  You should see `DATABASE_URL_set: true` and a hint that pooler (6543) is OK.

---

## 5. Point frontend at this backend

- If the backend URL is **not** `https://assistlink-backend-1qjd.onrender.com`, set `EXPO_PUBLIC_API_BASE_URL` to your new URL when building the frontend (e.g. in EAS or when running `npx expo export --platform web`).

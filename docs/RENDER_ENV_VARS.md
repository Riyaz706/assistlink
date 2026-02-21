# Render environment variables — AssistLink backend

Use this when Render asks for env vars (Deploy Blueprint / Environment tab). **You must get Supabase and Twilio values from your own accounts;** only SECRET_KEY and CORS_ORIGINS are provided below.

---

## 1. Copy-paste checklist (fill your values)

| Key | Where to get it | Your value (paste here) |
|-----|-----------------|--------------------------|
| **SUPABASE_URL** | [Supabase](https://supabase.com/dashboard) → Your project → **Settings → API** → Project URL | `https://________.supabase.co` |
| **SUPABASE_ANON_KEY** | Same page → Project API keys → **anon public** (long JWT) | |
| **SUPABASE_SERVICE_ROLE_KEY** | Same page → **service_role** (reveal and copy; keep secret) | |
| **DATABASE_URL** | **Settings → Database** → Connection string → **URI** (use Session mode or Transaction; copy the URI) | `postgresql://postgres.[ref]:[YOUR_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require` |
| **SECRET_KEY** | Use the one below (or generate your own) | See block below |
| **CORS_ORIGINS** | Your frontend URL(s); for testing you can use `*` | `*` or `https://your-app.web.app` |
| **TWILIO_ACCOUNT_SID** | [Twilio Console](https://console.twilio.com) → Account → API keys & tokens (or Dashboard) | `ACxxxxxxxx...` (optional) |
| **TWILIO_API_KEY** | Twilio → Account → API keys → Create API key → SID + Secret | `SKxxxxxxxx...` (optional) |
| **TWILIO_API_SECRET** | Same step; secret shown once when you create the key | (optional) |

---

## 2. Ready-to-use values (copy into Render)

**SECRET_KEY** (use this or generate your own with `openssl rand -hex 32`):

```
d2144923dc272a76018ad4fe347a0c08883ffaa5941077882c222b5ee2899652
```

**CORS_ORIGINS** (for testing; tighten later to your real frontend URL):

```
*
```

Or when you have a frontend URL (e.g. Firebase Hosting):

```
https://your-project-id.web.app,https://your-project-id.firebaseapp.com
```

---

## 3. Where to get each value (step-by-step)

### Supabase (required)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. **Settings** (gear) → **API**:
   - **Project URL** → use as `SUPABASE_URL`.
   - **Project API keys** → **anon public** → use as `SUPABASE_ANON_KEY`.
   - **service_role** → click Reveal → copy → use as `SUPABASE_SERVICE_ROLE_KEY`.
3. **Settings** → **Database**:
   - Under **Connection string** choose **URI**.
   - **Important for Render:** Use the **Session** or **Transaction** pooler (port **6543**), not the direct connection (port 5432). Direct `db.xxx.supabase.co:5432` often fails from Render with "Network is unreachable".
   - Copy the **pooler** URI (host like `aws-0-xx.pooler.supabase.com`, port **6543**); replace `[YOUR-PASSWORD]` with your database password.
   - Use that as `DATABASE_URL` in Render.

### Twilio (optional — for video/SMS)

1. Go to [Twilio Console](https://console.twilio.com).
2. **Account** → **API keys & tokens** (or Dashboard for Account SID).
3. **Account SID** → `TWILIO_ACCOUNT_SID`.
4. Create an **API Key**; use **SID** as `TWILIO_API_KEY` and **Secret** as `TWILIO_API_SECRET` (secret shown only once).

---

## 4. After you have the values

1. In Render → **Review Blueprint** (or your service → **Environment**).
2. Paste each value into the matching Key’s “Enter value” field.
3. Click **Deploy Blueprint** (or Save and redeploy).

**Do not commit real Supabase/Twilio keys or SECRET_KEY to git.** Only set them in Render’s Environment tab.

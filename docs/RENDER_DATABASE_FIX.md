# Render: Database connection still not fixing

## 1. Check what the backend sees

After deploy, open in a browser (use your real backend URL):

- **https://assistlink-backend-1qjd.onrender.com/health/db/env**

You should see JSON:

- `DATABASE_URL_set: true` and `using_pooler: true` → env is correct, see step 3.
- `DATABASE_URL_set: false` → **DATABASE_URL is not set in Render.** Do step 2.
- `DATABASE_URL_set: true` but `using_pooler: false` → You’re still using the **direct** URL (port 5432 or host `db.xxx`). Replace with the **pooler** URL (step 2).

## 2. Set DATABASE_URL correctly in Render

1. **Render** → your **assistlink-backend** service → **Environment**.
2. **Delete** these if they exist (so the app never uses the direct DB):
   - `SUPABASE_DB_PASSWORD`
3. **Add or edit** **DATABASE_URL**:
   - Value = **one line**, no quotes, no spaces at start/end.
   - Must be the **pooler** URI (host contains `pooler`, port **6543**), e.g.:
     ```
     postgresql://postgres.kpuspxawxrbajzevzwmp:YOUR_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - Get it from: **Supabase** → your project → **Settings** → **Database** → **Connection string** → **URI** → choose **Transaction** (or Session) → copy, replace `[YOUR-PASSWORD]` with your DB password.
4. **Save**.
5. **Manual Deploy** (or push a commit so Render redeploys).

## 3. Test DB connection

Open:

- **https://assistlink-backend-1qjd.onrender.com/health/db**

- If you see `"status": "ok", "database": "connected"` → DB is fixed. Try the app again.
- If you see `"status": "error"` → copy the **`detail`** from the JSON and use it to fix (e.g. wrong password, wrong host, firewall).

## 4. If the app still shows an error

- **Force close** the app and open it again (or clear app data / reinstall) so it’s not using an old cached error.
- Confirm the app is using the correct backend URL (e.g. **https://assistlink-backend-1qjd.onrender.com**). Check **Settings** in the app or your build env (e.g. `EXPO_PUBLIC_API_BASE_URL`).

## 5. Summary

- Use **pooler** URL (port **6543**, host `*.pooler.supabase.com`).
- Do **not** use direct URL (port **5432**, host `db.xxx.supabase.co`) on Render.
- Do **not** set **SUPABASE_DB_PASSWORD** on Render when using **DATABASE_URL** (pooler).

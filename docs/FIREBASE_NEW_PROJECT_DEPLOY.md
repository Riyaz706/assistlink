# Deploy AssistLink to a New Firebase Project or Site

You can deploy again using a **new Firebase project** (new URL, no Safe Browsing history) or add a **new Hosting site** in your current project.

---

## Option A: New Firebase project (recommended for a clean URL)

1. **Create the project in Firebase Console**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click **Add project** (or **Create a project**)
   - Name it (e.g. `assistlink-app` or `assistlink-2026`)
   - Disable Google Analytics if you don’t need it → **Create project**

2. **Enable Hosting**
   - In the project: **Build** → **Hosting** → **Get started**
   - Finish the wizard (you can skip “install CLI” if you already use it)

3. **Point the CLI to the new project**
   ```bash
   cd frontend
   firebase use <your-new-project-id>
   ```
   The **Project ID** is in Firebase Console → Project settings (gear) → **Project ID** (e.g. `assistlink-app-abc123`).

4. **Use the default site (no `site` in firebase.json)**
   - Open `frontend/firebase.json`.
   - Remove the `"site"` line so Hosting uses the default site:
   ```json
   {
     "hosting": {
       "public": "dist",
       "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
       "rewrites": [{ "source": "**", "destination": "/index.html" }]
     }
   }
   ```
   - Save the file.

5. **Build and deploy**
   ```bash
   npm run deploy:web
   ```
   Your app will be at: **https://\<your-new-project-id\>.web.app**

---

## Option B: New Hosting site in the same project (multi-site)

Use this if you want to keep the same Firebase project but get a **second URL** (e.g. to avoid the flagged one).

1. **Add a new site**
   - [Firebase Console](https://console.firebase.google.com/) → your project
   - **Build** → **Hosting** → **Add another site**
   - Enter a site ID (e.g. `assistlink-web`). Your new URL will be `https://assistlink-web.web.app` (or similar).

2. **Point config to that site**
   - Edit `frontend/firebase.json` and set the new site ID:
   ```json
   "hosting": {
     "site": "assistlink-web",
     "public": "dist",
     ...
   }
   ```

3. **Deploy**
   ```bash
   cd frontend
   npm run deploy:web
   ```

---

## After you choose

| Step | Command / action |
|------|-------------------|
| Use new project | `firebase use <project-id>` |
| Use new site | Set `"site": "your-site-id"` in `firebase.json` |
| Build + deploy | `npm run deploy:web` (from `frontend`) |

Your backend (`https://assistlink-backend-1qjd.onrender.com`) and database stay the same; only the **web app URL** changes.

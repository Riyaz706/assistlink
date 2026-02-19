# AssistLink Deployment Guide

This guide provides step-by-step instructions to deploy the AssistLink application.
- **Backend**: Deployed to [Render](https://render.com) using `render.yaml`.
- **Frontend (Web)**: Deployed to [Firebase Hosting](https://firebase.google.com) using the Expo web build.

---

## 📋 Prerequisites

1.  **GitHub Repository**: Ensure your code is pushed to a GitHub repository.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **Firebase Account**: Sign up at [firebase.google.com](https://firebase.google.com).
4.  **CLI Tools**: Ensure `firebase-tools` and `git` are installed.

---

## 🚀 Part 1: Backend Deployment (Render)

The backend is configured to use `render.yaml`, which simplifies the setup.

### Step 1.1: Verify Configuration
Ensure `render.yaml` in the root directory specifies:
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Step 1.2: Create Service on Render
1.  Go to the [Render Dashboard](https://dashboard.render.com).
2.  Click **New +** and select **Blueprint**.
3.  Connect your GitHub repository.
4.  Render will detect `render.yaml` and prompt you to approve the service creation.
5.  **Environment Variables**: You will need to provide values for the variables defined in `render.yaml` (e.g., `DATABASE_URL`, `SUPABASE_URL`, `SECRET_KEY`, etc.).

### Step 1.3: Deploy
- Click **Apply** or **Create Web Service**.
- Monitor the deployment logs.
- Once finished, note your backend URL (e.g., `https://assistlink-backend.onrender.com`).

---

## 🌐 Part 2: Frontend Deployment (Firebase Hosting)

The frontend is an Expo app that will be exported as a static web app.

### Step 2.1: Update Configuration
1.  Open `frontend/app.config.js`.
2.  Ensure `EXPO_PUBLIC_API_BASE_URL` points to your **newly deployed Render Backend URL**.
    ```javascript
    // app.config.js
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://your-backend-url.onrender.com';
    ```

### Step 2.2: Build the Web App
```bash
cd frontend
npx expo export --platform web
```
This will create a `dist` folder containing the static files.

### Step 2.3: Configure Firebase
1.  **Login to Firebase**:
    ```bash
    firebase login
    ```
2.  **Check Active Project**:
    ```bash
    firebase projects:list
    ```
    *Note: Your `firebase.json` specifies site `assistlink-riyaz-app-2026`. Ensure this site exists in your selected project, or remove the `"site"` line from `firebase.json` to use the default site.*

3.  **Deploy**:
    ```bash
    firebase deploy --only hosting
    ```

4.  **Verify**:
    - The terminal will output a Hosting URL (e.g., `https://your-project.web.app`).
    - Open it in a browser to test.

---

## 📱 Part 3: Mobile Deployment (Optional)

To deploy the Android app:
1.  **Install EAS CLI**: `npm install -g eas-cli`
2.  **Login**: `eas login`
3.  **Build**:
    ```bash
    eas build --platform android --profile preview
    ```
4.  Follow the prompts to generate an APK.

---

## ⚠️ Troubleshooting

- **Backend 503 Error**: Check Render logs. Usually due to missing environment variables or database connection issues.
- **Frontend 404/White Screen**: Ensure `firebase.json` rewrites are correct:
    ```json
    "rewrites": [ { "source": "**", "destination": "/index.html" } ]
    ```
- **CORS Issues**: If the frontend cannot talk to the backend, add your Firebase URL to the `CORS_ORIGINS` environment variable in Render.

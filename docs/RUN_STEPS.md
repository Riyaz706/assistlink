# Steps for Running AssistLink

## Prerequisites

- **Node.js** 18+
- **Python** 3.8+
- **Supabase** project (URL + anon key in backend and frontend `.env`)
- **Optional:** Android Studio (Android) or Xcode (iOS on Mac)

---

## Option A: Use hosted backend (fastest)

Your `frontend/.env` already points to the hosted API by default. You can run the app without starting the backend locally.

### 1. Frontend — first time

```bash
cd frontend
npm install
```

### 2. Start the app

```bash
npm start
# or: npx expo start
```

Then:

- **Web:** Press `w` in the terminal (or run `npm run web`). App opens at http://localhost:8081.
- **Android:** Press `a` or run `npx expo run:android` (emulator or device).
- **iOS (Mac):** Press `i` or run `npx expo run:ios`.
- **Phone (Expo Go):** Install Expo Go, same Wi‑Fi as computer, scan QR from terminal.

---

## Option B: Run backend locally + app

Use this when you need to test against your own API (e.g. multi-device or new features).

### 1. Backend — first time

```bash
cd backend
python -m venv venv

# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

pip install -r requirements.txt
```

Create `backend/.env` with at least: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (see `docs/ENV_TEMPLATE.txt`).

### 2. Start the backend

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Leave this terminal open. On your machine: API at http://localhost:8000, docs at http://localhost:8000/docs.

### 3. Point the app to your backend

Edit **`frontend/.env`** and set your machine’s **LAN IP** (not `localhost`):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:8000
```

Replace `192.168.1.XXX` with your IP:

- **Mac/Linux:** `ifconfig | grep "inet "` or `ip addr`
- **Windows:** `ipconfig`

Use the same URL for emulators and physical devices so they can all reach the backend.

### 4. Start the frontend

In a **new** terminal:

```bash
cd frontend
npm install   # first time only
npm start
```

Then press `w` (web), `a` (Android), or `i` (iOS), or scan the QR code with Expo Go.

---

## Quick reference

| Goal              | Backend                    | `frontend/.env`                                              |
|-------------------|----------------------------|--------------------------------------------------------------|
| Use hosted API    | Don’t start backend        | `EXPO_PUBLIC_API_BASE_URL=https://assistlink-backend-1qjd.onrender.com` (default) |
| Use local API     | Run uvicorn (step 2 above) | `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000`          |

**Check connection:** In the app, open **Settings → Connection** and use **Test connection** to confirm the backend is reachable.

**Two emulators / two devices:** Use the same `EXPO_PUBLIC_API_BASE_URL` (LAN IP when backend is local). See `docs/TEST_TWO_EMULATORS.md` and `docs/NETWORK_RULES.md`.

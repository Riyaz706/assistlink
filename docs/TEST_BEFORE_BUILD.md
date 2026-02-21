# How to Test AssistLink Before Building

Use this guide to run and test the app locally (web, emulator, or device) before creating a production build.

---

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.8+ (for backend)
- **Supabase** project with keys and database set up (see backend README)
- **Optional:** Android Studio (for Android emulator) or Xcode (for iOS simulator, Mac only)

---

## 1. Start the backend (API)

The app talks to the FastAPI backend. Run it locally so the frontend can call your API.

```bash
cd backend

# Create and activate a virtual environment (first time only)
python -m venv venv
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Copy .env.example to .env and fill in your Supabase URL and keys (first time only)
# Then start the server:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- On your machine: API **http://localhost:8000**, Docs **http://localhost:8000/docs**, Health **http://localhost:8000/health**
- **Apps (emulators/devices) must not use localhost.** Use your LAN IP or production URL in the app (see step 2). See [NETWORK_RULES.md](NETWORK_RULES.md).

Keep this terminal open. If you prefer to test against the hosted backend instead, skip this step and use that URL in step 2.

---

## 2. Point the frontend to your API

If you are using the **local backend** (step 1), tell the frontend to use it.

Create or edit **`frontend/.env`**:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:8000
```

For a **physical device**, use your computer’s LAN IP (backend must be reachable on the same network):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:8000
```

Replace `192.168.1.XXX` with your machine’s IP (`ifconfig` on Mac/Linux, `ipconfig` on Windows).  
If you use the **hosted backend** (e.g. Render), you can leave this unset or set it to that URL.

---

## 3. Start the frontend (Expo)

In a **new terminal**:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start Expo
npm start
# or: npx expo start
```

A QR code and menu will appear in the terminal.

---

## 4. Where to run the app

### Option A: Web (fastest)

- In the Expo terminal press **`w`**, or
- Run: `npm run web` (or `npx expo start --web`)

The app opens in the browser (e.g. **http://localhost:8081**).  
Use this to click through flows and test the UI.

### Option B: Android emulator

1. Open Android Studio and start an emulator (AVD).
2. In the Expo terminal press **`a`**, or run: `npx expo run:android`.

The app installs and runs on the emulator.

### Option C: iOS simulator (Mac only)

1. Have Xcode installed.
2. In the Expo terminal press **`i`**, or run: `npx expo run:ios`.

The app runs in the iOS simulator.

### Option D: Physical phone (Expo Go)

1. Install **Expo Go** from the App Store or Play Store.
2. Ensure phone and computer are on the same Wi‑Fi.
3. Scan the QR code from the Expo terminal with your phone’s camera (iOS) or with the Expo Go app (Android).

**Note:** If the app uses the local backend, use the `EXPO_PUBLIC_API_BASE_URL` with your computer’s LAN IP (see step 2). For tunnel mode (`npx expo start --tunnel`), the phone can reach your machine through the tunnel; the API URL still must be reachable from the phone (e.g. LAN IP or a deployed backend).

---

## 5. Manual test flows

Use ** [docs/TEST_STEPS.md](./TEST_STEPS.md)** for step‑by‑step test cases, for example:

- **Auth:** Login, Register, Forgot password, Logout
- **Care recipient:** Dashboard, Request care, Bookings, Chat
- **Caregiver:** Dashboard, Accept/decline, Schedule, Chat
- **Emergency:** Trigger SOS, “Help is on the way”, caregiver response
- **Settings & accessibility:** Large text, high contrast

Also use ** [docs/PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** for the manual test checklist (flows, offline, accessibility, empty/error states).

---

## 6. Automated tests (optional)

Run these to catch regressions before building.

### Frontend (Vitest)

```bash
cd frontend
npm run test
# or with coverage:
npm run test:coverage
```

### Backend (pytest)

```bash
cd backend
pip install -r requirements-dev.txt   # if not already
PYTHONPATH=. pytest tests/unit -v
PYTHONPATH=. pytest tests/integration -v
```

### E2E (Playwright, from repo root)

If E2E is set up (e.g. `e2e/*.spec.ts` and `playwright.config.ts`):

1. Start the frontend (e.g. `npm run web` in `frontend`).
2. In another terminal from the repo root: `npx playwright test` (or the script defined in root `package.json`).

---

## Quick reference

| Goal                    | Command / action                                      |
|-------------------------|--------------------------------------------------------|
| Backend (local)        | `cd backend && uvicorn app.main:app --reload --port 8000` |
| Frontend (Expo)        | `cd frontend && npm start`                            |
| Open in browser        | In Expo terminal press **`w`**                        |
| Android emulator       | Start AVD, then in Expo terminal press **`a`**         |
| iOS simulator          | In Expo terminal press **`i`** (Mac only)             |
| Phone (Expo Go)        | Scan QR from Expo terminal                            |
| Frontend unit tests    | `cd frontend && npm run test`                         |
| Backend tests          | `cd backend && PYTHONPATH=. pytest tests/ -v`         |
| Manual test cases      | See **TEST_STEPS.md** and **PRODUCTION_CHECKLIST.md** |

---

## Troubleshooting

- **“Network request failed” / API errors:**  
  - Backend must be running (step 1).  
  - `EXPO_PUBLIC_API_BASE_URL` must be a URL reachable by all clients (LAN IP for local backend, or production URL). Never use localhost for the app.  
  - For web, ensure CORS on the backend allows `http://localhost:8081` (or your frontend origin).

- **QR code / Expo Go not loading:**  
  - Same Wi‑Fi for phone and computer.  
  - Try `npx expo start --tunnel` if your network blocks direct connection.

- **Changes not showing:**  
  - Save files; Expo and `uvicorn --reload` should reload.  
  - If not, restart Expo (`Ctrl+C`, then `npm start` again).

Once manual and automated tests pass, you can proceed to ** [docs/BUILD_READINESS.md](./BUILD_READINESS.md)** and create a build.

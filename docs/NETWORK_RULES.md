# Network rules for App ↔ App and multi-device testing

## Critical rule (release-blocking)

- **The app MUST NOT use `localhost`, `127.0.0.1`, or `10.0.2.2` for the API.**
- All clients (Emulator A, Emulator B, real devices) MUST use a **single shared backend URL** reachable by every device:
  - **Local testing:** your machine's **LAN IP** (e.g. `http://192.168.1.5:8000`) or a **tunnel** (ngrok, cloudflared).
  - **Staging/Production:** your deployed **HTTPS** backend URL.

## Configuration

- **Frontend:** `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` (or override in app Settings → Connection).
- **Backend:** Run with `--host 0.0.0.0` so it accepts connections from the network:  
  `uvicorn app.main:app --host 0.0.0 --port 8000`
- **Backend scripts/tests:** Set `API_BASE_URL` (or `BACKEND_URL`) to the same reachable URL when running tests or scripts.

## Developer machine vs app

- On the **developer machine** (where the backend runs), you can open Swagger at `http://localhost:8000/docs` in your browser. That is only for you.
- **Apps** (emulators, phones) must never be configured with `localhost` or `127.0.0.1`; they cannot reach your machine by that address.

## Playwright / E2E

- `PLAYWRIGHT_BASE_URL` is the **web app** URL (e.g. `http://localhost:8081` for Expo web). It is not the API URL.
- The web app under test reads the API URL from `EXPO_PUBLIC_API_BASE_URL` (or production default); ensure that points to a backend reachable from the environment where tests run.

# Network Fixes Report — App ↔ App Multi-Device Testing

## Critical rule (enforced)

- **The app MUST NOT use `localhost`, `127.0.0.1`, or `10.0.2.2` for the API.**
- All clients use a **single shared backend URL** (LAN IP, tunnel, or production).

---

## 1. List of fixes (file + summary)

### Frontend

| File | Change |
|------|--------|
| `frontend/src/config/network.ts` | **New.** Centralized `getApiBaseUrlFromEnv()`, `validateNoLoopback()`, `logNetworkFailure()`, `getAppEnvironment()`. No loopback substitution. |
| `frontend/src/api/client.ts` | Removed all localhost/10.0.2.2 rewriting. Base URL from `getApiBaseUrlFromEnv()`. Startup validation with `validateNoLoopback()`. Request guard and `logNetworkFailure()` on timeout/errors. |
| `frontend/.env` | Replaced `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000` with production default `https://assistlink-backend-1qjd.onrender.com` and added `EXPO_PUBLIC_APP_ENV=development`. |
| `frontend/.env.example` | **New.** Documents `EXPO_PUBLIC_API_BASE_URL` (LAN IP or production), `EXPO_PUBLIC_APP_ENV`, and rule: never use localhost/127.0.0.1/10.0.2.2. |
| `frontend/app.config.js` | No code change; already uses production fallback when env unset (no localhost). |

### Backend (tests/scripts)

| File | Change |
|------|--------|
| `backend/tests/test_password_change.py` | BASE_URL from `API_BASE_URL` or `BACKEND_URL` env; exit with message if unset. All request URLs use `BASE_URL`. |
| `backend/tests/validation_test.py` | BASE_URL from env; exit if unset. |
| `backend/tests/reproduce_issue.py` | Replaced `http://127.0.0.1:8000` with env `API_BASE_URL`/`BACKEND_URL`; exit if unset. |
| `backend/tests/integration_test.py` | BASE_URL from env; exit if unset. |
| `backend/src/verify_api_stability.py` | BASE_URL from env; exit if unset. |
| `backend/scripts/verify_flows.py` | BASE_URL from env; exit if unset. |

### Docs and config

| File | Change |
|------|--------|
| `docs/NETWORK_RULES.md` | **New.** Single place for critical rule, configuration, and Playwright vs API URL. |
| `docs/NETWORK_FIXES_REPORT.md` | **New.** This report. |
| `docs/TEST_TWO_EMULATORS.md` | Replaced “10.0.2.2” and “localhost” in .env instructions with LAN IP; link to NETWORK_RULES. |
| `docs/TEST_BEFORE_BUILD.md` | Clarified “on your machine” vs app; first .env example uses LAN IP; note that apps must not use localhost; table row updated. |
| `docs/PAYMENT_MANUAL_STEPS.md` | Backend paragraph: apps must use LAN IP or production. Frontend .env: removed localhost option; link to NETWORK_RULES. |
| `docs/ENV_TEMPLATE.txt` | Comment and example for `API_BASE_URL` for backend scripts. |
| `README.md` | Note that mobile/multi-device must use LAN IP or production URL; link to NETWORK_RULES. |
| `playwright.config.ts` | Comment that baseURL is web app URL; API URL is EXPO_PUBLIC_API_BASE_URL. |

### Unchanged by design

- `backend/app/validators.py`: Regex still allows “localhost” as a generic URL hostname; **API base** is enforced in app config and client only.
- `backend/legacy/database.py`: `MONGO_URL` default remains for server-side DB; not the client-facing API base.
- WebRTC signaling: Uses `EXPO_PUBLIC_SUPABASE_URL` (Supabase Realtime); no backend loopback.

---

## 2. Final BASE_URL configuration

| Context | Variable | Source | Allowed values |
|---------|----------|--------|-----------------|
| **Frontend (app)** | `EXPO_PUBLIC_API_BASE_URL` | `frontend/.env` or app.config.js `extra` | LAN IP (e.g. `http://192.168.1.x:8000`), tunnel URL, or production HTTPS. **Never** localhost/127.0.0.1/10.0.2.2. |
| **Frontend default** | — | `frontend/app.config.js` / `network.ts` | When env unset and production: `https://assistlink-backend-1qjd.onrender.com`. Dev/staging: no default (empty); validation fails if unset. |
| **Backend scripts/tests** | `API_BASE_URL` or `BACKEND_URL` | Environment | Same reachable URL (LAN IP or production). Must be set for runs; no default to loopback. |

**Single source of truth (frontend):** `frontend/src/config/network.ts` — `getApiBaseUrlFromEnv()`, validated with `validateNoLoopback()` at startup and when loading override in `client.ts`.

---

## 3. App ↔ App testing confirmation

- **Emulator + Emulator:** Supported. Run backend with `--host 0.0.0.0`. Set `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` to your machine’s **LAN IP** (e.g. `http://192.168.1.5:8000`). Both emulators use the same URL.
- **Emulator + Real device:** Supported. Same LAN IP in `.env` (or override in app Settings → Connection). Device and emulator must be on same network as the host running the backend.
- **Real device + Real device:** Supported when both use the same backend URL (LAN IP or production).

**Validation:** On startup the app logs `[API] Base URL: …` or `[API]` error if BASE_URL is missing/loopback. Use **Settings → Connection → Test connection** to confirm reachability.

---

## 4. Remaining risks / limitations

1. **Local backend reachability:** If the backend runs on the developer machine, that machine’s LAN IP must be used. Changing networks (e.g. new Wi‑Fi) requires updating `.env` or the in-app override.
2. **Firewall:** Host firewall must allow inbound TCP to the backend port (e.g. 8000) from the LAN.
3. **CORS:** For web builds, backend CORS must allow the frontend origin (e.g. `http://localhost:8081` for Expo web). This does not affect mobile↔mobile testing.
4. **WebRTC / TURN:** For video calls across strict NATs, TURN may be required; current setup uses Supabase signaling; TURN/STUN for multi-device was not changed in this pass.
5. **Backend scripts:** If `API_BASE_URL`/`BACKEND_URL` is not set, test/script runs exit with an error; developers must set it (e.g. in shell or backend `.env`) for local or CI runs.

---

## 5. Quick verification

1. Backend: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`
2. Frontend `.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000` (e.g. `ifconfig` / `ipconfig` to get IP).
3. Run app on two emulators or one emulator + one device; both log the same Base URL; use Settings → Test connection on each to confirm backend reachable.

No localhost, 127.0.0.1, or 10.0.2.2 in app API configuration.

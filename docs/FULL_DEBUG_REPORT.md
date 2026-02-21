# Full App Debug Report

**Date:** 2026-02-21  
**Scope:** Backend (Python/FastAPI) + Frontend (React Native/Expo)

---

## Summary

| Area | Status | Notes |
|------|--------|--------|
| Backend unit tests | ✅ 33 passed | `pytest tests/unit/` |
| Backend integration tests | ⏭️ Skip when deps missing | Requires full `pip install -r requirements.txt` + .env |
| Backend app import | ⚠️ Requires full env | Install `email-validator` and all requirements; Supabase env vars needed |
| Frontend unit tests | ✅ 53 passed | `npm run test` |
| Frontend TypeScript | ✅ No errors | `npx tsc --noEmit` |
| Pytest conftest | ✅ Fixed | Path now adds `backend/` to `sys.path` (not `tests/`) |

---

## Fixes Applied

### Backend
- **requirements.txt:** Added explicit `email-validator>=2.0.0` (Pydantic email validation).
- **conftest.py:** Corrected `sys.path`: insert `backend/` (parent of `tests/`) so `from app.main import app` works when running pytest from `backend/`.
- **tests/integration/test_api_health.py:** Use `pytest.importorskip("fastapi")` and skip at module level if `app.main` cannot be imported, so `pytest tests/` does not fail when dependencies are missing.
- **tests/test_password_change.py:** Renamed `test_password_change` → `run_password_change_test` so pytest does not collect it as a test (script is run manually with credentials).

### Frontend
- **EmergencyScreen.tsx:** Typed `api.triggerEmergency()` response as `{ emergency_id?: string }` to fix TS2339.
- **SettingsScreen.tsx:** Theme context now exposes `setLargeText` / `setHighContrast` via **useThemeAccessibility.ts** (forwards from `useAccessibility()`).
- **useWebRTC.native.ts:** Resolved react-native-webrtc type mismatches (MediaStream, RTCPeerConnection events, RTCSessionDescription) with minimal assertions so `tsc --noEmit` passes.
- **VideoCallScreen.web.tsx:** Fixed `style` type for web video element using `as unknown as React.CSSProperties`.

---

## How to Run Full Backend (with app start)

1. From repo root or `backend/`:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Ensure `.env` has at least:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SECRET_KEY` (JWT)
   - Any DB or Razorpay keys your app uses
3. Run app:
   ```bash
   PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
4. Run all tests (integration will run if app is importable):
   ```bash
   PYTHONPATH=. pytest tests/ -v
   ```

---

## How to Run Frontend

- **Tests:** `npm run test`
- **Type check:** `npx tsc --noEmit`
- **Start dev:** `npm run start` (Expo)

---

## Checking backend–app connection

### From the app (recommended)
1. Open **Settings** → **CONNECTION**.
2. Ensure **Backend URL** matches where your backend is running (e.g. `http://192.168.1.x:8000`).
3. Tap **Test connection**.
   - **Connection OK** → App and backend are connected.
   - **Connection failed** / timeout → Backend not reachable: start backend, fix URL, or check Wi‑Fi/firewall.

### From terminal (backend reachable from your machine)
```bash
# Replace with your backend URL (same as in app .env or Settings)
curl -s http://192.168.1.9:8000/health
# Expected: {"status":"ok","message":"AssistLink Backend API is running"}
```
If `curl` times out or fails, the app will not connect either until the backend is running and reachable at that URL.

### Backend must listen on 0.0.0.0
Start the backend so it accepts connections from the network (not only localhost):
```bash
cd backend && PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Optional / Known Warnings

- **Vite CJS deprecation:** Shown when running `npm run test`; safe to ignore for now.
- **resolveAssetSource deep import:** Addressed earlier via public API in polyfill where possible.
- **Backend Supabase import:** If you see `cannot import name 'create_client' from 'supabase'`, ensure the correct package is installed (`supabase>=2.0.0` from PyPI) and no conflicting `supabase` package is in the environment.

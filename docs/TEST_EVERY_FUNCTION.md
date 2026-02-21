# Test Every Function — AssistLink

Use this guide to test **each function** in the app: run automated tests first, then verify critical flows manually or via API.

---

## 1. Run all automated tests

### Backend (FastAPI + pytest)

From repo root or `backend/`:

```bash
cd backend
pip install -r requirements.txt -q
PYTHONPATH=. pytest tests/ -v
```

- **Unit tests:** `tests/unit/` (validators, etc.)
- **Integration tests:** `tests/integration/` (health, auth contract)
- **From repo root:** `npm run test:backend`

Backend must be **installable** (no need for server running for unit/integration tests that use `TestClient`).

### Frontend (Vitest)

From repo root or `frontend/`:

```bash
cd frontend
npm install -q
npm run test
```

- **Unit tests:** hooks, utils, validation, emergency payload
- **Component tests:** Login form, etc.
- **From repo root:** `npm run test`

### E2E (Playwright — web only)

Start the **web** app and backend, then run E2E:

```bash
# Terminal 1: backend
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: frontend (web)
cd frontend && npm run web

# Terminal 3: E2E (from repo root)
npx playwright test
```

- **From repo root:** `npm run e2e` (playwright can start frontend automatically; backend must be running).
- Tests live in `e2e/` (e.g. emergency flow).

### Run backend + frontend tests in one go (no E2E)

From **repo root**:

```bash
npm run test:backend && npm run test
```

E2E is separate because it needs the app and API running.

---

## 2. Manual / API test by function

For **each function**, you can:

1. **API (Swagger):** Open **http://localhost:8000/docs**, find the endpoint, use “Try it out” with a valid token (from login).
2. **App (device/emulator):** Follow the steps in **docs/TEST_STEPS.md** (per-feature test cases).
3. **Quick checklist:** Use the table below.

Ensure **backend** is running (`uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`) and **frontend** points to it (`EXPO_PUBLIC_API_BASE_URL` in `frontend/.env`).

| Area | Function | How to test |
|------|----------|-------------|
| **Auth** | Register | Swagger: `POST /api/auth/register` with role `care_recipient` or `caregiver`. App: RegisterScreen, create account. |
| | Login | Swagger: `POST /api/auth/login` → copy `access_token`. App: LoginScreen. |
| | Refresh / Me / Logout | Swagger: use token in Authorize; `GET /api/auth/me`, `POST /api/auth/logout`. App: Settings → Logout. |
| | Forgot / Change password | Swagger: `POST /api/auth/reset-password`, `POST /api/auth/change-password`. App: Forgot password link; Change password in settings. |
| **Users** | Get/Update profile | Swagger: `GET /api/users/profile`, `PUT /api/users/profile` (with token). App: ProfileScreen, edit profile. |
| **Caregivers** | List / Get by ID | Swagger: `GET /api/caregivers`, `GET /api/caregivers/{id}`. App: Matchmaking, caregiver list. |
| | Caregiver profile (create/update) | Swagger: `POST /api/caregivers/profile`, `PUT /api/caregivers/profile` (caregiver token). App: Caregiver onboarding / profile. |
| **Bookings** | Create | Swagger: `POST /api/bookings` (care_recipient token). App: New request, select caregiver, date, submit. |
| | Get / History / Notes | Swagger: `GET /api/bookings/{id}`, `GET /api/bookings/{id}/history`, `POST /api/bookings/{id}/notes`. App: Booking detail screen. |
| | Respond (accept/reject) | Swagger: `POST /api/bookings/{id}/respond` (caregiver token, body `{"status":"accepted"}` or `"rejected"`). App: Caregiver → booking → Accept/Decline. |
| | Update status / Cancel | Swagger: `PATCH /api/bookings/{id}/status` (body `{"status":"cancelled","reason":"..."}`). App: Booking detail → Cancel; or Complete. |
| **Video call (pre-call)** | Request / Accept / Join / Status | Swagger: `POST /api/bookings/video-call/request`, `POST .../video-call/{id}/accept`, `POST .../join`, `GET .../status`. App: Schedule, notifications. |
| | Complete video call | Swagger: `POST /api/bookings/video-call/{id}/complete`. App: End call in VideoCallScreen. |
| **Payments** | Create order / Verify | Swagger: `POST /api/payments/create-order`, `POST /api/payments/verify`. App: PaymentScreen (Razorpay). |
| **Emergency** | Trigger | Swagger: `POST /api/emergency/trigger` (body `{"location":{...}}`). App: EmergencyScreen → hold SOS 3s. |
| | Acknowledge / Resolve / Status | Swagger: `POST /api/emergency/{id}/acknowledge`, `POST .../resolve`, `GET /api/emergency/status/{id}`. App: Caregiver → emergency alert → I'm on my way / Resolve. |
| **Chat** | Sessions / Messages | Swagger: chat endpoints under `/api/` (if exposed). App: Chat list, open thread, send message. |
| **Notifications** | List / Mark read | Swagger: notifications endpoints. App: NotificationsScreen. |
| **Dashboard** | Stats / Bookings | Swagger: `GET /api/dashboard/stats`, booking list endpoints. App: CareRecipientDashboard, CaregiverDashboard. |
| **Reviews** | Submit / List | Swagger: review endpoints. App: Booking detail → Rate service. |

---

## 3. Get a token for Swagger

1. **Login:** `POST /api/auth/login` with `{"email":"...","password":"..."}`.
2. Copy `access_token` from the response.
3. In Swagger UI, click **Authorize**, paste: `Bearer <access_token>`, then **Authorize**.
4. All subsequent requests will send the token.

Use a **care_recipient** account for care-recipient-only endpoints and a **caregiver** account for caregiver-only endpoints (e.g. respond to booking, emergency acknowledge).

---

## 4. References

- **Step-by-step test cases (manual):** [TEST_STEPS.md](./TEST_STEPS.md)  
- **Function checklist (status):** [FUNCTION_CHECKLIST.md](./FUNCTION_CHECKLIST.md)  
- **API examples (Swagger + cURL):** [API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md)  
- **Test strategy (what to automate):** [TEST_STRATEGY.md](./TEST_STRATEGY.md)  
- **Before build (run backend + frontend):** [TEST_BEFORE_BUILD.md](./TEST_BEFORE_BUILD.md)

---

## 5. Quick commands summary

| Goal | Command (from repo root) |
|------|---------------------------|
| Backend tests only | `npm run test:backend` or `cd backend && PYTHONPATH=. pytest tests/ -v` |
| Frontend tests only | `npm run test` or `cd frontend && npm run test` |
| Backend + frontend | `npm run test:backend && npm run test` |
| E2E (web) | Start backend + `npm run web` in frontend, then `npm run e2e` |
| API docs | Backend running → http://localhost:8000/docs |

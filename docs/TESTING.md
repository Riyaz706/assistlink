# AssistLink — Testing Guide

## 1. Test strategy

See **[docs/TEST_STRATEGY.md](./TEST_STRATEGY.md)** for:

- What is unit-, integration-, and E2E-tested
- What is not automated
- Risk-based prioritization (P0–P3)

---

## 2. Unit tests (Vitest)

**Purpose:** Validate pure logic: validators, role fallback, date/booking helpers, error classification, emergency payload.  
**Type:** Unit.  
**Location:** `frontend/src/**/*.test.{ts,tsx}`.

### Run

```bash
cd frontend
npm run test
# or
npm run test:coverage
```

### Expected output

- All tests pass (e2e/auth may be skipped if no server).
- Coverage report if using `test:coverage`.

### Failure meaning

- **validation.test.ts:** Client-side validation or `getRoleForNavigation` / `bookingSlotsOverlap` bug; fix before release.
- **emergencyPayload.test.ts:** Emergency trigger payload or status type bug; fix before release.
- **useErrorHandler.test.ts:** Error classification or retry behavior regression; fix before release.
- **LoginForm.test.tsx:** Form validation or submit flow regression; fix before release.

---

## 3. Backend unit tests (pytest)

**Purpose:** Validate backend validators (email, phone, password, role, booking status, coordinates, etc.).  
**Type:** Unit.  
**Location:** `backend/tests/unit/test_validators.py`.

### Run

```bash
cd backend
pip install -r requirements-dev.txt   # or: pip install pytest
PYTHONPATH=. pytest tests/unit -v
```

### Expected output

- All validator tests pass.

### Failure meaning

- Invalid data could reach DB or API; fix validators before release.

---

## 3b. Backend API integration (pytest + TestClient)

**Purpose:** Health and auth contract (root, health, login validation) without real Supabase.  
**Type:** Integration.  
**Location:** `backend/tests/integration/test_api_health.py`.

### Run

```bash
cd backend
# Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY if app loads DB
PYTHONPATH=. pytest tests/integration -v
```

### Expected output

- Root and health return 200; login with invalid body returns 422.

### Failure meaning

- App or routing broken; or missing env (Supabase) when app loads.

---

## 4. Component tests (Vitest + RTL)

**Purpose:** Test real user behavior: render, input, validation, submit, error display.  
**Type:** Component.  
**Location:** `frontend/src/__tests__/LoginForm.test.tsx`.

### Run

Same as unit tests: `cd frontend && npm run test`.

### Failure meaning

- UI or form flow regression; fix component and/or validation.

---

## 5. E2E tests (Playwright)

**Purpose:** Full browser flows: auth, emergency access, accessibility (focus, landmarks).  
**Type:** E2E.  
**Location:** `e2e/*.spec.ts`.

### Prerequisites

- Web app URL: start with `cd frontend && npm run web` (Expo web, usually http://localhost:8081).
- Or set `PLAYWRIGHT_BASE_URL` if the app runs elsewhere.

### Run

```bash
# From repo root (installs Playwright if needed)
npm install
npx playwright install chromium
npm run e2e
```

With existing server:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8081 npx playwright test
```

### Expected output

- Auth: Login screen, validation on empty submit, navigate to Register, invalid login shows error.
- Emergency: Emergency screen reachable when logged in; instruction text visible.
- Accessibility: Focusable inputs and button; no duplicate main landmarks.

### Failure meaning

- **auth.spec.ts:** Login/register or navigation broken; fix auth or routing.
- **emergency.spec.ts:** Emergency not reachable or copy missing; fix navigation or copy.
- **accessibility.spec.ts:** Focus or landmark regression; fix a11y.

---

## 6. Accessibility

- **Unit/component:** Use `@testing-library/jest-dom` and assert on labels, roles, and visibility.
- **E2E:** `e2e/accessibility.spec.ts` checks focus and landmarks.
- Optional: add `@axe-core/playwright` and fail on a11y violations (see TEST_STRATEGY.md).

---

## 7. Performance and resilience

- **Strategy:** See TEST_STRATEGY.md (slow network, timeout, offline, GPS denied).
- **Implementation:** Add in Vitest (e.g. mock slow `fetch`) and in Playwright (e.g. `page.route` to simulate offline) as needed.

---

## 8. Quick reference

| What              | Command (from repo root)        | Location              |
|-------------------|---------------------------------|------------------------|
| Frontend unit + component | `cd frontend && npm run test`   | `frontend/src/**/*.test.*` |
| Backend unit      | `cd backend && PYTHONPATH=. pytest tests/unit -v` | `backend/tests/unit/` |
| Backend API       | `cd backend && PYTHONPATH=. pytest tests/integration -v` | `backend/tests/integration/` |
| E2E               | `npm run e2e`                   | `e2e/*.spec.ts`        |
| Coverage          | `cd frontend && npm run test:coverage` | —                  |

---

*End of Testing Guide*

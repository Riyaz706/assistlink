# AssistLink — Automated Test Strategy

**Version:** 1.0  
**Last updated:** 2025-02-20  
**Scope:** AssistLink PWA (Expo/React Native with web; FastAPI + Supabase backend)

---

## 1. Testing Stack (Fixed)

| Layer | Tool | Purpose |
|-------|------|--------|
| Unit (frontend) | **Vitest** | Utilities, validators, hooks, pure logic |
| Component (frontend) | **React Testing Library** + Vitest | UI behavior, forms, API triggers, errors |
| Unit (backend) | **pytest** | Routers, services, validators |
| API / Integration | **pytest** + **httpx** | Auth, bookings, chat, emergency; DB side-effects |
| E2E (web) | **Playwright** | Full user/caregiver/emergency flows on web build |
| Mocking | **MSW** (frontend), **pytest fixtures** (backend) | API mocking where needed |
| Accessibility | **jest-axe** / **@axe-core/playwright** | A11y regression; fail tests on violations |

**Note:** Frontend is Expo/React Native with `expo start --web`. E2E runs against the **web** build. Native E2E (Detox/Maestro) is out of scope unless added later.

---

## 2. What to Unit Test

| Area | Examples | Why |
|------|----------|-----|
| **Utility functions** | Date formatting, ISO parsing, phone/email regex | No UI; easy to hit edge cases. |
| **Form validators** | Email, password strength, phone, DOB, role | Invalid input must be rejected; no fake assertions. |
| **Role-based logic** | `user?.role ?? 'care_recipient'`, route guards | Caregiver vs care recipient must never be wrong. |
| **Date/time helpers** | Booking windows, “next 7 days”, conflict windows | Timezone and boundary bugs are high risk. |
| **Booking conflict detection** | Overlapping slots, recurring vs one-time | Prevents double-booking. |
| **Emergency trigger logic** | Payload shape, location fallback, status transitions | Safety-critical. |
| **Error classification** | `isNetworkError`, `isAuthError`, `extractErrorMessage` | Correct user messaging and retries. |
| **API client helpers** | Token attach, refresh, timeout, `safeApi` fallback | Auth and resilience. |

**Backend (pytest):** Validators (schemas), dependency logic (`get_user_id`, role checks), notification payloads, emergency status transitions.

**Coverage target:** Minimum **80%** for covered modules; **100%** for validators and role/emergency logic. Edge cases and invalid inputs are **mandatory**.

---

## 3. What to Integration Test

| Area | What | How |
|------|------|-----|
| **Auth** | Login, register, refresh, /me, role in response | pytest + httpx; mock Supabase Auth or use test project. |
| **Role enforcement** | Caregiver-only and care-recipient-only endpoints return 403 for wrong role | API tests with two token types. |
| **Booking creation** | Create booking → DB row + correct status; care recipient vs caregiver | API test + assert on Supabase (or mocked DB). |
| **Chat** | Send message → persistence; session list by role | API test; validate message in DB or mock. |
| **Emergency** | Trigger → row in `emergencies`; acknowledge/resolve/status | API test; stub or real `emergencies` table. |
| **Notifications** | Trigger creates notification row / push payload | Assert side-effects; mock FCM. |

**Rules:** Mock only **external** APIs (e.g. Twilio, FCM, Google OAuth). Prefer **real Supabase test project** for DB; if not available, use **MSW** (frontend) and **pytest fixtures** (backend) to mock Supabase client responses. Every integration test must validate **observable outcome** (status code, response body, and where possible DB state).

---

## 4. What to E2E Test (Playwright)

Target: **Web** build (`expo start --web` or production web bundle). One browser (e.g. Chromium) is enough for CI; multi-browser optional.

| Flow | Happy path | Failure path | Offline / GPS |
|------|------------|--------------|----------------|
| **User: Register → Login → Dashboard** | Full flow; role = care recipient; dashboard visible | Invalid email/password; duplicate email; wrong role | — |
| **User: Caregiver search → Booking** | Search → select caregiver → fill form → submit → confirmation | Validation errors; API error; no caregivers | Network offline on submit |
| **User: Chat → Video call** | Open chat → send message → start video (or “not supported”) | Send fails; video token fails | — |
| **User: Service completion → Feedback** | Complete booking → submit rating | Already completed; invalid rating | — |
| **Caregiver: Login → Booking notification** | Login → see request → open detail | No requests; 403 on user-only screen | — |
| **Caregiver: Accept booking → Chat → Complete** | Accept → chat → mark complete | Reject; already accepted by another | — |
| **Emergency: Trigger from any page** | Open emergency → hold 3s → alert sent; location shown | API error → user sees “call 911” message | GPS denied → location “not available”; offline → queue or error message |
| **Emergency: Alert propagation** | Caregiver sees alert; acknowledge → resolve | Invalid emergency_id; already resolved | — |
| **Emergency: UI lock behavior** | During trigger, no double submit; loading state | — | — |

Each E2E must include at least: **happy path**, **one failure path**, and where relevant **network offline** and **GPS denied** (or simulated).

---

## 5. What NOT to Automate (Or Only Lightly)

| Item | Reason |
|------|--------|
| **Visual/UI pixel perfection** | Flaky; use design reviews and optional visual regression later. |
| **Third-party OAuth popups** | Fragile; mock in E2E or test “after callback” only. |
| **Real Twilio/WebRTC media** | Use “video not supported” path and mock token endpoint. |
| **Real push delivery (FCM)** | Mock; test only “notification created” and payload. |
| **Full native builds (iOS/Android)** | Out of scope for this strategy; E2E on web only. |
| **Snapshot-only tests** | Disallowed; snapshots only as optional supplement, not primary assertion. |
| **Tests that don’t assert outcome** | Every test must assert UI state, API response, or error handling. |

---

## 6. Risk-Based Prioritization

| Priority | Area | Risk | Test focus |
|----------|------|------|------------|
| **P0** | Emergency trigger & propagation | User safety; legal | Unit (payload, status); API (trigger/ack/resolve); E2E (trigger, GPS denied, offline). |
| **P0** | Auth & role (login, register, /me, guards) | Wrong dashboard; caregiver sees user data | Unit (role fallback); API (403 for wrong role); E2E (login, role-specific screens). |
| **P1** | Booking create/accept/complete | Revenue and trust | Unit (conflict, dates); API (create, status); E2E (book, accept, complete). |
| **P1** | Chat send & persistence | Care coordination | API (send, list); E2E (send message, error). |
| **P2** | Notifications, settings, profile | UX | Unit + API where needed; E2E for critical paths only. |
| **P2** | Accessibility | Compliance and inclusivity | Automated a11y (keyboard, labels, contrast, ARIA); fail on regression. |
| **P3** | Performance, slow network, timeouts | Resilience | Dedicated resilience suite (3G, timeout, Supabase down, realtime disconnect). |

Execution order in CI: **P0 → P1 → P2 → P3**. Failures in P0/P1 block release.

---

## 7. Test Types Summary

| Type | Tool | Scope | Failure meaning |
|------|------|--------|------------------|
| **Unit** | Vitest (frontend), pytest (backend) | Pure logic, validators, role, dates, emergency | Logic bug or missing edge case. |
| **Component** | RTL + Vitest | Forms, buttons, loading, errors, API trigger | UI or integration bug; regression. |
| **API / Integration** | pytest + httpx | Auth, bookings, chat, emergency, DB | Backend contract or side-effect bug. |
| **E2E** | Playwright | User / caregiver / emergency flows on web | End-to-end flow or environment bug. |
| **Accessibility** | jest-axe, @axe-core/playwright | Labels, keyboard, contrast, ARIA | A11y regression; must fix before release. |
| **Resilience** | Vitest + Playwright | Slow network, timeout, offline, GPS denied | App must degrade safely. |

---

## 8. Environment and CI

- **Frontend unit/component:** Node; Vitest; optional coverage threshold 80%.
- **Backend unit/API:** Python 3.x; pytest; env with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (test project) or mocks.
- **E2E:** Playwright; start web app (e.g. `expo start --web` or built web) then run against `http://localhost:8081` (or configured port).
- **No fake assertions:** Every test must assert a real condition (state, response, or error).
- **Failure meaning:** Documented in strategy and in test file headers/comments where helpful.

---

*End of Test Strategy*

# AssistLink — Production Release Certification Report

**Role:** Principal QA Engineer, Production SRE, Release Manager  
**Application:** AssistLink (elderly and differently-abled users)  
**Testing mode:** Hard / destructive  
**Date:** 2025-02-20

---

## 1. Issue Found → Fix Summary

### 1.1 Token refresh failure left tokens in memory

| Field | Detail |
|-------|--------|
| **How it was triggered** | Session expiry mid-flow; refresh endpoint fails (network or 401). Catch block in client did not clear tokens. |
| **Impact on user** | Subsequent requests used stale token, got 401, no automatic redirect to login; confusing state. |
| **Root cause** | In `api/client.ts`, the `catch (refreshError)` block did not call `setAccessToken(null)` / `setRefreshToken(null)`. |
| **Fix implemented** | In `frontend/src/api/client.ts`, on refresh failure or throw during refresh, clear access and refresh tokens so UI can show login. |
| **Test added** | Manual: expire token, force refresh to fail → verify tokens cleared and user can log in again. (Automated test can mock refresh failure and assert token cleared.) |

---

### 1.2 Emergency double-trigger and no offline message

| Field | Detail |
|-------|--------|
| **How it was triggered** | Rapid press-and-hold or animation firing twice; or trigger when device is offline. |
| **Impact on user** | Duplicate emergency alerts; or generic “Could not send” with no clear “you’re offline — call 911”. |
| **Root cause** | No guard against concurrent `triggerEmergency`; network error message did not distinguish offline. |
| **Fix implemented** | (1) `triggerInProgressRef` to block overlapping triggers. (2) SOS button `disabled={locationLoading}` and loading spinner while sending. (3) On failure, if `error.code === 'NETWORK_ERROR'` or `'TIMEOUT'` or message suggests network/timeout, show: “You appear to be offline. The app could not send the alert. Call 911 or your emergency contact now.” |
| **Test added** | Manual: hold SOS until sent, then try again (should not double-send). Turn off network and trigger (should see offline message). |

---

### 1.3 Payment double-submit

| Field | Detail |
|-------|--------|
| **How it was triggered** | Double-tap “Pay Now” before `setLoading(true)` re-render. |
| **Impact on user** | Two create-order or verify calls; possible duplicate charges or inconsistent UI. |
| **Root cause** | Only `loading` state disabled button; no ref guard for in-flight submit. |
| **Fix implemented** | `submittingRef` set true at start of `handlePayment`, false in `finally`; early return if `submittingRef.current`. Button remains `disabled={loading || !canPay}`. |
| **Test added** | Manual: rapid double-tap Pay Now → only one request. (E2E: assert single create-order per tap.) |

---

### 1.4 completePayment 404

| Field | Detail |
|-------|--------|
| **How it was triggered** | Any code path calling `api.completePayment(bookingId)` (e.g. video call end). |
| **Impact on user** | Request to non-existent `POST /api/bookings/{id}/complete-payment` → 404, possible error toast or broken flow. |
| **Root cause** | Frontend defined `completePayment` against a route that was never implemented; backend has `POST /api/bookings/video-call/{id}/complete` instead. |
| **Fix implemented** | In `frontend/src/api/client.ts`, `completePayment(id)` now calls `POST /api/bookings/video-call/{id}/complete`. Backend accepts either booking_id or video_call_id. |
| **Test added** | Manual: end video call from screen that uses completePayment → no 404. (API test: POST video-call complete with booking id.) |

---

### 1.5 Network/timeout not treated as network errors in UI

| Field | Detail |
|-------|--------|
| **How it was triggered** | API client throws with `code: 'TIMEOUT'` or `'NETWORK_ERROR'`; UI uses `isNetworkError()`. |
| **Impact on user** | Wrong or generic error message instead of “check connection” or “timeout”. |
| **Root cause** | `isNetworkError()` in `useErrorHandler.ts` did not check `error.code === 'NETWORK_ERROR'` or `'TIMEOUT'`. |
| **Fix implemented** | Extended `isNetworkError()` to include `error?.code === 'NETWORK_ERROR'`, `error?.code === 'TIMEOUT'`, and `msg.includes('timeout')`. |
| **Test added** | Unit test in `useErrorHandler.test.ts`: assert `isNetworkError({ code: 'NETWORK_ERROR' })` and `isNetworkError({ code: 'TIMEOUT' })` are true. |

---

### 1.6 Emergency “Navigate to Location” did nothing useful

| Field | Detail |
|-------|--------|
| **How it was triggered** | Caregiver taps “Navigate to Location” on emergency screen. |
| **Impact on user** | Only an alert “Navigating to recipient's location...”; no maps opened. |
| **Root cause** | Button had no integration with location data or maps URL. |
| **Fix implemented** | Use `locationInfo` or `data` for latitude/longitude; if present, open Google Maps URL via `Linking.openURL` (web: `?q=lat,lng`, native: directions URL). If location missing, show: “Location Unavailable. Recipient's location was not shared. Try calling them instead.” Added `accessibilityLabel` and `accessibilityRole`. |
| **Test added** | Manual: open emergency with location → tap Navigate → maps open. Without location → tap → alert shown. |

---

## 2. Critical Areas Verified (No Code Change or Documented Limitation)

| Area | Result | Notes |
|------|--------|--------|
| **Auth 401 after refresh** | OK | Client clears tokens on refresh failure; AuthContext clears user on 401 when no token. |
| **Login/Register double submit** | OK | Buttons `disabled={loading}`; loading set at start of async handler. |
| **API timeout** | OK | 30s AbortController; throws with user-friendly timeout message. |
| **Offline queue** | OK | Syncable paths queued; emergency intentionally not queued (fail-fast with clear message). |
| **Role enforcement (backend)** | OK | `verify_care_recipient` / `verify_caregiver` enforce role; payment create-order requires care_recipient. |
| **Emergency from any screen** | OK | EmergencyScreen is in common stack; reachable from both roles. |
| **Permission denied (camera/mic)** | OK | WebRTC flow shows permission-denied message and “Try again” (VideoCallScreen.web / useWebRTC). |
| **WebRTC disconnect** | OK | useWebRTC sets status to reconnecting; UI shows reconnecting banner. |

---

## 3. Known Limitations (Non–Release Blocking)

| Limitation | Mitigation |
|------------|------------|
| **Expo Go:** No native Razorpay, no Twilio video | Backend bypass mode for payment; WebRTC on web; clear in-app message for payment/video in Expo Go. |
| **Maps on web** | Mock used; map does not render. Users can use external maps or native app. |
| **Push notifications** | Require FCM and backend config; in-app notifications work without push. |
| **Emergency when offline** | No queue; user sees explicit “You appear to be offline. Call 911 or your emergency contact now.” |
| **verify_care_recipient role auto-update** | Backend can update user role to care_recipient in edge cases; document and consider removing auto-update in future. |

---

## 4. Conditions for Release

- **Backend:** Supabase configured; payment migration applied (`add_payment_fields.sql`, and `fix_payment_status_captured.sql` if needed). Razorpay bypass or live keys as chosen.
- **Frontend:** `EXPO_PUBLIC_API_BASE_URL` correct for environment; for PWA WebRTC, Supabase URL and anon key set.
- **Emergency:** `emergencies` table present for full behavior; otherwise backend returns stub and user sees message.
- **Manual smoke test:** Login → create/accept booking → payment (bypass or real) → emergency trigger (with network and offline) → video call (web or native as applicable).

---

## 5. Release Readiness Verdict

**Verdict: PASS — with conditions**

- **Critical issues addressed:** Token cleanup on refresh failure, emergency double-trigger and offline messaging, payment double-submit guard, completePayment 404 fixed, network/timeout treated as network errors, emergency Navigate opens maps or shows clear fallback.
- **No known crash, freeze, or silent failure** in the flows audited under stress, network failure, and permission denial.
- **Conditions:** Deploy only after completing the “Conditions for Release” above and running the recommended smoke test. Monitor errors (e.g. Sentry) post-launch.

---

## 6. Regression Test Checklist (Manual / E2E)

- [ ] Login with invalid credentials → error message, no crash.
- [ ] Login, then force token expiry and trigger API call → refresh or redirect to login.
- [ ] Double-tap Login / Register / Pay Now → single request, no duplicate action.
- [ ] Turn off network → trigger emergency → “offline” message; turn on → retry works.
- [ ] Emergency: press and hold 3s → one alert; loading then success state.
- [ ] Emergency (caregiver): Navigate to Location with/without location data → maps or “Location Unavailable”.
- [ ] Payment (bypass): Pay Now → success and navigation; no double charge.
- [ ] End video call (where completePayment is used) → no 404.
- [ ] Camera denied in web video call → permission message and retry/leave.

---

*This report is part of the production-readiness audit. Stability, clarity, and safety were prioritized over features and convenience.*

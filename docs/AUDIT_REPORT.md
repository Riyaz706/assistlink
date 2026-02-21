# AssistLink — Project Audit Report

**Date:** 2025-02-20  
**Scope:** Full codebase audit per PRD and global rules (no dummy buttons, no silent failures, proper error handling, role-based access).

---

## 1. Summary

| Severity | Count |
|----------|--------|
| Critical | 5 |
| Medium  | 12 |
| Low     | 8   |

---

## 2. Critical Issues

### 2.1 Backend: Emergency router fully stubbed (emergency.py)

- **File:** `backend/app/routers/emergency.py`
- **Issue:** All endpoints return stub responses; no `emergencies` table, no real alerts to caregivers/contacts, no location persistence.
- **Why broken:** Emergency flow is required from any screen; users expect real alerts and location sharing.
- **Fix strategy:** Implement real emergency flow: (1) Create/use `emergencies` table in Supabase with user_id, location, status, created_at. (2) On trigger, insert row, fetch user's emergency_contacts and assigned caregivers, create notifications (and optionally push). (3) Acknowledge/resolve/status endpoints read-write from same table. If table does not exist, document migration and keep stub with clear user-facing message.

### 2.2 Frontend: EmergencyScreen — invalid JSX in template literal

- **File:** `frontend/src/EmergencyScreen.tsx` (approx. line 229)
- **Issue:** `` `Press and hold for ${<Text style={styles.boldText}>3 seconds</Text>}` `` — JSX inside template literal renders as `[object Object]`, not "3 seconds".
- **Why broken:** React does not render JSX inside string interpolation.
- **Fix strategy:** Use fragment or separate Text components, e.g. `<Text>Press and hold for <Text style={styles.boldText}>3 seconds</Text></Text>`.

### 2.3 Frontend: EmergencyScreen — hardcoded location and placeholder data

- **File:** `frontend/src/EmergencyScreen.tsx`
- **Issue:** Care recipient view shows "Location shared: Near 123 Maple Ave" when location may be from API; caregiver view uses `locationInfo` but recipient view does not show actual shared location from trigger response.
- **Why broken:** PRD requires auto location sharing and real-time updates; hardcoded text is misleading.
- **Fix strategy:** Store location from `api.triggerEmergency` response (or state) and display it for both roles; show "Location not available" when missing; remove "123 Maple Ave".

### 2.4 Auth: /me must return consistent user profile including role

- **File:** `backend/app/routers/auth.py` (get_current_user_profile), `frontend/src/context/AuthContext.tsx`
- **Issue:** Frontend navigation uses `user.role === 'caregiver'` to switch stacks. If `/me` returns auth user without DB role (e.g. after Google login before profile exists), role can be missing and routing breaks.
- **Why broken:** Role-based stacks depend on `user.role`; missing role sends wrong dashboard.
- **Fix strategy:** Backend `/me` already returns full users row (with role). Ensure auto-provision in `/me` sets role from metadata; frontend defensively treat missing role as `care_recipient` and optionally refetch after profile creation.

### 2.5 Auth: Refresh token endpoint parameter naming and 401 handling

- **File:** `backend/app/routers/auth.py` — `refresh_token(request: RefreshTokenRequest)`; `frontend/src/api/client.ts` — refresh on 401.
- **Issue:** Backend uses `request` as body parameter (works in FastAPI) but could be confused with `Request`. Client retry after refresh can loop if refresh fails.
- **Fix strategy:** Rename body to `body: RefreshTokenRequest` for clarity. Ensure client clears tokens and does not retry indefinitely on refresh failure (already partially done).

---

## 3. Medium Issues

### 3.1 Backend: Dashboard role resolution from auth user only

- **File:** `backend/app/routers/dashboard.py` — `_resolve_role`
- **Issue:** Uses `current_user.get("user_metadata").get("role")` first; JWT/auth user may not have role in metadata, then falls back to DB. If DB row missing, returns None and stats/bookings return empty.
- **Fix strategy:** Prefer fetching role from `users` table by `current_user["id"]` first; use metadata only as fallback. Align with `/me` so role is always from DB when profile exists.

### 3.2 Frontend: BookingDetailScreen — use explicit getBooking if available

- **File:** `frontend/src/BookingDetailScreen.tsx`
- **Issue:** Uses `api.request(\`/api/bookings/${bookingId}\`)` instead of a named method; works but is fragile if base URL or path changes.
- **Fix strategy:** Add `getBooking: (id) => request(\`/api/bookings/${id}\`)` to api client and use it here for consistency and error typing.

### 3.3 Frontend: VideoCallScreen — completeVideoCall uses bookingId

- **File:** `frontend/src/VideoCallScreen.tsx`, `frontend/src/api/client.ts`
- **Issue:** `api.completeVideoCall(bookingId)` calls `/api/bookings/video-call/${bookingId}/complete`. Backend may expect `video_call_id` not booking_id; naming is ambiguous.
- **Fix strategy:** Confirm backend route: if it expects video_call_request id, ensure VideoCallScreen receives and passes video_call_id (and rename param for clarity). If backend accepts booking id, document; otherwise add backend support for both or standardise on video_call_id.

### 3.4 Settings: Notification preference not persisted

- **File:** `frontend/src/SettingsScreen.tsx`
- **Issue:** "Push Notifications" toggle is local state only; does not call API or persist to backend/AsyncStorage.
- **Fix strategy:** Persist to AsyncStorage and/or call a preferences API if backend supports it; on load, restore from storage/API.

### 3.5 HelpSupportScreen: Placeholder handlers

- **File:** `frontend/src/HelpSupportScreen.tsx`
- **Issue:** "Video tutorials" and possibly "User manual" show "Coming Soon" with no backend or deep link.
- **Fix strategy:** Either wire to real URLs (e.g. app version–specific docs) or keep as "Coming soon" but ensure no silent failures and consistent copy.

### 3.6 Accessibility: Large text and high contrast not applied globally

- **File:** `frontend/src/context/AccessibilityContext.tsx`, various screens
- **Issue:** `largeText` and `highContrast` are stored and toggled in Settings but not consistently applied across all screens (font scaling, contrast colors).
- **Fix strategy:** Centralise styles in theme (e.g. scale font size, override colors when highContrast); use theme and useAccessibility in shared components/layout so all screens inherit.

### 3.7 Accessibility: Screen reader and keyboard

- **Issue:** Many buttons and inputs lack `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`. No central keyboard-navigation strategy for PWA.
- **Fix strategy:** Add accessibility props to primary actions (Emergency, Login, Register, Dashboard quick actions, Chat send). Document keyboard shortcuts for web build.

### 3.8 Error handling: Silent failures in API client

- **File:** `frontend/src/api/client.ts` — `safeApi`
- **Issue:** safeApi swallows 404/500 and returns fallback; callers may not show any message to user.
- **Fix strategy:** Use safeApi only where fallback is intentional; elsewhere use direct api calls and handle errors in UI (toast/alert). Ensure no critical paths rely on silent fallback without user feedback.

### 3.9 CareRecipientDashboard: Booking list deduplication and status

- **File:** `frontend/src/CareRecipientDashboard.tsx`
- **Issue:** Complex client-side deduplication by caregiver; if API returns inconsistent status, UI can be confusing.
- **Fix strategy:** Prefer server-side filtering (e.g. single "active" booking per caregiver or clear API contract); if keeping client dedupe, add loading and empty states and document behaviour.

### 3.10 Backend: UserResponse id type (UUID vs string)

- **File:** `backend/app/schemas.py` — UserResponse
- **Issue:** Supabase may return `id` as string; Pydantic UUID can coerce but strict mode could fail.
- **Fix strategy:** Allow both string and UUID in response model (e.g. Union or str with validator) to avoid 500 on profile responses.

### 3.11 Logout: Clear refresh token on all code paths

- **File:** `frontend/src/context/AuthContext.tsx`
- **Issue:** In catch block of logout, `setRefreshToken(null)` is called but setRefreshToken is async and may not be awaited in one path.
- **Fix strategy:** Ensure all logout paths await token clearing (SecureStore/localStorage and refresh token); then set state.

### 3.12 Emergency: Accessible from any screen

- **File:** `frontend/src/navigation/AppNavigator.tsx`, BottomNav / menu
- **Issue:** Emergency must be reachable from every screen (PRD). Currently in stack and possibly in menu; ensure it is never hidden by role or tab.
- **Fix strategy:** Verify Emergency is in common screens and linked from dashboard SOS, menu, and (if applicable) bottom nav or global floating button.

---

## 4. Low Issues

### 4.1 LoginScreen: navigation.goBack() when no history

- **File:** `frontend/src/LoginScreen.tsx` — header back button
- **Issue:** On root auth screen, goBack() may do nothing or exit app; not critical but can confuse.
- **Fix strategy:** Only show back button when navigation can go back; or replace with "Skip" / hide when stack is single.

### 4.2 RegisterScreen: Phone validation and country code

- **Issue:** Phone validated as 10 digits with +91 prefix; assumes India only.
- **Fix strategy:** Document or allow configurable country code; validate length per country if needed.

### 4.3 Dashboard stats: Supabase count syntax

- **File:** `backend/app/routers/dashboard.py` — video_call_requests and chat_sessions use `count="exact"`.
- **Issue:** Supabase Python client syntax for count may differ; verify and use correct `.execute()` options for count.
- **Fix strategy:** Check Supabase client docs for count; use limit(1) and count in app if API does not support exact count.

### 4.4 Console.log in production

- **Files:** Multiple (AuthContext, api client, screens)
- **Issue:** Many console.log/console.warn statements; acceptable for dev but noisy in production.
- **Fix strategy:** Use a small logger that no-ops or forwards to analytics in production; or strip in build.

### 4.5 Theme: Centralise COLORS in CareRecipientDashboard and others

- **Issue:** Some screens define local COLORS instead of importing from `theme.ts`.
- **Fix strategy:** Prefer single source (theme.ts) for colors so high contrast and future theming apply everywhere.

### 4.6 Backend: Rate limiting only on auth

- **File:** `backend/app/main.py`, auth router
- **Issue:** Other sensitive routes (e.g. emergency trigger, password reset) could use rate limiting.
- **Fix strategy:** Add rate limits to emergency trigger and reset-password to prevent abuse.

### 4.7 NotificationsScreen: Mark read/delete error handling

- **File:** `frontend/src/NotificationsScreen.tsx` (assumed)
- **Issue:** If mark read or delete fails, user may not see feedback.
- **Fix strategy:** Toast or inline message on failure; retry or revert optimistic update.

### 4.8 ProfileScreen / EditProfile: Emergency contact validation

- **Issue:** Emergency contact (name, phone) should be validated and saved to backend; ensure displayed on Emergency screen.
- **Fix strategy:** Validate format; save via updateProfile; EmergencyScreen already reads user.emergency_contact.

---

## 5. File-Level Quick Reference

| File | Issue | Severity |
|------|--------|----------|
| backend/app/routers/emergency.py | All stubbed; no DB or real alerts | Critical |
| frontend/src/EmergencyScreen.tsx | JSX in string; hardcoded location | Critical |
| backend/app/routers/auth.py | /me role consistency; refresh param name | Critical / Medium |
| frontend/src/context/AuthContext.tsx | Logout await; role fallback | Medium |
| backend/app/routers/dashboard.py | Role from DB first | Medium |
| frontend/src/BookingDetailScreen.tsx | Use getBooking; error handling | Medium |
| frontend/src/VideoCallScreen.tsx | completeVideoCall id semantics | Medium |
| frontend/src/SettingsScreen.tsx | Notifications not persisted | Medium |
| frontend/src/context/AccessibilityContext.tsx | Apply to theme/screens | Medium |
| frontend/src/api/client.ts | getBooking; safeApi usage | Medium / Low |
| frontend/src/HelpSupportScreen.tsx | Placeholder "Coming soon" | Low |
| backend/app/schemas.py | UserResponse id type | Medium |

---

## 6. Next Steps (Implementation Order)

1. **Emergency:** Fix EmergencyScreen JSX and location text; then implement or document emergency backend (table + trigger/ack/resolve/status).
2. **Auth:** Ensure /me always returns role; fix logout to await setRefreshToken; optional refresh body rename.
3. **API client:** Add getBooking; use it in BookingDetailScreen; ensure errors surface to user.
4. **Accessibility:** Apply largeText/highContrast from theme; add accessibilityLabel/Role/Hint to main actions.
5. **Settings:** Persist notification preference; optionally backend.
6. **Error handling:** Replace silent failures with user-visible messages (toast/alert) on critical paths.
7. **Test steps:** Document TC-ID, Action, Expected, Edge case, Failure handling for each screen.

---

*End of Audit Report*

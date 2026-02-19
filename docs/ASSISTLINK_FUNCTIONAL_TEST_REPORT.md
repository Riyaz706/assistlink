# AssistLink – Complete Functional Testing Report

**Date:** 2026-02-13  
**Scope:** Full codebase – Frontend (Expo/React Native), Backend (FastAPI), API client, auth, state, navigation, and critical user flows.

---

## 1. APPLICATION MAPPING

### 1.1 Screens / Pages / Components

| Screen/Component | File | Role | Purpose |
|------------------|------|------|---------|
| Splash | SplashScreen.tsx | All | Loading / auth restore |
| Login | LoginScreen.tsx | Guest | Email/password login |
| Register | RegisterScreen.tsx | Guest | Registration (care_recipient / caregiver) |
| ForgotPassword | ForgotPasswordScreen.tsx | Guest | Request password reset |
| ResetPassword | ResetPasswordScreen.tsx | Guest | Set new password from link |
| CareRecipientDashboard | CareRecipientDashboard.tsx | care_recipient | Home, bookings, SOS, menu |
| NewRequestScreen | NewRequestScreen.tsx | care_recipient | Create care request |
| Schedule | ScheduleScreen.tsx | care_recipient | Bookings/video calls |
| Profile | ProfileScreen.tsx | care_recipient | Profile, account, logout |
| ChatList | ChatList.tsx | care_recipient | Chat sessions |
| ChatDetailsScreen | ChatDetailsScreen.tsx | Both | Single chat thread |
| Matchmaking | Matchmaking.tsx | care_recipient | Caregiver list, video call request |
| PaymentScreen | PaymentScreen.tsx | care_recipient | Razorpay payment |
| UpcomingVisitScreen | UpcomingVisitScreen.tsx | care_recipient | Upcoming visit |
| CaregiverMapScreen | CaregiverMapScreen.tsx | care_recipient | Map/track caregiver |
| CaregiverDashboard | CaregiverDashboard.tsx | caregiver | Home, assignments |
| ScheduleScreen2 | ScheduleScreen2.tsx | caregiver | Caregiver schedule |
| ProfileScreen2 | ProfileScreen2.tsx | caregiver | Caregiver profile |
| ChatList2 | ChatList2.tsx | caregiver | Caregiver chats |
| ChatDetailScreen2 | ChatDetailScreen2.tsx | caregiver | Caregiver chat thread |
| CaregiverAppointmentDetailScreen | CaregiverAppointmentDetailScreen.tsx | caregiver | Accept/decline/complete |
| EmergencyScreen | EmergencyScreen.tsx | Both | Emergency trigger |
| Notifications | NotificationsScreen.tsx | Both | Notification list |
| VideoCallScreen | VideoCallScreen.tsx | Both | Video call UI |
| EditProfile | EditProfileScreen.tsx | Both | Edit profile |
| ChangePassword | ChangePasswordScreen.tsx | Both | Change password |
| Settings | SettingsScreen.tsx | Both | Settings (uses BottomNav) |
| HelpSupport | HelpSupportScreen.tsx | Both | Help/FAQ (uses BottomNav) |
| BottomNav | BottomNav.tsx | N/A | 5 tabs: Home, Requests, Schedule, Messages, Profile |

### 1.2 User Roles

- **Guest:** Not logged in. Can use Login, Register, ForgotPassword, ResetPassword.
- **care_recipient:** Sees care-recipient stack + common screens. Uses BottomNav on dashboard, profile, chat list, settings, help.
- **caregiver:** Sees caregiver stack + common screens. Uses inline nav on CaregiverDashboard; **no** BottomNav on dashboard. Uses BottomNav **only** on Settings and HelpSupport (shared).

### 1.3 Features / Modules

- Auth: login, register, logout, forgot password, reset password, change password, Google OAuth, token restore.
- Profile: get/update profile, emergency contact, edit profile.
- Caregivers: list (filters), caregiver profile, video call request/accept/status/join.
- Bookings: create, update, cancel, complete, complete-payment, dashboard bookings.
- Dashboard: stats (caregiver), bookings, video calls.
- Payments: create order, verify (Razorpay), complete-payment.
- Chat: sessions, messages, send, mark read.
- Notifications: list, mark read, delete, devices, test.
- Emergency: trigger.
- Location: (backend router present).

---

## 2. FUNCTION-LEVEL VERIFICATION (Summary)

### 2.1 API Client (`src/api/client.ts`)

- **getApiBaseUrl()** – Uses EXPO_PUBLIC_API_BASE_URL, then Constants.extra, then hardcoded fallback. **Issue:** Hardcoded production URL in code (see Security).
- **request()** – Timeout 30s, AbortController, token from memory then storage, error shape normalized. **Issue:** Empty response body returns `{} as T`; some callers may expect `null` or a specific shape.
- **Offline handler** – Only used when `offlineHandler` is set and path/method are syncable; otherwise network error thrown. No bug, but behavior is strict.

### 2.2 AuthContext (`src/context/AuthContext.tsx`)

- **login()** – Calls api.login, stores token, then api.me(). If api.me() fails, sets minimal user then throws; caller catch clears token and user. Correct.
- **refreshUser()** – On error only logs; does not clear user/token. **Issue:** Stale user can persist after 401 (e.g. token revoked).
- **logout()** – Clears state then clearToken() in background. Correct.
- **Token restore** – getToken → api.me(). On 401/Not authenticated clears token; on other errors keeps token. Reasonable for transient network errors.

### 2.3 useErrorHandler (`src/hooks/useErrorHandler.ts`)

- **handleError** – Sets error state and sends to Sentry. Does not show Alert by default; UI must render `error`. **Issue:** extractErrorDetails uses `error?.response?.status` (Axios-style); API client uses `error.statusCode`. So statusCode is used when response is missing; consistent with client.ts.
- **isAuthError** – Uses statusCode 401/403. Correct for current API errors.

### 2.4 Backend Auth (`app/routers/auth.py`)

- **register** – Supabase sign_up + profile insert. Handles ConflictError. **Issue:** Duplicate import `get_user_id` (line 5). **Critical:** Dead code after first `except` block (lines 150–181): unreachable after `raise` in line 147.
- **login** – sign_in_with_password, returns access_token, user. Correct.
- **reset_password** – Uses `request: ResetPasswordRequest` (body). Supabase `reset_password_email` may expect different API (e.g. `request.body()` vs Pydantic). FastAPI injects body as ResetPasswordRequest; `request.email` is correct.
- **change_password** – Verifies current password, then admin update_user_by_id. Correct.
- **/me** – get_current_user, then DB profile; auto-provision if missing. Correct.
- **ValidationError** – Used as `ValidationError("message", "email")`; second param is `details`. Signature expects `Optional[Dict]`; passing string can produce `"details": "email"` in JSON. Minor.

### 2.5 Error Handler (`app/error_handler.py`)

- **create_error_response** – For HTTPException sets `message: error.detail`. **Issue:** FastAPI validation errors set `detail` to a list of dicts; client may expect a string. Should normalize (e.g. join messages or take first).

---

## 3. UI & USER FLOW TESTING

### 3.1 Navigation

- **Care recipient:** Dashboard → Profile, Schedule, ChatList, NewRequestScreen, Matchmaking, Payment, Emergency, Notifications, Settings, HelpSupport. BottomNav targets: CareRecipientDashboard, NewRequestScreen, Schedule, ChatList, Profile. All exist in stack. **Issue:** “View Schedule” uses `navigation.navigate('RecipientSchedule')` but screen name is `'Schedule'` → navigation fails or undefined screen.
- **Caregiver:** Dashboard has inline buttons to ScheduleScreen2, ChatList2, ProfileScreen2, EmergencyScreen, Notifications. **Issue:** Settings and HelpSupport render BottomNav; tabs “Home” and “Requests” call `navigate('CareRecipientDashboard')` and `navigate('NewRequestScreen')`. Those screens are **not** in the caregiver stack → broken navigation for caregiver on Settings/HelpSupport.

### 3.2 Forms (Representative)

- **Login:** Validates non-empty email/password and email format; then api.login. Error state shown in UI. **Issue:** Back button `onPress={() => console.log('Go Back')}` does nothing (no navigation).
- **Register:** Required fields, DOB parsing, role. Google sign-up path uses id_token and role. Errors handled via useErrorHandler.
- **ForgotPassword / ResetPassword:** Call api.resetPassword / backend reset; success/error handled.

### 3.3 Loading / Error / Success

- Login: `loading` disables button and shows “Logging in...”. Error from handleError displayed in banner.
- Many screens call handleError but do not call showErrorAlert; they rely on inline error state. If the screen does not render `error`, user may see no feedback. Needs per-screen check.

---

## 4. API & BACKEND INTEGRATION

### 4.1 Endpoints vs Client

- Auth: register, login, reset-password, change-password, me – used. Google: frontend uses `/api/auth/google` (googleAuth) with id_token; backend has google_auth router.
- Users: getProfile, updateProfile – used.
- Notifications: get, read-all, by-id read/delete, devices, test – used.
- Caregivers: list (query params), profile get/put – used.
- Bookings: video-call request/accept/status/join, complete, create, update (cancel), complete-payment – used.
- Dashboard: stats, bookings, video-calls – used.
- Payments: create-order, verify – used.
- Chat: sessions, session by id, messages, send, read – used.
- Emergency: trigger – used.

### 4.2 Error Handling

- Client maps 4xx/5xx to Error with statusCode, code, details. Timeout and network errors mapped to user-facing messages. Consistent.
- **Gap:** No global retry on 5xx or “Retry” in UI for failed requests (except PaymentScreen retry loop).

---

## 5. STATE MANAGEMENT

- **Auth:** user, accessToken (in memory + SecureStore/localStorage). Logout clears state and token. No refresh token rotation in client (backend may return it; client does not use it).
- **useErrorHandler:** Local state per component. Error cleared by clearError or new handleError. No global error queue.
- **NotificationContext / OfflineContext:** Used where mounted; no obvious stale state. Offline queue persisted; sync on reconnection.
- **Potential:** After logout, any in-memory cache (e.g. profile, bookings) in other contexts is not cleared; relying on unmount. Low risk if tokens are cleared.

---

## 6. AUTHENTICATION & AUTHORIZATION

- **Protected routes:** AppNavigator shows main stack only when `user` is set. So all main screens are protected by auth state.
- **API:** Requests send Bearer token. Backend get_current_user validates token; some routes use verify_care_recipient / verify_caregiver.
- **Token restore:** On load, token from storage → api.me(). On 401, token cleared and user null. Correct.
- **Gap:** refreshUser does not clear user on 401; user can remain until next full reload or protected call fails.

---

## 7. DATA VALIDATION & SECURITY

- **Backend:** Pydantic schemas (auth, users, bookings, etc.). validators.py used for email, phone, password, etc.
- **Frontend:** Login/Register do basic validation; many forms do not re-validate on blur or length limits (e.g. max length).
- **Secrets:** No hardcoded API keys in repo. Backend SECRET_KEY from env; default in config is risky for production (must be overridden).
- **Logging:** api/client.ts logs full URL (path) and “API Base URL”. AuthContext logs email/name. CaregiverAppointmentDetailScreen, ChatList, etc. log session or appointment data. **Issue:** Production builds should avoid logging PII and full URLs (or gate behind __DEV__).

---

## 8. PERFORMANCE & STABILITY

- **Re-renders:** No systematic use of React.memo or useMemo in listed screens; large lists (caregivers, chats, notifications) could benefit from virtualization or memo.
- **Memory:** No obvious leaks; no clear interval/timeout in useEffect cleanup in some screens (e.g. ChatDetailsScreen polling).
- **Blocking:** Heavy work is async; loading states used. API timeout 30s is reasonable.
- **Loading indicators:** Many screens set local loading and show spinner/disabled state; some (e.g. refreshUser) have no loading flag.

---

## 9. PLATFORM-SPECIFIC (Mobile)

- **Permissions:** CaregiverMapScreen requests location; errors handled. Other permission flows not fully traced.
- **Web:** Token in localStorage; SecureStore on native. getTokenFromStorage in client uses window.localStorage for web.
- **Offline:** OfflineContext queues syncable requests; API client uses it when offlineHandler set. Not all screens may be wrapped in OfflineProvider.

---

## 10. ISSUES REPORT (All Findings)

### CRITICAL

| # | File | Location | Issue | Fix |
|---|------|----------|--------|-----|
| C1 | `app/routers/auth.py` | Lines 150–181 | Dead code after `raise` in login exception handler; duplicate and unreachable return/except. | Remove lines 150–181 (duplicate exception handling and unreachable return block). |
| C2 | `src/CareRecipientDashboard.tsx` | Line 492 | “View Schedule” calls `navigation.navigate('RecipientSchedule')` but screen is registered as `'Schedule'`. | Change to `navigation.navigate('Schedule')`. |
| C3 | `src/BottomNav.tsx` + `SettingsScreen.tsx`, `HelpSupportScreen.tsx` | BottomNav tabs | Caregiver uses Settings/HelpSupport which render BottomNav. “Home” and “Requests” navigate to CareRecipientDashboard and NewRequestScreen, which are not in caregiver stack → broken navigation. | Make BottomNav role-aware: for caregiver, “Home” → CaregiverDashboard, “Requests” → e.g. ScheduleScreen2 or a caregiver “requests” screen; or hide BottomNav for caregiver on Settings/HelpSupport and use a “Back” or role-specific nav. |

### MAJOR

| # | File | Location | Issue | Fix |
|---|------|----------|--------|-----|
| M1 | `src/CareRecipientDashboard.tsx` | Lines 228–236 | handleMarkCompleted: duplicate `await loadCurrentBookings()` and duplicate `Alert.alert` (same message twice). | Keep one loadCurrentBookings() and one Alert.alert after success. |
| M2 | `src/context/AuthContext.tsx` | refreshUser() | On api.me() failure (e.g. 401), only console.error; user and token left in state. | On 401 (or statusCode 401), clear token and set user to null in refreshUser. |
| M3 | `app/error_handler.py` | create_error_response, HTTPException branch | `error.detail` can be a list (e.g. validation); client may expect string. | Normalize: `message = error.detail if isinstance(error.detail, str) else "; ".join(d.get("msg", str(d)) for d in error.detail) if isinstance(error.detail, list) else str(error.detail)`. |
| M4 | `app/routers/auth.py` | reset_password | Parameter named `request` shadows FastAPI Request. Not a bug but confusing. | Rename to `body: ResetPasswordRequest` for clarity. |
| M5 | `src/LoginScreen.tsx` | Line 85 | Back button does `console.log('Go Back')` only; no navigation. | Use `navigation.goBack()` or, if no history, do nothing / hide button. |
| M6 | `app/main.py` | Line 13 | validation_exception_handler imported twice. | Remove duplicate import. |

### MINOR

| # | File | Location | Issue | Fix |
|---|------|----------|--------|-----|
| N1 | `app/routers/auth.py` | Line 5 | Duplicate import: `get_user_id, get_user_id`. | Remove duplicate. |
| N2 | `app/routers/auth.py` | change_password | ValidationError("User email not found in session", "email") passes string as details; schema suggests Dict. | Use details={"field": "email"} or similar dict. |
| N3 | `src/api/client.ts` | Lines 15–16, 65, 83 | console.log of API base URL and request URL in all environments. | Gate behind `__DEV__` or remove in production build. |
| N4 | `src/api/client.ts` | Empty response body | Returns `{} as T`; some endpoints might expect null or specific shape. | Document or normalize (e.g. return null for 204/empty). |
| N5 | Multiple frontend files | console.log/console.error | Many debug logs (AuthContext, CaregiverAppointmentDetailScreen, ChatList, Matchmaking, etc.) can leak PII or internal state in production. | Wrap in `if (__DEV__)` or remove. |
| N6 | `src/ProfileScreen.tsx` | Help link | Now navigates to HelpSupport; Terms of Service onPress is empty. | Implement navigation or Linking.openURL for Terms. |
| N7 | `src/HelpSupportScreen.tsx` | Terms link | Linking.openURL('https://example.com/terms'). | Replace with real terms URL or config. |
| N8 | `app/config.py` | SECRET_KEY | Default value when not set. | Ensure production never uses default; fail fast if SECRET_KEY not set in prod. |

---

## 11. RECOMMENDED FIXES (Code Snippets)

### C1 – auth.py: Remove dead code (lines 150–181)

```python
# In app/routers/auth.py, delete the block from line 150 to 181 (the duplicate
# if not hasattr... block and the second except HTTPException/Exception block).
# Keep only the first except block that ends with raise AuthenticationError(...).
```

### C2 – CareRecipientDashboard: Fix “View Schedule” navigation

```tsx
// Line 492: change
onPress={() => navigation.navigate('RecipientSchedule')}
// to
onPress={() => navigation.navigate('Schedule')}
```

### C3 – BottomNav: Role-aware targets

```tsx
// In BottomNav.tsx, use useAuth to read role and choose screen names:
const { user } = useAuth();
const isCaregiver = user?.role === 'caregiver';

const tabs = isCaregiver
  ? [
      { name: 'CaregiverDashboard', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
      { name: 'ScheduleScreen2', label: 'Schedule', icon: 'calendar-clock', iconOutline: 'calendar-clock-outline' },
      { name: 'ChatList2', label: 'Messages', icon: 'message-text', iconOutline: 'message-text-outline' },
      { name: 'ProfileScreen2', label: 'Profile', icon: 'account-circle', iconOutline: 'account-circle-outline' },
    ]
  : [
      { name: 'CareRecipientDashboard', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
      { name: 'NewRequestScreen', label: 'Requests', icon: 'plus-circle', iconOutline: 'plus-circle-outline' },
      { name: 'Schedule', label: 'Schedule', icon: 'calendar-clock', iconOutline: 'calendar-clock-outline' },
      { name: 'ChatList', label: 'Messages', icon: 'message-text', iconOutline: 'message-text-outline' },
      { name: 'Profile', label: 'Profile', icon: 'account-circle', iconOutline: 'account-circle-outline' },
    ];
// Then use 4 tabs for caregiver (no “Requests”) or add a caregiver-specific request screen and keep 5.
```

### M1 – CareRecipientDashboard: Remove duplicate success handling

```tsx
const handleMarkCompleted = async (bookingId: string) => {
  try {
    await api.completeBooking(bookingId);
    await loadCurrentBookings();
    Alert.alert("Success", "Booking marked as completed! The caregiver is now available for other requests.");
  } catch (e: any) {
    handleError(e, 'mark-completed');
  }
};
```

### M2 – AuthContext: Clear auth on 401 in refreshUser

```tsx
const refreshUser = async () => {
  try {
    const token = await getToken();
    if (!token) return;
    setAccessTokenState(token);
    setAccessToken(token);
    const me = await api.me();
    setUser(me as any);
  } catch (error: any) {
    if (error?.statusCode === 401) {
      await clearToken();
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);
    }
    console.error("AuthContext: Error refreshing user:", error);
  }
};
```

### M3 – error_handler: Normalize HTTPException.detail

```python
# In create_error_response, for HTTPException:
detail = error.detail
if isinstance(detail, list):
    message = "; ".join(
        d.get("msg", str(d)) for d in detail
    ) if detail else "Validation failed"
else:
    message = str(detail) if detail else "Request failed"
response = {
    "error": {
        "code": f"HTTP_{error.status_code}",
        "message": message,
        ...
    }
}
```

---

## 12. TEST COVERAGE RECOMMENDATIONS

1. **E2E:** Login (valid/invalid), Register, Logout, then care recipient flow: dashboard → new request → matchmaking → (mock) payment; caregiver: dashboard → appointment detail → accept/complete.
2. **API:** Postman/automated tests for all endpoints: 200, 401, 422, 500 and timeout; validate response shape and error format.
3. **Navigation:** For both roles, navigate every tab and every menu item; assert correct screen and no crashes.
4. **Offline:** Turn off network during a mutation; verify queue and sync when back online (where OfflineContext is used).
5. **Security:** No tokens or PII in logs in production; run a production build and grep logs.

---

**Report end.** Apply critical and major fixes before production; address minor and logging items as part of hardening and maintainability.

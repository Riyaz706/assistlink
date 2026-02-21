# AssistLink – Function Checklist

Use this checklist to verify whether each feature is **working**, **needs config**, or has **known issues**. Status key:

| Status | Meaning |
|--------|--------|
| ✅ **OK** | Implemented and working when config is in place |
| ⚙️ **Config** | Works after env/DB/config setup |
| ⚠️ **Partial** | Works in some cases (e.g. web only, or bypass only) |
| ❌ **Issue** | Known bug or missing backend/frontend |

---

## 1. Authentication

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Register | `POST /api/auth/register` | RegisterScreen | ✅ OK | Supabase Auth + users table |
| Login | `POST /api/auth/login` | LoginScreen | ✅ OK | Email/password |
| Refresh token | `POST /api/auth/refresh` | AuthContext | ✅ OK | Uses refresh_token |
| Get current user | `GET /api/auth/me` | AuthContext | ✅ OK | |
| Logout | `POST /api/auth/logout` | AuthContext | ✅ OK | |
| Forgot password | `POST /api/auth/reset-password` | ForgotPasswordScreen | ⚙️ Config | Supabase sends email |
| Change password | `POST /api/auth/change-password` | ChangePasswordScreen | ✅ OK | |
| Google OAuth URL | `GET /api/auth/google/url` | LoginScreen | ⚙️ Config | Needs GOOGLE_*_CLIENT_ID in backend |
| Google sign-in | `POST /api/auth/google` | LoginScreen | ⚙️ Config | Id token from Google |
| Google verify session | `POST /api/auth/google/verify` | (callback) | ⚙️ Config | After OAuth redirect |

**Requirements:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in backend `.env`.

---

## 2. Users & Profile

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Get profile | `GET /api/users/profile` | ProfileScreen, EditProfileScreen | ✅ OK | |
| Update profile | `PUT /api/users/profile` | EditProfileScreen | ✅ OK | full_name, phone, address, etc. |

---

## 3. Caregivers

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| List caregivers | `GET /api/caregivers` | Matchmaking, CaregiverMapScreen | ✅ OK | Filters: availability, rating, skills |
| Get caregiver by ID | `GET /api/caregivers/{id}` | Matchmaking, detail flows | ✅ OK | |
| Create caregiver profile | `POST /api/caregivers/profile` | Caregiver onboarding | ✅ OK | Caregiver role only |
| Update caregiver profile | `PUT /api/caregivers/profile` | ProfileScreen2, CaregiverAppointmentDetailScreen | ✅ OK | |
| Get my caregiver profile | `GET /api/caregivers/profile` | Caregiver screens | ✅ OK | |

---

## 4. Bookings

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Create booking | `POST /api/bookings` | Matchmaking, NewRequestScreen | ✅ OK | service_type, scheduled_date, etc. |
| Get booking | `GET /api/bookings/{id}` | BookingDetailScreen, PaymentScreen | ✅ OK | |
| Update booking status | `PATCH /api/bookings/{id}` | BookingDetailScreen | ✅ OK | status, reason |
| Respond (accept/reject) | `POST /api/bookings/{id}/respond` | BookingDetailScreen (caregiver) | ✅ OK | |
| Get booking history | `GET /api/bookings/{id}/history` | BookingDetailScreen | ✅ OK | |
| Add booking note | `POST /api/bookings/{id}/notes` | BookingDetailScreen | ✅ OK | |
| Cancel booking | `PATCH` with status cancelled | BookingDetailScreen | ✅ OK | |
| Complete booking | `POST /api/bookings/{id}/complete` | CaregiverAppointmentDetailScreen, VideoCallScreen | ✅ OK | For in-person completion |
| Complete payment (booking) | — | api.completePayment | ❌ Issue | Frontend calls `POST /api/bookings/{id}/complete-payment` but **no such route** in backend. Use payment verify flow or video-call complete instead. |

**Note:** Payment completion is done via `POST /api/payments/verify` (and optionally `POST /api/bookings/video-call/{id}/complete` for video calls), not `complete-payment`.

---

## 5. Video Call Requests (pre-call flow)

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Create video call request | `POST /api/bookings/video-call/request` | Matchmaking | ✅ OK | caregiver_id, scheduled_time |
| Get video call request | `GET /api/bookings/video-call/{id}` | ScheduleScreen, Notifications | ✅ OK | |
| Accept video call request | `POST /api/bookings/video-call/{id}/accept` | ScheduleScreen, Notifications | ✅ OK | |
| Join video call (get URL) | `POST /api/bookings/video-call/{id}/join` | (optional) | ✅ OK | Returns video_call_url |
| Get video call status | `GET /api/bookings/video-call/{id}/status` | — | ✅ OK | |
| Update video call status | `PATCH /api/bookings/video-call/{id}/status` | CaregiverAppointmentDetailScreen | ✅ OK | |
| Complete video call | `POST /api/bookings/video-call/{id}/complete` | VideoCallScreen (web/native) | ✅ OK | id = video_call_id or booking_id |

---

## 6. Video Calling (in-call)

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Get Twilio token | `POST /api/communications/video/token` | VideoCallScreen (native) | ⚙️ Config | **ENABLE_TWILIO=false** → returns stub; no real call on native without Twilio keys |
| WebRTC (PWA) | — | VideoCallScreen.web.tsx | ⚙️ Config | Uses Supabase Realtime; needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in frontend `.env` |
| Native (Twilio) | Twilio credentials | VideoCallScreen.tsx | ⚙️ Config | Needs Twilio keys in backend; Expo Go shows “not supported” message |

**Summary:**  
- **Web (PWA):** WebRTC + Supabase Realtime → works when Supabase env is set.  
- **Native:** Twilio → works only in dev/production build with Twilio configured; Expo Go shows placeholder.

---

## 7. Payments

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Payment service status | `GET /api/payments/status` | — | ✅ OK | Check if Razorpay/bypass configured |
| Create payment order | `POST /api/payments/create-order` | PaymentScreen | ✅ OK | booking_id, amount, currency |
| Verify payment | `POST /api/payments/verify` | PaymentScreen (after Razorpay/mock) | ✅ OK | razorpay_order_id, payment_id, signature |
| Razorpay webhook | `POST /api/payments/webhook` | — | ⚙️ Config | Razorpay dashboard → webhook URL |

**Config:**  
- **Bypass (testing):** `RAZORPAY_BYPASS_MODE=true` in backend `.env` → no Razorpay UI; booking confirmed on “Pay Now”.  
- **Real Razorpay:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in backend; real payment only in dev/production app (not Expo Go).  
**Database:** Run `add_payment_fields.sql` and, if needed, `fix_payment_status_captured.sql` in Supabase (see PAYMENT_MANUAL_STEPS.md).

---

## 8. Dashboard

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Dashboard stats | `GET /api/dashboard/stats` | CareRecipientDashboard, CaregiverDashboard | ✅ OK | Counts by role |
| Dashboard bookings | `GET /api/dashboard/bookings` | Dashboard, Schedule screens | ✅ OK | |
| Upcoming bookings | `GET /api/dashboard/upcoming` | Dashboard | ✅ OK | |
| Recurring bookings | `GET /api/dashboard/recurring` | Dashboard | ✅ OK | |
| Video calls list | `GET /api/dashboard/video-calls` | ScheduleScreen, ScheduleScreen2 | ✅ OK | |

---

## 9. Chat

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| List chat sessions | `GET /api/chat/sessions` | ChatList, ChatList2 | ✅ OK | |
| Get chat session | `GET /api/chat/sessions/{id}` | ChatDetailsScreen, ChatDetailScreen2 | ✅ OK | |
| Get messages | `GET /api/chat/sessions/{id}/messages` | ChatDetailsScreen | ✅ OK | Pagination: limit, offset |
| Send message | `POST /api/chat/sessions/{id}/messages` | ChatDetailsScreen | ✅ OK | |
| Mark as read | `POST /api/chat/sessions/{id}/read` | ChatDetailsScreen | ✅ OK | |
| Enable chat (booking) | `POST /api/bookings/chat/{session_id}/enable` | Backend (after payment) | ✅ OK | Called internally after payment |

**Note:** Chat is enabled for a booking after payment is confirmed (bypass or Razorpay verify).

---

## 10. Notifications

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| List notifications | `GET /api/notifications` | NotificationsScreen | ✅ OK | Query: limit, offset, unread_only, type |
| Unread count | `GET /api/notifications/unread-count` | NotificationsScreen, badges | ✅ OK | |
| Mark one read | `POST /api/notifications/{id}/read` | NotificationsScreen | ✅ OK | |
| Mark all read | `POST /api/notifications/read-all` | NotificationsScreen | ✅ OK | |
| Delete notification | `DELETE /api/notifications/{id}` | NotificationsScreen | ✅ OK | |
| Register device (FCM) | `POST /api/notifications/devices` | useNotifications | ⚙️ Config | **ENABLE_PUSH_NOTIFICATIONS**; FCM service account path in backend |
| Unregister device | `DELETE /api/notifications/devices/{token}` | — | ✅ OK | |

**Push:** Requires FCM (Firebase) config and `ENABLE_PUSH_NOTIFICATIONS=true`; in-app notifications work without push.

---

## 11. Emergency

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Trigger emergency | `POST /api/emergency/trigger` | EmergencyScreen | ⚙️ Config | Needs `emergencies` table in Supabase |
| Acknowledge emergency | `POST /api/emergency/{id}/acknowledge` | EmergencyScreen (caregiver) | ⚙️ Config | |
| Resolve emergency | `POST /api/emergency/{id}/resolve` | EmergencyScreen | ⚙️ Config | |
| Get emergency status | `GET /api/emergency/status/{id}` | EmergencyScreen | ⚙️ Config | |

**Database:** If `emergencies` table is missing, backend returns a stub response (emergency “recorded” but no DB write). Run emergency schema migration for full behavior.

---

## 12. Reviews

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Submit review | `POST /api/reviews` | BookingDetailScreen (after completed) | ✅ OK | booking_id, rating, comment |
| Get caregiver reviews | `GET /api/reviews/caregiver/{id}` | Matchmaking, caregiver profile | ✅ OK | |
| Get booking review | `GET /api/reviews/booking/{id}` | BookingDetailScreen | ✅ OK | |

---

## 13. Communications (support / feedback)

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Contact support | `POST /api/communications/support` | HelpSupportScreen | ✅ OK | email, message |
| Submit feedback | `POST /api/communications/feedback` | HelpSupportScreen / Settings | ✅ OK | content |
| Video complete (mark) | `POST /api/communications/video/complete` | — | ✅ OK | Backend booking completion |

---

## 14. Location

| Function | Backend | Frontend | Status | Notes |
|----------|---------|----------|--------|-------|
| Update location | `PUT /api/location/update` | — | ✅ OK | |
| Get my location | `GET /api/location/me` | — | ✅ OK | |

---

## 15. Frontend feature flags

Controlled by `frontend/.env` (see `frontend/src/utils/featureFlags.ts`):

| Flag | Default | Effect when `false` |
|------|--------|---------------------|
| EXPO_PUBLIC_ENABLE_VIDEO_CALLS | true | Hides or disables video call UI |
| EXPO_PUBLIC_ENABLE_MAPS | true | Maps feature off (mock used on web) |
| EXPO_PUBLIC_ENABLE_PAYMENTS | true | Payment UI can be hidden |
| EXPO_PUBLIC_ENABLE_EMERGENCY | true | Emergency feature off |
| EXPO_PUBLIC_ENABLE_NOTIFICATIONS | true | Notifications off |
| EXPO_PUBLIC_ENABLE_OFFLINE_SYNC | true | Offline sync off |

---

## 16. Backend feature switches

In `backend/.env`:

| Variable | Typical | Effect |
|----------|---------|--------|
| ENABLE_TWILIO | false | Video token returns stub; no Twilio usage |
| ENABLE_RAZORPAY | true | Payment routes active (bypass or real) |
| ENABLE_PUSH_NOTIFICATIONS | false | Push registration/test may be no-op |
| RAZORPAY_BYPASS_MODE | true | No Razorpay; “Pay Now” confirms booking |

---

## 17. Summary – quick verification

| Area | Suggested test | Expected |
|------|----------------|----------|
| Auth | Register → Login → Me | User and token returned |
| Bookings | Create booking (care recipient) → Accept (caregiver) | Status accepted |
| Payments | Open Payment from booking → Pay Now (bypass) | “Payment confirmed”, booking confirmed |
| Chat | After payment → Open chat from list | Messages load, send works |
| Dashboard | Login as care recipient / caregiver | Stats and list load |
| Notifications | Trigger action that creates notification | Appears in Notifications screen |
| Video (web) | Start WebRTC call from chat/booking (same roomId) | Both sides connect (Supabase env set) |
| Emergency | Trigger emergency | Stub or real row if table exists |

---

## 18. Known issues / follow-ups

1. **api.completePayment** calls `POST /api/bookings/{bookingId}/complete-payment`, which **does not exist** in the backend. Payment completion is via `POST /api/payments/verify`. Remove or repoint `completePayment` to avoid 404 if it is ever called.
2. **Twilio video** on native: only works in a build with Twilio keys; Expo Go shows “not supported”.
3. **Razorpay** on device: only works in a build with Razorpay SDK; Expo Go shows “Complete payment in app” (bypass mode still works).
4. **Maps on web:** Resolved via mock (react-native-maps mock) so bundle succeeds; map does not render.
5. **Emergency:** Full behavior requires `emergencies` table; otherwise backend returns stub.

---

*Last updated from codebase audit. Run backend and frontend with correct `.env` and Supabase migrations for best results.*

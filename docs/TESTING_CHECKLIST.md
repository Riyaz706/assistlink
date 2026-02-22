# AssistLink – Testing Checklist

Use this checklist to verify that all requested features work as intended. Test on a real device or emulator (Android/iOS) with backend and frontend running.

---

## 1. Login & profile

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 1.1 | Login (care recipient) | Open app → Login with care recipient email/password | User logs in; no "profile not found" error; dashboard loads | |
| 1.2 | Login (caregiver) | Open app → Login with caregiver email/password | User logs in; caregiver dashboard/assignments load | |
| 1.3 | Profile after login | After login, open profile/settings or navigate away and back | User name/role persist; no RLS blocking profile load | |

---

## 2. Select caregiver – profile, auto-assign, track

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 2.1 | Caregiver profile modal | Care recipient: Find a caregiver → tap **Profile** on a card | Modal opens with photo, name, role, rating, skills, qualifications; Select / Close work | |
| 2.2 | Auto-Assign Now | Care recipient: Matchmaking → tap **Auto-Assign Now** | First caregiver is selected; selection/booking flow can proceed | |
| 2.3 | View Map / Track | Care recipient: Matchmaking → tap **View Map** in header | Navigates to Caregiver Map screen (no crash) | |

---

## 3. Booking – complete transition (no "requested → completed" error)

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 3.1 | Complete only when In Progress (care recipient) | Create booking → caregiver accepts → caregiver starts session → care recipient opens booking detail → tap **Mark as Completed** | Booking moves to Completed; no "transition from requested to completed is invalid" | |
| 3.2 | Complete only when In Progress (caregiver) | Caregiver: open appointment → **Start Care Session** → then **Mark as Complete** | Booking completes; no invalid transition error | |
| 3.3 | Complete button hidden when not In Progress | Open a booking that is "Requested" or "Confirmed" (not started) | "Complete Service" / "Mark as Complete" is **not** shown (only after Start Care) | |
| 3.4 | Video call complete | Start a video call linked to a booking (in_progress) → end call / mark complete | Video call and booking can complete; no invalid transition from requested | |

---

## 4. Slot booking – advisory lock (no DB error)

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 4.1 | Create booking | Care recipient: Select caregiver → pick date/time → Confirm booking | Booking is created; no "pg_advisory_xact_lock ... does not exist" or 500 from backend | |
| 4.2 | Same slot twice | Two users (or two tabs) try to book same caregiver for same slot | One succeeds; other gets clear error (e.g. slot taken / conflict), not raw DB error | |

---

## 5. Double-booking conflict (accept) – clear 409

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 5.1 | Accept overlapping booking | Caregiver has existing booking at 2–4pm; care recipient requests 3–5pm with same caregiver; caregiver accepts the new one | Backend returns **409** with message like "Caregiver is already booked for this time slot"; app shows user-friendly error, not 500 | |

---

## 6. Cancel / Reject booking

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 6.1 | Care recipient – Cancel booking | Care recipient: open a requested/accepted/confirmed booking → Cancel | Alert: "Are you sure..." → **Yes, Cancel** → booking status becomes Cancelled | |
| 6.2 | Caregiver – Reject request | Caregiver: open a **requested** booking → Reject | Alert: "Are you sure you want to reject..." → **Yes, Reject** → booking cancelled | |
| 6.3 | Caregiver – Cancel booking | Caregiver: open an accepted/confirmed booking → Cancel | Alert → **Yes, Cancel** → booking cancelled | |
| 6.4 | Works on Android | Perform 6.1–6.3 on Android device/emulator | No reliance on iOS-only Alert.prompt; alerts and buttons work | |

---

## 7. Caregiver dashboard – assignments

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 7.1 | Upcoming assignments visible | Login as caregiver with at least one accepted/confirmed booking | Dashboard shows **Upcoming assignments** (vertical list from top to bottom) | |
| 7.2 | Assignment cards | Tap an assignment card | Opens appointment detail (or booking detail) | |
| 7.3 | Empty state | Login as caregiver with no bookings | No crash; empty or “No upcoming assignments” message | |

---

## 8. My Schedule screen

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 8.1 | Schedule shows items | Login (care recipient or caregiver) → open **My Schedule** | List shows bookings and/or video calls (not empty when data exists) | |
| 8.2 | Date filter – Selected date | My Schedule → choose **Today** or **Selected** → pick a date in calendar | List shows only items for that date (and undated/requested when date is today) | |
| 8.3 | Date filter – This week | My Schedule → tap **This week** | List shows items in the week (Sun–Sat) of the selected date | |
| 8.4 | Date filter – All | My Schedule → tap **All** | List shows all schedule items (no date filter) | |
| 8.5 | Type filter – Assignments | My Schedule → tap **Assignments** | Only booking/assignment entries; no video-call-only entries | |
| 8.6 | Type filter – Video calls | My Schedule → tap **Video calls** | Only video call entries; no assignment-only entries | |
| 8.7 | Type filter – All | My Schedule → tap **All** (under Show) | Both assignments and video calls visible | |
| 8.8 | Calendar + filters | Change calendar date → switch between Date / Week / All and All / Assignments / Video calls | List updates correctly; "Selected" reflects calendar date | |
| 8.9 | Empty selected date | Select a date with no sessions; keep "Selected date" | Message like "No sessions on selected date. Showing upcoming:" and list of upcoming items | |

---

## 9. Ratings & reviews

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 9.1 | Rate caregiver prompt | Care recipient: after completing a visit, return to dashboard | "Rate your caregiver" card or prompt for the completed booking | |
| 9.2 | Submit rating | Open completed booking → Rate (e.g. 1–5 stars + comment) → Submit | Success message; review saved; no duplicate submit for same booking | |
| 9.3 | Rating on caregiver profile | Matchmaking: open Profile for a caregiver who has reviews | Rating and "X reviews" displayed in profile modal | |
| 9.4 | Only completed bookings | Try to rate a booking that is not completed | Rating only allowed (or only shown) for completed bookings | |

---

## 10. Quick smoke (backend)

| # | Test | Steps | Expected | ✓ |
|---|------|--------|----------|---|
| 10.1 | Health | `GET /api/health` or app loads without 5xx | 200 OK | |
| 10.2 | Login API | POST login with valid credentials | 200; returns user/session | |
| 10.3 | Caregiver by ID | `GET /api/caregivers/{id}` with valid caregiver id | 200; caregiver profile (no RLS block) | |
| 10.4 | Dashboard bookings | `GET /api/dashboard/bookings` (or equivalent) as caregiver with auth | 200; list of bookings (can be empty) | |

---

## Summary

- **Sections 1–2:** Auth, profile, matchmaking (profile modal, auto-assign, view map).
- **Sections 3–6:** Booking lifecycle (complete only when in progress), slot booking (advisory lock), double-booking 409, cancel/reject.
- **Sections 7–8:** Caregiver dashboard assignments (vertical list), My Schedule (date + type filters).
- **Section 9:** Ratings and reviews.
- **Section 10:** Backend smoke checks.

Run through each row and tick **✓** when the result matches the expected column. If any test fails, note the step and error message for debugging.

# Production-Ready Slot Booking (AssistLink)

This document describes the **slot booking flow**, **database logic**, **backend and frontend handlers**, **failure handling**, and a **test checklist**. Double booking is treated as a **critical failure** and is prevented by design.

---

## 1. Slot booking flow

1. **User selects caregiver** (e.g. from Matching or list).
2. **Optional: check availability** – Frontend can call `GET /api/bookings/slot-availability?caregiver_id=...&start_time=...&end_time=...` to show free/busy (overlap rule: `(startA < endB) AND (endA > startB)`).
3. **User submits slot** – Frontend calls `POST /api/bookings/slot` (or `POST /api/bookings` with `caregiver_id` + `status=requested`).
4. **Backend** – Validates input, then calls PostgreSQL function `book_slot_atomic(...)` in a **single transaction**:
   - Advisory lock on `(caregiver_id, slot_start)` so only one concurrent booking for that slot proceeds.
   - Re-check overlap with existing bookings (status in `requested`, `accepted`, `confirmed`, `in_progress`); if `is_emergency=true`, skip overlap check.
   - If free: insert booking with `status=requested` and return the row; otherwise raise `SLOT_ALREADY_BOOKED`.
5. **Response** – Success: 201 + booking object. Conflict: 409 + human-readable message. Validation/other errors: 4xx/5xx with clear messages.
6. **Frontend** – Disables submit while booking, shows loader, maps errors to user-friendly text, offers “Try again with a different slot” on conflict/network errors.

---

## 2. Database logic

- **Tables**: `bookings` (and optionally `caregiver_profile`). No separate `slots` table; availability is derived from existing bookings.
- **Overlap**: Two ranges overlap if `(startA < endB) AND (endA > startB)`. In PostgreSQL:  
  `(scheduled_date, end_date) OVERLAPS (p_start_time, p_end_time)` with `end_date = scheduled_date + duration_hours * interval '1 hour'` (or `end_date` column if present).
- **Blocking statuses**: `requested`, `accepted`, `confirmed`, `in_progress`. Cancelled/completed do not block.
- **Atomic booking**: Implemented in migration `backend/supabase/migrations/20260221_slot_booking_atomic.sql`:
  - `check_slot_available(p_caregiver_id, p_start_time, p_end_time, p_exclude_booking_id)` – returns true if no overlapping booking in blocking statuses.
  - `book_slot_atomic(...)` – takes care_recipient_id, caregiver_id, service_type, scheduled_date, duration_hours, optional location/specific_needs, `is_emergency`, video_call_request_id, chat_session_id:
    1. Validates time (duration 0.5–24 hours).
    2. `pg_advisory_xact_lock(caregiver_id_hash, epoch(scheduled_date))` so only one transaction books that caregiver+slot at a time.
    3. Re-checks overlap (unless `is_emergency`); if overlap, raises `SLOT_ALREADY_BOOKED` (23P01).
    4. Inserts one row with `status = 'requested'`.
    5. Returns the new row as JSONB.
- **Timezone**: All times stored and compared in **UTC**; frontend can show local time and send ISO 8601 with timezone or UTC.

---

## 3. Backend handler code (reference)

- **Slot availability**: `GET /api/bookings/slot-availability` in `backend/app/routers/bookings.py` – parses `caregiver_id`, `start_time`, `end_time`; calls `check_slot_available` RPC (or in-app overlap check if RPC missing); returns `{ available, caregiver_id, start_time, end_time }`.
- **Atomic slot booking**: `POST /api/bookings/slot` – body: `SlotBookRequest` (caregiver_id, service_type, scheduled_date, duration_hours, location, specific_needs, is_emergency, …). Verifies caregiver exists and is active, then calls `_call_book_slot_atomic()` which invokes `supabase_admin.rpc("book_slot_atomic", payload)`. Maps RPC exceptions:
  - `SLOT_ALREADY_BOOKED` / 23P01 → `ConflictError` (409): “This time slot was just booked…”
  - `SLOT_INVALID_TIME` / 22P02 → `ValidationError` (422): “Invalid time range…”
- **Legacy create**: `POST /api/bookings` – when `caregiver_id` is set and `status=requested`, the same `_call_book_slot_atomic()` is used so all “requested + caregiver” bookings are atomic.

---

## 4. Frontend handler code (reference)

- **API**: `pwa/src/api/bookings.ts` – `checkSlotAvailability(caregiverId, startTime, endTime)`, `bookSlot(data)`; both use `getAuthToken()` for Bearer and standard error body parsing.
- **Hook**: `pwa/src/hooks/useSlotBooking.ts` – `useSlotBooking()` returns `{ book, clearError, reset, isBooking, error, errorCode, success }`. Maps API errors to human-readable messages and codes (`SLOT_ALREADY_BOOKED`, `INVALID_TIME`, `CAREGIVER_UNAVAILABLE`, `NETWORK_FAILURE`, `SESSION_EXPIRED`, `UNKNOWN`).
- **Form**: `pwa/src/components/SlotBookingForm.tsx` – Uses the hook; disables submit and shows “Booking…” while `isBooking`; shows error with “Try again with a different slot” for conflict/network; shows success confirmation; supports “Book another” after success.
- **Screen**: `pwa/src/screens/SlotBookingScreen.tsx` – Reads `caregiverId` and `name` from query; renders `SlotBookingForm`. Linked from Matching as “Book slot” with `/booking/slot?caregiverId=...&name=...`.

---

## 5. Failure cases & handling

| Scenario | Backend behaviour | HTTP | Frontend message |
|----------|-------------------|------|-------------------|
| Slot already booked (race) | RPC raises `SLOT_ALREADY_BOOKED` | 409 | “This time slot was just booked. Please choose another time or caregiver.” + retry CTA |
| Invalid time range | RPC raises `SLOT_INVALID_TIME` or validation | 422 | “Invalid time range. Please use a valid start time and duration (0.5–24 hours).” |
| Caregiver unavailable/inactive | Validation before RPC | 404/422 | “Caregiver is not available. Please choose another caregiver.” |
| Network failure | Request fails / no response | 0 or 5xx | “Connection problem. Please check your internet and try again.” + retry |
| Session expired | Unauthorized | 401 | “Please sign in again to continue.” |
| Duplicate submit clicks | Submit disabled while `isBooking`; only one request in flight | – | N/A (no double submit) |
| User refresh during booking | In-flight request may complete or fail; no duplicate booking due to lock | – | Show error or success based on response |
| Midnight boundary | Handled by UTC timestamps and OVERLAPS | – | N/A |
| Back-to-back slots | Two distinct slot starts → two different advisory locks; both can succeed if no overlap | – | N/A |

All error responses use a consistent structure (e.g. `error.message`, `error.code`) so the frontend can show human-readable messages and retry where appropriate.

---

## 6. Test checklist

- [ ] **Slot availability**
  - [ ] `GET /api/bookings/slot-availability` with valid caregiver_id and range returns `available: true` when no overlapping booking.
  - [ ] With an existing booking (requested/accepted/confirmed/in_progress) overlapping the range, returns `available: false`.
  - [ ] Invalid `start_time`/`end_time` or `start_time >= end_time` returns 422.
- [ ] **Atomic booking**
  - [ ] `POST /api/bookings/slot` with valid payload returns 201 and one new booking with `status=requested`.
  - [ ] Two concurrent requests for the **same** caregiver and **same** slot: exactly one succeeds (201), the other gets 409.
  - [ ] After one success, a second request for the same slot returns 409 with “already booked” style message.
- [ ] **Emergency override**
  - [ ] With `is_emergency: true`, booking succeeds even when the caregiver has an overlapping booking (overlap check skipped in RPC).
- [ ] **Validation**
  - [ ] Invalid duration (e.g. 0 or > 24) or missing required fields → 422.
  - [ ] Invalid or inactive caregiver_id → 404/422.
- [ ] **Auth**
  - [ ] Without valid token (or care_recipient), slot booking returns 401.
- [ ] **Frontend**
  - [ ] Submit is disabled and loader shown while request is in progress.
  - [ ] 409 shows conflict message and “Try again with a different slot”.
  - [ ] Network error shows connection message and retry.
  - [ ] Success shows confirmation and optional “Book another”.
  - [ ] Duplicate clicks do not send two requests (button disabled).
- [ ] **Edge cases**
  - [ ] Back-to-back slots (e.g. 10:00–12:00 and 12:00–14:00) both bookable for same caregiver.
  - [ ] Slot spanning midnight (UTC) books and does not incorrectly overlap other days.
  - [ ] All times stored and compared in UTC; no double booking due to timezone mismatch.

---

## Summary

- **No double booking**: Advisory lock + overlap re-check inside `book_slot_atomic` ensure only one booking per caregiver per slot under concurrency.
- **Atomic**: One transaction (RPC) for validate → lock → check → insert.
- **Human-readable errors**: Backend and frontend map codes to clear messages; frontend supports retry and different-slot flow.
- **Production-safe**: Suitable for elderly and differently-abled users; no silent failures or race-condition double bookings.

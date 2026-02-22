# Real-time notifications

The app uses **in-app notifications** (Notifications screen and caregiver assignments) and **push notifications** (when configured). To make in-app updates feel instant, the frontend uses:

1. **Supabase Realtime** – subscribe to new rows in the `notifications` table for the current user. When the backend inserts a notification (e.g. new booking request, or “caregiver accepted”), the app refreshes the list immediately.
2. **Polling fallback** – every 10 seconds the caregiver dashboard/assignments are refreshed in case Realtime is not available.

## Enabling Supabase Realtime for notifications

For the Realtime subscription to receive events, the `notifications` table must be in Supabase’s **replication** set.

1. In **Supabase Dashboard**: go to **Database** → **Replication** (or **Realtime**).
2. Find the **public** publication (or the one used by your project).
3. Add the **`notifications`** table to the publication so **INSERT** (and optionally UPDATE) events are broadcast.

If Realtime is not enabled for `notifications`, the app still works: it will rely on the **10-second polling** and on **refresh when you open the Notifications screen** or pull-to-refresh.

## What gets notified

- **Caregiver**: “New Booking Request” when a care recipient creates a booking; in-app alert when a new assignment appears (if not first load).
- **Care recipient**: “Booking Status Update – [Caregiver] has accepted your booking” when the caregiver accepts (and similar for declined/cancelled/completed).
- **Accept/Decline in Notifications**: From the Notifications screen, the caregiver can tap **Accept Request** or **Decline** on a booking notification. After that, the assignment list and notification list refresh immediately (and via Realtime when enabled).

## Backend

- Notifications are created in `backend/app/services/notifications.py` (e.g. `notify_booking_created`, `notify_booking_status_change`).
- When the caregiver accepts or rejects a booking, `respond_to_booking` in `backend/app/routers/bookings.py` calls `notify_booking_status_change` so the care recipient gets an in-app (and push) notification with the caregiver’s name.

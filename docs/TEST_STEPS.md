# AssistLink — Test Steps by Feature

Format: **TC-ID** | **Action** | **Expected Result** | **Edge Case** | **Failure Handling**

---

## 1. Authentication

### Login

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| AUTH-L01 | Enter valid email and password, tap Log In | Redirect to role-specific dashboard (Care Recipient or Caregiver) | Role missing in profile → fallback to Care Recipient dashboard | Show error message; do not clear form |
| AUTH-L02 | Enter invalid password | Error message "Invalid email or password" | Rate limit → show "Too many attempts" | No silent failure |
| AUTH-L03 | Leave email or password empty, tap Log In | Validation message "Please enter email and password" | N/A | Button remains enabled after fix |
| AUTH-L04 | Tap "Forgot Password?", enter email, submit | Success message; reset email sent (or generic message to prevent enumeration) | Invalid email → same success message | Toast or inline message |
| AUTH-L05 | Tap "Sign up" link | Navigate to Register screen | N/A | N/A |
| AUTH-L06 | Log in with Google (when configured) | Redirect to dashboard with profile and role | No role in token → role from DB or default care_recipient | Show error if Google sign-in fails |

### Registration

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| AUTH-R01 | Select "Find Care", fill required fields (name, email, password), tap Create Account | Account created; auto-login; redirect to Care Recipient dashboard | Email already exists → "An account with this email already exists" | Show error; do not clear all fields |
| AUTH-R02 | Select "Care Giver", fill form, submit | Account created with role caregiver; redirect to Caregiver dashboard | Same as R01 | Same |
| AUTH-R03 | Submit with password &lt; 8 characters | Validation "Password must be at least 8 characters" | N/A | Inline or toast |
| AUTH-R04 | Submit with invalid email format | Validation "Please enter a valid email address" | N/A | Inline or toast |
| AUTH-R05 | Sign up with Google after selecting role | Account created with chosen role; redirect to dashboard | First-time Google user → profile created with role | Error toast if API fails |

### Logout

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| AUTH-O01 | Tap Logout from menu/settings | Tokens cleared; redirect to Login screen | Network error during optional server logout → still clear local state and redirect | No silent failure; UI must show Login |

---

## 2. Dashboard (Care Recipient)

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| DASH-C01 | Open app as care recipient | Welcome message; upcoming bookings; quick actions (Request Help, Schedule, Emergency) | No bookings → show empty state or "No upcoming visits" | Loading then content or error message |
| DASH-C02 | Tap "Request Help" / "Request New Care" | Navigate to New Request or caregiver matching | N/A | N/A |
| DASH-C03 | Tap Emergency / SOS | Navigate to Emergency screen or trigger SOS per implementation | N/A | N/A |
| DASH-C04 | Tap a booking card | Navigate to booking detail | Expired or cancelled → still open detail with status | N/A |
| DASH-C05 | Pull to refresh (if implemented) | Bookings list refreshes | API error → show error, keep previous list | Toast or inline error |

---

## 3. Dashboard (Caregiver)

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| DASH-G01 | Open app as caregiver | Caregiver dashboard with availability, requests, schedule | No requests → empty state | Loading then content or error |
| DASH-G02 | Tap a booking/request | Navigate to appointment detail; can Accept/Decline | N/A | N/A |
| DASH-G03 | Tap Emergency from menu | Navigate to Emergency screen (view or respond to alerts) | No active emergencies → show "No active alerts" or similar | N/A |

---

## 4. Caregiver Matching & Care Request

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| REQ-01 | Open caregiver list / matching | List of available caregivers (from API); filters if present | Empty list → "No caregivers available" | API error → message, retry option |
| REQ-02 | Apply filters (distance, rating, skills) | List updates per filters | No results → empty state message | Same as REQ-01 |
| REQ-03 | Select service type (Exam Assistance, Daily Care, Emergency), set date/time, add details, Submit | Request/booking created; confirmation shown | Validation error → field-level or toast | Show backend error message |
| REQ-04 | Save as draft (if implemented) | Draft saved; can resume later | N/A | Toast on save failure |
| REQ-05 | Select a caregiver then start booking | Booking flow with selected caregiver pre-filled | Caregiver no longer available → message and allow reselect | Clear error message |

---

## 5. Booking Detail & Actions

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| BKD-01 | Open booking detail | Full booking info; timeline/history; actions by role and status | 404 → "Booking not found", go back | Alert or toast |
| BKD-02 | Caregiver: Accept booking | Status → accepted; requester notified | Already accepted by another → message | Show API error |
| BKD-03 | Caregiver: Decline with reason | Status → rejected; requester notified | N/A | Show API error on failure |
| BKD-04 | Either: Cancel booking | Status → cancelled; confirmation | Already completed → error | Show API error |
| BKD-05 | Mark complete / Complete payment (as per flow) | Status updated; payment or completion confirmed | Payment failure → retry or message | No silent failure |

---

## 6. Chat

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| CHAT-01 | Open chat list | List of sessions with last message preview | No sessions → empty state | API error → message |
| CHAT-02 | Open a thread | Messages load; can send text | Realtime updates if implemented | Send failure → show retry or "Message not sent" |
| CHAT-03 | Send message | Message appears; status/delivery if implemented | Long message → truncate or allow | Character limit message if any |
| CHAT-04 | Send attachment / file (if implemented) | File uploaded; message with attachment shown | Large file → size limit error | Clear error |
| CHAT-05 | Tap video call | Navigate to video call or request | Unsupported (e.g. Expo Go) → message "Use dev build" | Show message, don't crash |
| CHAT-06 | Tap emergency alert in chat | Emergency flow triggered or Emergency screen opened | N/A | Same as emergency flow |

---

## 7. Video Call

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| VID-01 | Join video call from link or booking | Connect to room; local and remote video if available | Expo Go → "Not supported" message and Go Back | No crash |
| VID-02 | Toggle camera/mic | Local stream updates | Permission denied → message | Show permission error |
| VID-03 | Leave / End call | Call ends; navigate back; completion recorded if applicable | Network drop → disconnect and show "Call ended" | Handle disconnect gracefully |
| VID-04 | Network failure during call | User notified; option to reconnect or leave | N/A | No silent failure |

---

## 8. Emergency

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| EMR-01 | Care recipient: Press and hold SOS 3 seconds | Emergency triggered; location sent; "Alerts sent"; status visible | GPS disabled → location "Unknown" or "Not available"; alert still sent | Show "PLEASE CALL EMERGENCY SERVICES OR CONTACTS MANUALLY" if API fails |
| EMR-02 | Care recipient: View emergency status after trigger | Status (active / acknowledged / resolved); responding caregiver if any | Stub mode (no DB) → message that full alerts need setup | Don't crash |
| EMR-03 | Caregiver: Open Emergency from notification or menu | See active alert; recipient info and location | No location → "Not provided" | N/A |
| EMR-04 | Caregiver: Tap "I am on my way" | Status → acknowledged; care recipient notified | Already resolved → success message | Show API error on failure |
| EMR-05 | Caregiver: Mark as Resolved | Status → resolved; care recipient can see update | N/A | Show API error on failure |
| EMR-06 | Either: Call 911 or emergency contact | System dialer opens with correct number | Missing number → show "Contact number not available" or 911 | N/A |

---

## 9. Notifications

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| NOT-01 | Open Notifications screen | List of notifications (unread highlighted if supported) | Empty → "No notifications" | API error → message |
| NOT-02 | Tap a notification | Navigate to related screen (booking, chat, emergency) | Invalid or deleted target → show "Content not found" or list | No crash |
| NOT-03 | Mark all as read | All marked read; list updates | API failure → revert or show error | Toast on failure |

---

## 10. Profile & Settings

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| PRF-01 | View profile | Name, email, phone, emergency contact, etc. | Missing fields → show placeholders or "Not set" | API error → message |
| PRF-02 | Edit profile and save | Success; updated data shown | Validation error → field message | Show backend error |
| PRF-03 | Set emergency contact (name, phone) | Saved; shown on profile and Emergency screen | Invalid phone → validation message | Show error |
| SET-01 | Toggle Large Text | Text scales up across app (if applied globally) | N/A | Persist preference |
| SET-02 | Toggle High Contrast | Contrast theme applied (if implemented) | N/A | Persist preference |
| SET-03 | Toggle Push Notifications | Preference saved (and synced to backend if implemented) | N/A | Persist; show error if sync fails |
| SET-04 | Change password | Success message; require re-login or stay logged in per product | Wrong current password → "Incorrect current password" | Show API error |

---

## 11. Help & Support

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| HLP-01 | Open Help & Support | FAQ, contact form, links (terms, version) | N/A | N/A |
| HLP-02 | Submit feedback | Success message; form clears | API error → "Failed to submit feedback" | Alert or toast |
| HLP-03 | Submit contact form (email + message) | Success message | Validation → "Please fill all fields" | Alert or toast |
| HLP-04 | Tap "Video tutorials" / "User manual" | Opens link or "Coming soon" message | N/A | No crash |

---

## 12. Accessibility & Edge Flows

| TC-ID | Action | Expected Result | Edge Case | Failure Handling |
|-------|--------|-----------------|-----------|------------------|
| ACC-01 | Use with screen reader | All main actions have labels; flow is navigable | N/A | Add labels where missing |
| ACC-02 | Use keyboard (web PWA) | Tab through focusable elements; Enter activates | N/A | Focus visible |
| GPS-01 | Disable device GPS; trigger emergency | Alert still sent; location "Not available" or similar | N/A | Message to call manually if needed |
| OFF-01 | Go offline; perform action | Queued or "No connection" message per feature | Sync when back online if implemented | No silent failure |

---

*End of Test Steps*

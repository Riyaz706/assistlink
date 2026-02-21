# AssistLink — UI/UX & Accessibility Audit Report

**Role:** Senior UI/UX QA Engineer, Accessibility Auditor  
**Application:** AssistLink PWA (elderly, differently-abled, caregivers)  
**Testing mode:** STRICT — any confusion = production blocker  
**Date:** 2025-02-20

---

## 1. UI issues found

| # | Screen / Component | Issue | Risk |
|---|-------------------|--------|------|
| 1 | CareRecipientDashboard | Duplicate success Alert shown twice after saving emergency contact | Low |
| 2 | CareRecipientDashboard (modal) | Close button touch target &lt; 44px (padding 4 only) | High |
| 3 | LoginScreen | Back button touch target &lt; 44px (padding 8 only) | High |
| 4 | LoginScreen | Google sign-in button missing accessibilityLabel | Medium |
| 5 | EmergencyScreen | Close button touch target &lt; 44px (padding 5) | High |
| 6 | EmergencyScreen | Caregiver "Call Recipient" and "Mark as Resolved" missing accessibilityLabel | Medium |
| 7 | EmergencyScreen | Recipient "Call 911 / Emergency contact" button missing accessibilityLabel | Medium |
| 8 | CaregiverDashboard | Bell (notifications) touch target &lt; 44px (padding 8) | High |
| 9 | PaymentScreen | Back button no min width/height; Pay button missing a11y state/label | Medium |
| 10 | BookingsScreen | Add button is icon-only (has a11y label; visual users may expect "Add" text on very small viewports) | Low |
| 11 | NotificationsScreen | Back button and modal close buttons &lt; 48px | High |
| 12 | ChatDetailsScreen | Back button no min touch target | Medium |
| 13 | Emergency access | SOS reachable only from dashboard (swipe) or menu (2 taps) on Schedule, Bookings, Payment, Chat details, etc. | **Critical** |
| 14 | LoadingState | No accessibility role/label for screen readers | Medium |
| 15 | Various | Several back/close buttons across app use padding-only (4–8px) without min 48px | High (aggregate) |

---

## 2. Responsive issues

| # | Screen / Area | Issue | Device size | Notes |
|---|--------------|--------|-------------|--------|
| 1 | Global | No responsive breakpoints (e.g. 360 / 390 / 768 / 1024) — layout uses `Dimensions.get('window')` once; no subscription to resize | All | PWA resize after load may not recompute; tablet/desktop may see mobile layout only. |
| 2 | CareRecipientDashboard | SOS swipe button width `BUTTON_WIDTH = SCREEN_WIDTH - 32` — safe on 360px; very wide on tablet with no max-width | 768+, 1024+ | Visual only; interaction still works. |
| 3 | CaregiverDashboard | Horizontal assignment cards `width: width * 0.75` — reasonable on 360–390; may want max-width on large screens | 768+ | Low. |
| 4 | Modals (Emergency contact, Menu) | `width: '90%'` / `minWidth: 260` — acceptable on small and large; no explicit max-width on very wide | 1024+ | Low. |
| 5 | BottomNav | Fixed 5 tabs (care recipient); minWidth 56 per tab — 360px may feel tight; no horizontal scroll | 360×640 | Medium; verify no overlap. |
| 6 | Emergency FAB | Positioned `top: 52/56, right: 16` — may overlap with device notch/safe area on some devices | 360×640, 390×844 | SafeAreaView does not wrap FAB; consider useSafeAreaInsets for top. |

**Recommendation:** Add a `useWindowDimensions` (or resize listener) where layout depends on width (e.g. card width, SOS bar). Use `useSafeAreaInsets()` for FAB top offset on notched devices.

---

## 3. Accessibility issues

| # | Area | Issue | Fix / status |
|---|------|--------|--------------|
| 1 | Emergency FAB | New persistent SOS button added so Emergency is ≤1 tap from every screen for care recipients | **Fixed** — `EmergencyFAB.tsx` + integration in `App.js`. |
| 2 | Buttons | Multiple icon-only or small-label buttons without `accessibilityLabel` or `accessibilityRole` | **Fixed** where listed: Login (back, Google), Emergency (close, Call Recipient, I’m on my way, Mark resolved, Call 911), Caregiver bell, Payment (back, Pay). |
| 3 | LoadingState | Screen readers not informed of loading | **Fixed** — container has `accessibilityRole="progressbar"` and `accessibilityLabel={message}`. |
| 4 | Touch targets | Several &lt; 44px (theme requires 48px) | **Fixed** for: CareRecipientDashboard modal close, Login back, Emergency close, Caregiver bell, Payment back, Notifications back/close, ChatDetails back. |
| 5 | Focus order | Not tested (keyboard-only / screen reader flow) | **Manual** — verify logical tab order on web build; no focus traps in modals. |
| 6 | Error messages | useErrorHandler shows in-screen error; ensure announced (e.g. `accessibilityLiveRegion` or focus move) | **Recommendation** — add live region or focus management for error state on Login/Register. |
| 7 | High contrast / large text | ThemeContext and theme support large text and high contrast; Settings toggles exist | **Verified** — ensure all screens use theme colors/typography. |

---

## 4. Interaction problems

| # | Issue | Status |
|---|--------|--------|
| 1 | Accidental double-tap on Pay Now | Already guarded with `submittingRef` (see Release Certification Report). |
| 2 | Emergency SOS double-trigger | Already guarded with `triggerInProgressRef` and `disabled={locationLoading}`. |
| 3 | No disabled state during loading on some buttons | Login button has `disabled={loading}`; Payment has `disabled={loading \|\| !canPay}`. Other screens: verify primary actions disable during submit. |
| 4 | Pressed/active feedback | AppButton and BottomNav use `activeOpacity` / `pressed` style; Emergency FAB uses `pressed` style. |
| 5 | One-handed use | Emergency FAB top-right; SOS swipe on dashboard. FAB is reachable without scrolling. |

---

## 5. Fixes applied

| # | File(s) | Change |
|---|---------|--------|
| 1 | `frontend/src/components/EmergencyFAB.tsx` (new) | Persistent SOS FAB for care recipients; min 48px touch target; `accessibilityLabel` / `accessibilityRole` / `accessibilityHint`. |
| 2 | `frontend/App.js` | Wrapped `AppNavigator` in `View` and rendered `EmergencyFAB` as sibling so SOS is visible on all authenticated care-recipient screens. |
| 3 | `frontend/src/CareRecipientDashboard.tsx` | Removed duplicate `Alert.alert` on save emergency contact; modal close button style: `minWidth/minHeight: 48`, centered content. |
| 4 | `frontend/src/LoginScreen.tsx` | Back button: `styles.backButton` with `minWidth/minHeight: themeA11y.minTouchTargetSize`, `accessibilityLabel` "Go back", `accessibilityRole="button"`. Google button: `accessibilityLabel="Sign in with Google"`, `accessibilityRole="button"`. |
| 5 | `frontend/src/EmergencyScreen.tsx` | Close button: `minWidth/minHeight: 48`, padding 8, `accessibilityLabel` "Close emergency screen". Caregiver: "I am on my way" and "Mark as Resolved" and "Call Recipient" with `accessibilityLabel` / `accessibilityRole`. Recipient call button: dynamic `accessibilityLabel` (Call X / Call 911). |
| 6 | `frontend/src/CaregiverDashboard.tsx` | Bell: `minWidth/minHeight: 48`, `accessibilityLabel` "View notifications", `accessibilityRole="button"`. |
| 7 | `frontend/src/PaymentScreen.tsx` | Back: `minWidth/minHeight: 48`, `accessibilityLabel` "Go back". Pay: `accessibilityLabel` (loading vs "Pay now"), `accessibilityRole="button"`, `accessibilityState={{ disabled }}`. |
| 8 | `frontend/src/NotificationsScreen.tsx` | `backButton`: `minWidth/minHeight: 48`. `closeBtn`: `minWidth/minHeight: 48`, justify/align center. |
| 9 | `frontend/src/ChatDetailsScreen.tsx` | `backBtn`: `minWidth/minHeight: 48`, `justifyContent: 'center'`. |
| 10 | `frontend/src/components/LoadingState.tsx` | Container: `accessibilityRole="progressbar"`, `accessibilityLabel={message}`. ActivityIndicator: `accessibilityLabel="Loading"`. |

---

## 6. Manual UI test checklist

Use this before release. Mark Pass/Fail and note device/size where relevant.

### 6.1 UI inventory (smoke)

- [ ] **Auth:** Login, Register, Forgot Password, Reset Password — layout correct; no clipped content.
- [ ] **Care recipient:** Dashboard, New Request, Schedule, Bookings, Booking Detail, Profile, Chat List, Chat Details, Payment — all render; primary actions visible.
- [ ] **Caregiver:** Dashboard, Schedule, Chat List, Chat Detail, Profile, Appointment Detail — all render; primary actions visible.
- [ ] **Common:** Emergency, Notifications, Video Call, Settings, Help & Support, Edit Profile, Change Password — all render.

### 6.2 Responsive (if possible on 360, 390, 768, 1024)

- [ ] 360×640: No horizontal scroll; no overlapping buttons; text readable (≥16px where required).
- [ ] 390×844: Same as above; FAB and nav not clipped.
- [ ] 768×1024: Layout still usable (no tiny strip in center); modals and lists scale.
- [ ] 1024×1366: Same; consider max-width for content if needed.

### 6.3 Touch and interaction

- [ ] All primary buttons and nav items feel at least 44–48px; no “hard to tap” areas.
- [ ] Login: tap Back, Log In, Google, Register, Forgot Password — each responds once; no double submit on Log In.
- [ ] Payment: double-tap Pay Now — only one request.
- [ ] Emergency (recipient): press-and-hold 3s — single trigger; offline shows “call 911” message.
- [ ] Loading: primary CTAs disabled and show loading state where applicable.

### 6.4 Visual clarity

- [ ] Body text ≥16px (or theme body); headings clearly larger.
- [ ] Error and success messages readable; contrast sufficient (WCAG AA where applicable).
- [ ] Icon actions have text or clear a11y label (no icon-only critical actions without label).

### 6.5 Accessibility

- [ ] **Emergency:** From every care-recipient screen, one tap on SOS FAB opens Emergency screen.
- [ ] **Screen reader (or TalkBack/VoiceOver):** Login, Dashboard, Bookings, Emergency, Payment — key actions have sensible labels and order.
- [ ] **Focus:** On web, Tab through Login and Dashboard — no focus trap; focus visible.
- [ ] **Errors:** Login with wrong credentials — error message present and preferably announced.

### 6.6 Error and empty states

- [ ] No bookings: EmptyState with message and “Create a booking” (or equivalent).
- [ ] API failure on list screens: ErrorState with message and “Try again” (or retry).
- [ ] Offline: OfflineContext/useErrorHandler show clear message; Emergency offline shows “call 911” guidance.
- [ ] Session expired: Redirect to login; no blank screen.

### 6.7 Emergency UI (critical)

- [ ] Care recipient: SOS FAB visible on Dashboard, Schedule, Bookings, Profile, Chat list, Chat details, Payment, Settings, Help (no need to scroll).
- [ ] One tap on FAB opens Emergency screen.
- [ ] Emergency screen: press-and-hold 3s sends alert; loading state and success/error feedback clear.
- [ ] Caregiver: When there is an active emergency, banner visible; tap opens Emergency screen.
- [ ] During scroll/form/video call: FAB remains reachable (and does not block critical content).

### 6.8 Consistency and polish

- [ ] Primary buttons: same style (e.g. AppButton or theme green); secondary/outline consistent.
- [ ] Back/close: same pattern (arrow or X); touch targets consistent (48px).
- [ ] Loaders: ActivityIndicator or LoadingState; no ad-hoc spinners with different sizes/colors.
- [ ] Modals: close control top-right or explicit “Cancel”; overlay dismiss where specified.

---

## 7. Step 1 — UI inventory (reference)

| Screen / flow | Layout | Key actions | Risk |
|---------------|--------|-------------|------|
| **Auth** | | | |
| Login | Centered form, logo, social, register link | Log In, Google, Forgot password, Register | Medium |
| Register | Form, terms, login link | Register, Login | Medium |
| Forgot / Reset password | Form | Submit, Back | Low |
| **Care recipient** | | | |
| CareRecipientDashboard | Header, profile card, Request care, SOS swipe, Current status cards, BottomNav | Menu, Notifications, Profile, Request care, SOS swipe, View all, Mark completed, Track | High |
| NewRequestScreen | Multi-step form | Back, Next, Submit | High |
| Schedule | List / calendar | Back, item tap | Medium |
| BookingsScreen | Header, list, BottomNav absent | Back, Add, item tap, Refresh | Medium |
| BookingDetailScreen | Detail, actions | Back, Pay, Start video, etc. | High |
| PaymentScreen | Centered amount, Pay button | Back, Pay now | High |
| ProfileScreen | Cards, toggles, BottomNav | Settings, Edit, Help, Logout | Medium |
| ChatList | List, BottomNav | Back, conversation tap | Medium |
| ChatDetailsScreen | Header, messages, input | Back, Video, Send | Medium |
| **Caregiver** | | | |
| CaregiverDashboard | Header, SOS banner (if active), stats, horizontal assignments, bottom nav | Notifications, See all, card tap, nav items | High |
| ScheduleScreen2 | List | Back, item tap | Medium |
| ChatList2 / ChatDetailScreen2 | Same pattern as recipient | Back, conversation, send | Medium |
| ProfileScreen2 | Similar to Profile | Nav items, settings | Low |
| CaregiverAppointmentDetailScreen | Detail | Back, Accept, etc. | High |
| **Common** | | | |
| EmergencyScreen | Dark, instructions, SOS button or status, footer actions | Close, Press-and-hold, Call, Navigate, Resolve | **Critical** |
| NotificationsScreen | Tabs, list | Back, Refresh, Mark all read, item actions | Medium |
| VideoCallScreen | Video views, controls | Mute, camera, end call | High |
| SettingsScreen | Sections, list items, switches, BottomNav | Back, each item, toggles | Low |
| HelpSupportScreen | Content, links, BottomNav | Back, links | Low |
| EditProfile / ChangePassword | Forms | Back, Save | Medium |

---

## 8. Final rule

**This UI is used by vulnerable users. If a first-time user hesitates or feels confused, the UI has failed.**

All fixes above are applied in code. Complete the manual checklist on real devices (and, if possible, with screen reader and different viewport sizes) before release. Any remaining responsive or a11y gaps should be logged and fixed before go-live.

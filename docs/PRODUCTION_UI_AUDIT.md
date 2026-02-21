# AssistLink — Production UI & UX Audit

**Date:** 2025-02  
**Scope:** Frontend (Expo/React Native with web support)  
**Audience:** Elderly, differently-abled users, caregivers — production readiness.

---

## Tech Stack (Actual vs Brief)

| Brief (requested)     | Actual codebase                          |
|-----------------------|------------------------------------------|
| React (Vite)          | **Expo / React Native** (no Vite)        |
| Tailwind CSS          | **StyleSheet + theme.ts** (no Tailwind)  |
| PWA Service Worker    | **Expo web** (service worker via Expo)   |
| Supabase              | **Supabase** (Auth, DB) + **FastAPI** backend |

This audit and all fixes are based on the **actual stack**: React Native/Expo, central `theme.ts`, and responsive patterns using `Dimensions` / `useWindowDimensions`.

---

## Step 1: UI & Responsiveness Audit

### Global issues

| # | Problem | Affected | Fix strategy |
|---|---------|----------|--------------|
| G1 | **Font sizes below 16px** used for body/labels across many screens (14, 13, 12, 11, 10). Fails minimum readable size for elderly. | All screens | Use `typography.body` (16) or `typography.bodySmall` (14) minimum for any readable text; reserve 12px only for non-essential captions and scale with accessibility. |
| G2 | **Touch targets below 44px** in several places (e.g. eye icon padding 8, some icon-only buttons). | Login, Register, Chat, Settings, Dashboards | Enforce `theme.accessibility.minTouchTargetSize` (48) for all interactive elements; add minWidth/minHeight 48 or padding to meet 44px. |
| G3 | **No single source for responsive breakpoints.** Layouts use fixed widths (e.g. 250, 260, 360) that can overflow or look wrong on 360px or small tablets. | Emergency, CareRecipient, Menu, Modals | Use `Dimensions.get('window')` or `useWindowDimensions()` and percentage/minWidth for key containers; avoid fixed px for full-width elements on small devices. |
| G4 | **Color-only meaning** in some status badges (e.g. only color change without icon or clear text). | BookingsScreen, ScheduleScreen2, CaregiverDashboard | Always pair color with icon and/or explicit text (e.g. "Confirmed", "Pending"); ensure status is not conveyed by color alone. |
| G5 | **Offline banner has no recovery action** (no "Retry" or "Dismiss"). | Global (OfflineContext) | Add "Dismiss" or "Retry" button and ensure message is clear ("You're offline. Changes will sync when back online."). |
| G6 | **ErrorBoundary button has no min touch target** and small font. | Global | Style "Try Again" with minHeight 48, fontSize ≥ 16, and accessibilityLabel. |

---

### By screen

| Screen | Problem | Device size | Fix strategy |
|--------|---------|-------------|--------------|
| **LoginScreen** | Label/footer/divider/error text at 14px; eye icon touch target ~24px. | All | Use theme typography (body 16, bodySmall 14); increase eye icon hit area to 48px. |
| **LoginScreen** | Fixed logo 80×80; horizontal padding 24 — can feel tight on 360px. | 360px | Keep 80px or use % for logo; ensure ScrollView and flex so content doesn’t overflow. |
| **RegisterScreen** | Same as Login (14px in labels, footer, helper); role cards may be tight on 360px. | All / 360px | Theme typography; ensure role cards flex and have min touch target 48. |
| **CareRecipientDashboard** | date 12px; link 13px; caregiverText/arriving 13px; percentText 10px; serviceText 12px; modalDesc 14px; inputLabel 13px; menuPanel minWidth 260 can overflow on 360px. | All / 360px | Replace with theme.body/bodySmall; set menu panel to maxWidth: '100%' and padding; ensure all interactive items ≥ 48px. |
| **CareRecipientDashboard** | Duplicate accessibilityLabel on menu and bell buttons. | All | Remove duplicate accessibilityLabel/accessibilityRole. |
| **CaregiverDashboard** | welcomeText/statGrowth/statSub 12px; clientName 15; many 10–12px (confirmedText, reqDuration, navText, etc.). | All | Use theme typography; ensure list items and nav tabs have min touch target 48. |
| **EmergencyScreen** | Fixed circles 250/220 and 150px; instruction text 14px; dark theme contrast OK but text size fails 16px rule. | All / 360px | Use Dimensions for circle sizes (e.g. width * 0.6 max); set body text to ≥ 16px. |
| **NewRequestScreen** | Tab width from (width - padding) / 3 can make tabs small on 360px; font 14/12 in places. | 360px | Min width for tabs or larger tap targets; use theme typography. |
| **BookingsScreen** | StatusBadge and card text — ensure 16px for primary content, 14px secondary. | All | Use theme; ensure card and badge meet touch target if tappable. |
| **BookingDetailScreen** | Font sizes 12–15; some buttons already 44px min — good. | All | Standardize to theme; keep min touch targets. |
| **ChatDetailsScreen** | Timestamp/caption 10px; input 15px; sendBtn 44px — good. | All | Timestamp can stay small if purely secondary; input and primary actions ≥ 16px. |
| **SettingsScreen** | itemLabel 16 (good); backBtn 48 (good). Section titles and values — ensure 16/14. | All | Already mostly compliant; ensure high-contrast/large-text applies to all text. |
| **ProfileScreen** | Font sizes 11–14 in places; avatar 90px fixed. | All / 360px | Theme typography; avatar can scale with width. |
| **NotificationsScreen** | Multiple 11–15px fonts. | All | Use theme.body/bodySmall for list and labels. |
| **VideoCallScreen** | Font 14; placeholder 100×150 fixed. | All | Body text ≥ 16px; use flex or % for placeholder. |
| **ScheduleScreen2 / ScheduleScreen** | status 11px; meta 12px; role 13px; avatar 48–50. | All | Theme typography; avatars OK; ensure row tap target 48. |
| **HelpSupportScreen** | backBtn 48 (good); inputMultiline minHeight 80. | All | Ensure resource links and buttons 48px. |
| **Matchmaking** | Many 11–13px (tagText, qualTagText, perHour, etc.); modal/popup fixed widths. | All / 360px | Theme typography; modal maxWidth 100% and padding. |
| **ErrorBoundary** | Small detail text (12px); button not 48px. | All | Message and button ≥ 16px; button minHeight 48; accessibilityLabel. |
| **BottomNav** | Already uses minTouchTargetSize and minHeight — good. | — | Keep; ensure label font ≥ 14. |

---

### Overflow and layout

| Location | Problem | Fix |
|----------|---------|-----|
| ScrollView content | Some screens use fixed paddingBottom (e.g. 20, 30, 100). | Use consistent contentContainerStyle with flexGrow: 1 and paddingBottom ≥ 24 so content scrolls naturally. |
| Modals (menu, contact, etc.) | minWidth 260 or fixed width can overflow on 360px. | maxWidth: '100%', marginHorizontal, padding 16. |
| EmergencyScreen circles | Fixed 250/220px. | Use width * 0.7 or similar so they scale on small screens. |
| NewRequestScreen tabs | TAB_WIDTH can be very small on 360px. | Set minTabWidth or use flex: 1 with min width so tabs remain tappable. |

---

### Contrast and feedback

| Issue | Fix |
|-------|-----|
| Error text (e.g. #DC2626 on #FEF2F2) | Already sufficient; ensure all error states have icon + message. |
| Disabled buttons | Use opacity or theme-based disabled style; always show loading state when submitting. |
| Success feedback | Ensure every critical action (submit, accept, complete) shows clear success message or transition. |

---

## Summary: Priority Fixes

1. **Typography:** Replace all body/label font sizes &lt; 16px with theme `typography.body` (16) or `bodySmall` (14); keep caption 12 only for non-essential text.
2. **Touch targets:** Enforce 48px minimum (theme.accessibility.minTouchTargetSize) for every button, link, and icon control.
3. **Responsive:** Use Dimensions/useWindowDimensions for key widths; avoid fixed widths &gt; 90% of screen on 360px; modals and panels maxWidth '100%'.
4. **Accessibility:** Remove duplicate a11y props; ensure high contrast and large text (already wired) apply; add recovery actions for offline and error states.
5. **Components:** Introduce shared Button, Input, Card, EmptyState, LoadingState, ErrorState for consistency and future maintenance.

---

## Fixes Applied (Post-Audit)

- **Theme typography:** LoginScreen labels, error, footer, divider use `themeTypography.body` (16) or `bodySmall` (14). Eye icon touch area set to `minTouchTargetSize` (48px).
- **CareRecipientDashboard:** Duplicate accessibilityLabel removed; menu panel `maxWidth: '100%'`, `marginHorizontal: 16`; date, link, caregiverText, modalDesc, inputLabel, input, arriving set to 14–16px.
- **ErrorBoundary:** Try Again button `minHeight: 48`, font 16, `accessibilityLabel="Try again"`; detail text 14px.
- **OfflineContext:** Message clarified: "You're offline. Your actions will sync when you're back online."; banner text 16px.
- **BookingsScreen:** Uses `LoadingState` and `EmptyState`; back/add buttons 48px min, accessibility labels; add button color aligned to theme (green).
- **EmergencyScreen:** Location text 16px.
- **Shared components:** `AppButton`, `EmptyState`, `LoadingState`, `ErrorState` added under `src/components/` for reuse.

Next: **Step 4–8** — Accessibility and flows already partially in place; see **PRODUCTION_CHECKLIST.md** for verification and manual test steps.

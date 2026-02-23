r# AssistLink — UI/UX Design Specification

**Principal design doc for a calm, accessible, production PWA.**  
Audience: Elderly users, differently-abled users, caregivers under stress (exams, emergencies).

---

## Design philosophy

| Principle | Meaning |
|-----------|--------|
| **Calm > Fancy** | No flashy animations or visual noise. Breathing room, soft edges, predictable motion. |
| **Clarity > Decoration** | Every element has a job. No decorative-only graphics that compete with actions. |
| **Accessibility > Aesthetics** | Contrast, touch targets, labels, and keyboard/focus come before “looking cool.” |
| **Mobile-first always** | 360px baseline. Desktop is an enhancement; small screens are the default. |

**Success test:** A first-time elderly user can understand the screen in ~3 seconds, tap the right action without help, and feel calm rather than stressed.

---

## Design system (mandatory)

### Color palette

Align with `frontend/src/theme.ts`. Use these semantic names everywhere.

| Role | Hex | Usage |
|------|-----|--------|
| **Primary** | `#2563EB` | Trust, main CTAs, links, selected states |
| **Primary dark** | `#1D4ED8` | Pressed/hover primary |
| **Secondary** | `#059669` | Success, care, confirm, “go” actions |
| **Secondary dark** | `#047857` | Pressed secondary |
| **Accent / Warning** | `#F59E0B` | Warnings, highlights, optional CTAs |
| **Error** | `#DC2626` | Errors, danger, destructive actions |
| **Background** | `#F8FAFC` | Page/screen background |
| **Card** | `#FFFFFF` | Cards, modals, inputs |
| **Text primary** | `#1F2937` | Headings, body |
| **Text secondary** | `#6B7280` | Hints, captions, metadata |
| **Text muted** | `#9CA3AF` | Placeholders, disabled |
| **Border** | `#E5E7EB` | Dividers, input borders |

**Rule:** Never rely on color alone. Pair color with text or icons (e.g. “Available” + green; “Booked” + grey + label).

### Typography

| Token | Size (px) | Use |
|-------|-----------|-----|
| `headingLarge` | 24 | Screen title (e.g. “Dashboard”) |
| `headingMedium` | 20 | Section title |
| `headingSmall` | 18 | Card title, modal title |
| `body` | 16 | Body text (minimum 16px) |
| `bodySmall` | 14 | Secondary text, captions |
| `caption` | 12 | Labels, timestamps (avoid for critical copy) |

- **Headings:** Inter or Poppins (clean, legible).
- **Body:** Open Sans or system UI.
- **Line height:** ≥ 1.5 for body (e.g. 24px for 16px font).
- **Large-text mode:** Scale body/headings by ~1.2 when user enables “Large text” in Settings.

### Spacing

Use the theme spacing scale consistently:

| Token | Px | Use |
|-------|-----|-----|
| `xs` | 4 | Icon–text gap, tight grouping |
| `sm` | 8 | Related elements |
| `md` | 16 | Default padding, gaps between sections |
| `lg` | 24 | Section spacing, card padding |
| `xl` | 32 | Major section breaks |
| `xxl` | 48 | Hero / welcome area |

**Rule:** Generous padding. No crowded layouts. Clear visual grouping.

### Border radius

| Token | Px | Use |
|-------|-----|-----|
| `sm` | 6 | Badges, tags |
| `md` | 10 | Buttons, inputs |
| `lg` | 16 | Cards, modals |
| `full` | 9999 | Pills, avatars |

### Accessibility constants

| Token | Value | Use |
|-------|--------|-----|
| `minTouchTargetSize` | 48px | All tappable/clickable elements |
| `minFontSize` | 16px | Body and interactive labels |
| `contrastBorderWidth` | 2px | Focus ring (high-contrast mode) |

---

## Global UI rules (strict)

1. **Mobile-first** — Design for 360px width first.
2. **Minimum touch target** — 44px (prefer 48px) for every interactive element.
3. **No hover-only actions** — Every action must be available on tap/click.
4. **No icon-only critical actions** — Pair with text (e.g. “Send” + icon).
5. **Every action shows feedback** — Loading, success, or error state.
6. **Buttons must look clickable** — Clear shape, padding, contrast.
7. **No dense tables** — Prefer cards or list rows with ample padding.
8. **No hidden primary actions** — Primary CTA visible without scrolling when possible.

---

## Component design

### Buttons

- **Primary:** Background `secondary` (#059669), white text, `minHeight: 48px`, `paddingHorizontal: 24px`, `borderRadius: md`.  
  States: default, pressed (slightly darker), disabled (opacity 0.6), loading (spinner + disabled).
- **Secondary:** Background `background` or outline with `primary` border; text `primary`. Same min height and padding.
- **Danger:** Background `error`, white text. Same size rules. Use for “Delete”, “Cancel booking”, etc.
- **Accessibility:** `accessibilityRole="button"`, `accessibilityLabel` (and `accessibilityHint` where helpful). Visible focus ring (2px outline).

**Tailwind-style:**  
`min-h-[48px] px-6 rounded-lg font-semibold text-base` + bg/color variants.

### Inputs

- **Height:** At least 48px (single-line). Multiline: min height ~80px.
- **Border:** 1px `border`, `borderRadius: md`. Focus: 2px `primary` outline.
- **Label:** Above input, `bodySmall` or `body`, `textPrimary` or `textSecondary`.
- **Placeholder:** `textMuted`, never only placeholder for required fields.
- **Error:** Border `error`, error message below in `bodySmall` + `error`.

**Tailwind-style:**  
`h-12 px-4 rounded-lg border border-gray-200 text-base focus:ring-2 focus:ring-primary focus:border-primary`.

### Cards

- Background `card`, `borderRadius: lg`, padding `lg`, subtle shadow or 1px `border`.
- One primary idea per card. Clear heading (e.g. `headingSmall`) and body (`body`).

### Modals

- Overlay: semi-transparent dark (e.g. `rgba(0,0,0,0.4)`).
- Content: `card` background, `borderRadius: lg`, padding `lg`, max-width ~400px on mobile.
- Title at top, actions at bottom (primary CTA on the right or full-width stacked).
- Focus trap and close on Escape; first focusable element focused on open.

### Toasts

- Short message, `body` or `bodySmall`, background dark or `textPrimary` on light.
- Auto-dismiss 4–5s; optional “Undo” or “Dismiss” with adequate touch target.
- Position: bottom above nav (mobile) or top-right (desktop). No stacking more than 2–3.

### Loaders

- Prefer **skeleton** placeholders (grey blocks, subtle pulse) over spinners for list/card content.
- Spinner only for button loading or full-screen “Submitting…”.
- Always pair with text: “Loading…”, “Saving…”, “Sending…”.

### Empty states

- Illustration or icon (muted) + short heading + one CTA.  
  Example: “No upcoming visits” / “Request your first visit”.
- No blank screens; always explain and offer next step.

### Error states

- Inline: message below field in `error` color.
- Banner: full-width bar, `error` background, white text, “Dismiss” button (48px target).
- Copy: calm and actionable. “Something went wrong. Please try again.” not “Error 500”.

---

## Screen-by-screen specification

### 1. Login / Register

**Layout**

- Centered single column; max-width ~400px on larger screens.
- Logo or app name at top (headingLarge).
- Subtitle: one short, friendly line (e.g. “Care when you need it”).
- Form: Email, Password (and Confirm password on Register). Each input full-width, 48px height, label above.
- Role selection (Care Recipient / Caregiver): two large, equal-width buttons or cards—selected state clearly different (e.g. border + background tint).
- Primary CTA: “Log in” or “Create account”, full-width, 48px min height.
- Secondary link: “Forgot password?” or “Already have an account?” below.

**Hierarchy**

1. Brand  
2. Subtitle  
3. Role (if register)  
4. Fields  
5. Primary CTA  
6. Secondary link  

**Accessibility**

- All inputs: `accessibilityLabel`, `accessibilityHint` (e.g. “Required”).
- Role buttons: `accessibilityRole="radio"` or “button”, `accessibilityState` selected.
- Focus order: role → email → password → CTA → link.

**UX rationale**

- Large inputs and clear role reduce mistakes. Friendly tone lowers anxiety. Single column avoids confusion.

---

### 2. Dashboard

**Layout**

- **Welcome block:** “Hello, [Name]” (headingMedium). Short line under (e.g. “Here’s your overview”). Ample top padding.
- **Primary actions (3 big cards or buttons):**
  - Request Help (primary/secondary CTA)
  - Schedule Care
  - Emergency (accent/red, always visible)
- Each action: icon + label + optional one-line description. Min touch target 48px; entire card tappable.
- **Secondary:** Simple cards for “Upcoming visit”, “Recent activity”, or “Quick links”. No dense tables.

**Hierarchy**

1. Welcome  
2. Three main actions  
3. Optional cards (one idea per card)  

**Colors**

- Primary actions: primary or secondary.
- Emergency: accent or error, with “Emergency” text (not icon-only).

**Accessibility**

- Each action: `accessibilityRole="button"`, clear label and hint (e.g. “Request help from a caregiver”).
- Emergency: high contrast, clear label, no reliance on color alone.

**UX rationale**

- Warm welcome builds trust. Big actions mean no hunting. Zero clutter so focus stays on “what can I do?”.

---

### 3. Caregiver list

**Layout**

- One caregiver per **card**: photo (avatar), name, rating (stars + number), optional “Available today” badge.
- Per card: primary CTA “View profile” or “Select” (full-width or right-aligned, 48px height). Optional “Map” toggle at top (toggle or segmented control with “List” | “Map”).
- Cards stacked vertically with `md` or `lg` gap. No horizontal scroll of cards.

**Hierarchy**

1. Optional filter/toggle (List/Map)  
2. Card 1: avatar, name, rating, CTA  
3. Card 2: …  
4. Empty state if no results  

**Component styles**

- Card: white, rounded-lg, padding lg, border or shadow.
- Avatar: 56–64px, rounded-full.
- Name: headingSmall or body, weight semibold.
- Rating: stars + “4.8” (bodySmall, textSecondary).
- CTA: button primary or secondary, min height 48px.

**Accessibility**

- Card: `accessibilityRole="button"` if whole card is tappable, or separate “View profile” button with role button.
- Rating: `accessibilityLabel="Rated 4.8 out of 5"`.
- Map toggle: label “Show map” / “Show list”, role button or tab.

**UX rationale**

- Card layout is scannable. Photo + name + rating support trust. One clear CTA per card avoids confusion.

---

### 4. Slot selection

**Layout**

- **Date:** Date picker or simple “Today / Tomorrow / [Date]” tabs (large touch targets).
- **Slots:** Grid or vertical list. Each slot is one cell/row.
- **Free:** Background white or light green tint, border green or “Available” label, tappable.
- **Booked:** Grey background, disabled, “Booked” or “Unavailable” text. Not tappable.
- Use both **text and color**: e.g. “9:00 AM – Available” (green); “10:00 AM – Booked” (grey).
- Selected slot: clear selected state (e.g. ring + “Selected”).

**Hierarchy**

1. Date choice  
2. Slot list/grid (each slot same size, clear state)  
3. Bottom CTA: “Confirm time” (disabled until selection)  

**Accessibility**

- Each slot: `accessibilityRole="button"` or “radio”, `accessibilityLabel` (e.g. “9:00 AM, Available”), `accessibilityState` disabled/selected.
- Never “green” or “grey” only; always “Available” / “Booked” in label.

**UX rationale**

- Clear Free vs Booked reduces wrong taps. Text + color supports color-blind users and screen readers.

---

### 5. Booking confirmation

**Layout**

- **Summary card:** Service, date, time, caregiver name (if any). Short, scannable lines.
- **Reassurance line:** e.g. “You can cancel or reschedule from your schedule.”
- **Primary CTA:** “Confirm booking” (secondary/green), full-width, 48px.
- **Secondary:** “Edit” or “Back” to change details.

**Hierarchy**

1. Title: “Confirm booking”  
2. Summary card  
3. Reassurance text  
4. Confirm CTA  
5. Edit/Back  

**Accessibility**

- Summary: headings for each line or one `accessibilityLabel` summarizing content.
- Confirm: `accessibilityRole="button"`, hint “Confirms your booking”.

**UX rationale**

- Summary reduces anxiety. Reassurance text and clear Confirm support trust and completion.

---

### 6. Chat screen

**Layout**

- **Header:** Caregiver/recipient name, optional “Video call” button (icon + “Video” text).
- **Messages:** ScrollView; sent (e.g. right, primary tint); received (left, card/grey). Bubbles: padding md, borderRadius lg, max-width ~85%.
- **Input area:** One row: text input (min height 48px, multiline allowed) + **Send** button (icon + “Send” text, 48px). No icon-only send.
- **Emergency:** Persistent link or button (e.g. “Emergency” at top or bottom of chat). Visible, not hidden in menu.

**Hierarchy**

1. Header (name, video)  
2. Message list  
3. Input + Send  
4. Emergency entry point  

**Accessibility**

- Each message: `accessibilityLabel` with sender and content (e.g. “You: Hello”).
- Send: `accessibilityRole="button"`, label “Send message”.
- Emergency: `accessibilityRole="button"`, label “Emergency help”.

**UX rationale**

- Large input and clear Send reduce errors. Visible emergency supports stress situations. Bubbles and labels support screen readers.

---

### 7. Video call UI

**Layout**

- **Main area:** Remote video (full-width); local video as small overlay (e.g. corner).
- **Controls (bottom):** Large, horizontal row. Each control: icon + label (Mute, Camera, End). Min 48px touch target; spacing between.
- **Labels:** “Mute” / “Unmute”, “Camera on” / “Camera off”, “End call”. No tiny icon-only controls.

**Hierarchy**

1. Video content  
2. Control bar (same row or two rows if needed)  

**Accessibility**

- Each control: `accessibilityRole="button"`, `accessibilityLabel` and `accessibilityState` (e.g. pressed for mute).
- Focus order: Mute → Camera → End.

**UX rationale**

- Large controls and text labels prevent mis-taps and support low vision and stress.

---

### 8. Emergency screen

**Layout**

- **Minimal:** No nav, no extra links. Single-purpose.
- **Status line:** Short line (e.g. “Hold to send alert” or “Alert sent”).
- **Main control:** Large red (or accent) button: “SOS” or “Send emergency alert”. Min 120px size; press-and-hold or single tap with confirmation.
- **Feedback:** On send: immediate text (“Alert sent. Help is on the way.”) and optional progress or checkmark.
- **Secondary:** “Call 911” or “Call emergency contact” as a separate, clear button (not competing with main SOS).

**Hierarchy**

1. Short instruction or status  
2. Large SOS / Send alert  
3. Reassurance text after send  
4. Call 911 / emergency contact  

**Colors**

- Main button: error or accent; ensure contrast. Text “SOS” or “Send alert” on button.
- Background: neutral (e.g. background or slightly darker). No distracting imagery.

**Accessibility**

- Main button: `accessibilityRole="button"`, `accessibilityLabel` “Send emergency alert”, hint “Press and hold for 3 seconds” (if applicable).
- After send: live region or status announcement so screen reader gets “Alert sent”.

**UX rationale**

- High visual priority and minimal distractions get the right action fast. Immediate feedback and reassurance reduce panic.

---

### 9. Settings

**Layout**

- **Sections:** Grouped list. Section title (e.g. “Account”, “Preferences”, “Accessibility”, “Support”) in bodySmall, uppercase or caps, textSecondary, margin above group.
- **Rows:** One setting per row. Left: icon (optional) + label. Right: toggle, link, or value. Row min height 48px; whole row or control tappable.
- **Accessibility:** “Large text”, “High contrast” toggles near top of Preferences or in dedicated “Accessibility” section. Labels clear: “Large text”, “High contrast”.
- **Danger:** “Log out” or “Delete account” in own section, danger style (red text or button).

**Hierarchy**

1. Section title  
2. Rows (icon + label, control)  
3. Next section  
4. Danger zone at bottom  

**Accessibility**

- Each row: `accessibilityLabel` (e.g. “Large text”), `accessibilityRole` (button/switch), `accessibilityState` (checked for toggles).
- Toggles: `accessibilityRole="switch"`, label and hint.

**UX rationale**

- Simple list is predictable. Prominent accessibility options support diverse users. Danger actions separated and clearly labeled.

---

## Accessibility (non-negotiable)

- **Screen readers:** Every interactive element has `accessibilityLabel`; use `accessibilityHint` for non-obvious actions. Headings use `accessibilityRole="header"`.
- **Keyboard:** All actions focusable; visible focus ring (2px outline). Tab order follows visual order.
- **High contrast:** Settings option to switch to high-contrast palette (e.g. darker text, stronger borders). No removal of focus outline.
- **Large text:** Settings option to scale body/headings (e.g. 1.2×). Layout does not break (wrap, no truncation of critical text).
- **Focus indicators:** Clear 2px outline on focus; never `outline: none` without a visible alternative.
- **No color-only meaning:** Always pair color with text or icon (e.g. “Available”, “Booked”, “Error”).

---

## Responsiveness

- **360px (mobile):** Baseline. Single column, 16–24px horizontal padding, touch targets 48px, primary CTA visible without scroll where possible.
- **768px (tablet):** Same layout with optional max-width content (e.g. 600px) centered; more breathing room; no extra columns unless clearly beneficial.
- **1024px (desktop):** Optional two-column only where it adds clarity (e.g. list + detail). Primary flows remain one column. Enhancement only.

**Rule:** Mobile layout comes first. Desktop is enhancement.

---

## Micro-UX details

- **Confirmations:** Friendly, positive (e.g. “Booking confirmed. We’ll send you a reminder.”).
- **Errors:** Calm, actionable (e.g. “We couldn’t save. Check your connection and try again.”).
- **Loading:** Always pair with text (“Loading…”, “Saving…”, “Sending…”). Prefer skeletons for lists.
- **Layout:** Avoid sudden shifts; reserve space for images or use consistent placeholders.
- **Emergency:** Reassuring copy (“Help is on the way.”, “Your location was shared.”).

---

## Tailwind-friendly implementation

Use CSS variables or Tailwind theme to mirror the design system:

```css
/* Example theme extension */
--color-primary: #2563EB;
--color-secondary: #059669;
--color-accent: #F59E0B;
--color-error: #DC2626;
--color-background: #F8FAFC;
--color-card: #FFFFFF;
--color-text-primary: #1F2937;
--color-text-secondary: #6B7280;
--font-heading: 'Inter', 'Poppins', sans-serif;
--font-body: 'Open Sans', system-ui, sans-serif;
--min-touch: 48px;
--radius-md: 10px;
--radius-lg: 16px;
```

**Utility patterns**

- Buttons: `min-h-[48px] px-6 rounded-lg font-semibold text-base focus:ring-2 focus:ring-offset-2`.
- Inputs: `h-12 px-4 rounded-lg border border-gray-200 text-base focus:ring-2 focus:ring-primary`.
- Cards: `bg-white rounded-xl p-6 shadow-sm border border-gray-100`.
- Section spacing: `space-y-6` or `gap-6`; page padding: `px-4 py-6` (mobile).

---

## Final checklist

- [ ] All interactive elements ≥ 48px and have clear label (and hint where needed).
- [ ] No critical action is icon-only or hover-only.
- [ ] Every action has feedback (loading/success/error).
- [ ] High contrast and large text options in Settings and applied globally.
- [ ] Focus visible on all focusable elements.
- [ ] Slot/caregiver/status states use text + color, not color alone.
- [ ] Emergency screen is minimal, obvious, and reassuring.
- [ ] 360px layout is the designed baseline; 768/1024 are enhancements.

If a first-time elderly user can understand the screen in a few seconds, tap the right action without help, and feel calm instead of stressed, the design is successful.

---

## Implementation map (React Native / existing codebase)

Use the design system above with these existing assets:

| Spec concept | Where it lives |
|--------------|----------------|
| Colors, spacing, typography, a11y constants | `frontend/src/theme.ts` |
| Primary/secondary/danger buttons | `frontend/src/components/AppButton.tsx` (use `accessibilityLabel` / `accessibilityHint`) |
| Large text & high contrast | `frontend/src/context/AccessibilityContext.tsx` + `useThemeAccessibility` → `ThemeContext` |
| Screen layout (responsive, safe area) | `frontend/src/ScreenWithBottomNav.tsx` |
| Bottom nav (tabs) | `frontend/src/BottomNav.tsx` |

When building new screens or refining existing ones, align with this spec and the global UI rules (min 48px touch, no icon-only critical actions, feedback on every action, text + color for state).

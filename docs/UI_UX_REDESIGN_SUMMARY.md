# AssistLink UI/UX Redesign Summary

## Design Goals

- **Accessibility-first** (WCAG AA+)
- **Elderly & differently-abled friendly**
- **Calm, trustworthy, human-centric**
- **Minimal but powerful**
- **Production-ready UI/UX**

---

## Color System (Applied)

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | #2563EB | Main nav active, links, primary actions |
| Secondary | #059669 | Care actions, success states, CTAs |
| Accent | #F59E0B | Highlights, CTA emphasis |
| Background | #F8FAFC | Screen background |
| Card | #FFFFFF | Card surfaces |
| Text Primary | #1F2937 | Headings, body |
| Text Secondary | #6B7280 | Secondary text |

---

## What Changed

### 1. Global Theme (`theme.ts`)

- Added `layout` (screenPadding: 20, cardPadding, sectionGap)
- Added `shadows` (card, cardHover, button)
- Typography scale with `minBodySize: 16`
- `accessibility.minTouchTargetSize: 48`

### 2. Bottom Navigation

- Icons: 28px (was 22px)
- Tab height: 72px, min 48px touch targets
- Active state: primary blue pill (#2563EB)
- Labels: 12px, semiBold when active
- Improved contrast and hierarchy

### 3. Care Recipient Dashboard

- Header: Date label + greeting, larger type (26px heading)
- Quick actions: Card layout with 56px icon circles in colored backgrounds
- Spacing: `layout.screenPadding`, `layout.sectionGap`, `layout.cardGap`
- Cards: `borderRadius.lg`, `shadows.card`
- Request button: `minHeight: 56`, `shadows.button`
- Consistent background `#F8FAFC`

### 4. New Request Screen (Care Request Forms)

- Tab indicator: primary (blue) for Exam, secondary (green) for Daily, error (red) for Urgent
- Uses theme colors throughout
- Layout padding via `layout.screenPadding`

### 5. Matchmaking (Caregiver List)

- Background: `colors.background`
- Fast Match card: `shadows.card`, 48px touch target on Auto-Assign
- Caregiver cards: `borderRadius.lg`, `shadows.card`, improved spacing
- Filter chips: secondary accent when active

### 6. Chat UI

- Theme colors for sent/received bubbles
- `colors.secondary` for sent bubble
- `colors.card` for received bubble

### 7. Emergency Screen

- Uses theme `colors` for error, secondary, primary
- Keeps dark mode for focus; uses shared color tokens

### 8. Settings & Profile

- Theme-driven via `useTheme()`
- ProfileScreen: design tokens (colors, typography)
- Settings items: `minHeight: 52`, spacing from theme

---

## New Component

- **`Card.tsx`** — Reusable card with padding, elevation, optional `onPress`

---

## Layout Conventions

- **Screen padding:** 20px (`layout.screenPadding`)
- **Section gap:** 24px (`layout.sectionGap`)
- **Card gap:** 16px (`layout.cardGap`)
- **Min touch target:** 48px
- **Min font size:** 16px body

---

## Typography Hierarchy

- **H1 (headingLarge):** 26px
- **H2 (headingMedium):** 20px
- **H3 (headingSmall):** 18px
- **Body:** 16px
- **Caption:** 12–14px

---

## Accessibility

- 48px minimum touch targets
- 16px minimum body font size
- High-contrast text (WCAG AA)
- `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` on interactive elements
- Large Text and High Contrast modes supported via ThemeContext

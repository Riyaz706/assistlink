# Map accessibility (AssistLink PWA)

## Principles

- **No hover-only interactions.** All actions (e.g. open info window) are available via click/tap and keyboard.
- **Info windows are readable.** Sufficient contrast, font size, and padding.
- **Clear text and icons.** Markers have titles; list/map toggle uses visible labels and `aria-selected`.
- **No essential action depends on the map.** Booking and emergency flows work if the map fails or is unavailable.

## Map component

- **Container:** `role="application"` and `aria-label` from prop so screen readers describe the region.
- **Loading:** `role="status"` and `aria-label="Map loading"`.
- **Fallback:** `role="status"` or `role="alert"` (on error), `aria-live="polite"`.
- **Markers:** Each marker is `clickable`; focusable and activatable by keyboard. `title` is used for tooltip and accessibility.
- **Info windows:** Content is in the DOM with semantic structure (`<p>`, headings). Close button is focusable and clickable.

## Screens

- **Caregiver Matching:** Toggle is a tablist (`role="tablist"`); tabs have `aria-selected` and `aria-controls="content"`. Panel has `role="tabpanel"`.
- **Booking:** Message states that booking can be completed without the map.
- **Emergency:** Primary action is "Call emergency services" (link). Text states that location was shared even if the map did not load.

## Testing

- Use tab to move focus to list/map toggle, then to map area; ensure marker focus and info window open/close work.
- With map failed or API key missing, confirm all screens still allow list view, booking submit, and emergency call.

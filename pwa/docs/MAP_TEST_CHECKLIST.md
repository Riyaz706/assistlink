# Manual test checklist – Map (view-only)

Use this when verifying the Google Maps integration. The map must never block app flow.

## Environment

- [ ] `.env` has `VITE_GOOGLE_MAPS_API_KEY` set (or leave empty to test fallback).
- [ ] `npm run dev` runs without errors.
- [ ] `npm run build` succeeds.

## Caregiver Matching screen

- [ ] List view shows caregiver list.
- [ ] Switching to Map view shows map (or fallback if no key / load error).
- [ ] Map shows user marker and caregiver markers when data is present.
- [ ] Clicking a marker opens info window with name/subtitle.
- [ ] Closing info window works (click close or outside).
- [ ] Pan and zoom work; no other map interaction required for the flow.
- [ ] Resize window; map container is responsive and usable on mobile width.

## Booking screen

- [ ] Read-only map shows highlight position (or fallback).
- [ ] Message is visible: booking can be completed without the map.
- [ ] With API key invalid or network error, fallback is shown and page is still usable.

## Emergency screen

- [ ] Map shows user location (and optional responder marker).
- [ ] "Call emergency services" link is visible and works (e.g. `tel:`).
- [ ] Text states that location was shared even if map did not load.
- [ ] With map failed, no blocking overlay; user can still call.

## Failure handling

- [ ] Remove or invalidate `VITE_GOOGLE_MAPS_API_KEY`; fallback message appears, no crash.
- [ ] Throttle network (e.g. Offline in DevTools); after load failure, fallback appears.
- [ ] In all three screens, primary actions (list, booking, call) remain available when map fails.

## Accessibility (quick pass)

- [ ] Tab through Matching screen: list/map tabs and map area receive focus.
- [ ] Open a marker info window via keyboard (Enter/Space on marker if focusable).
- [ ] Screen reader: map region and fallback/loading announced appropriately.

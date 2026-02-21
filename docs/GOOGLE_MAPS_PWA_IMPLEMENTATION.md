# Google Maps PWA – Production implementation summary

## 1. Folder structure

```
pwa/
├── public/
├── src/
│   ├── components/
│   │   └── Map/
│   │       ├── AssistLinkMapView.tsx   # Core: load, markers, info window, fallback
│   │       ├── MapFallback.tsx         # Shown when map fails (never block app)
│   │       ├── MapLoading.tsx         # Loading state
│   │       ├── constants.ts           # Zoom, fallback center, min height
│   │       └── index.tsx              # AssistLinkMap – wires env API key
│   ├── screens/
│   │   ├── CaregiverMatchingScreen.tsx # List / map toggle; nearby caregivers
│   │   ├── BookingLocationScreen.tsx  # Read-only location preview
│   │   └── EmergencyScreen.tsx        # User + optional responder; high priority
│   ├── types/
│   │   └── map.ts                     # MapCoordinate, CaregiverMarker, MapViewProps, MapMarker
│   ├── App.tsx                        # Root app component, routes to map screens
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── docs/
│   ├── ACCESSIBILITY.md
│   └── MAP_TEST_CHECKLIST.md
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 2. Reusable Map component

- **Entry:** `src/components/Map/index.tsx` – exports `AssistLinkMap`, which reads `VITE_GOOGLE_MAPS_API_KEY` from env and renders `AssistLinkMapView`.
- **Core:** `AssistLinkMapView.tsx` – uses `@react-google-maps/api` (`useJsApiLoader`, `GoogleMap`, `Marker`, `InfoWindow`). View-only: pan/zoom and marker click → info window. No distance/routing logic.
- **States:** Loading (`MapLoading`), error/missing key (`MapFallback`). On failure, a clear message is shown and the rest of the app remains usable.
- **Props:** `userPosition`, `caregivers[]`, `highlightPosition?`, `defaultCenter?`, `defaultZoom?`, `mode?: 'default' | 'emergency'`, `ariaLabel?`, `className?`. No hardcoded coordinates for business logic.

## 3. Screen-level usage

| Screen | Use |
|--------|-----|
| **Caregiver Matching** | Toggle list/map; map shows user + multiple caregivers; marker click → info window. |
| **Booking** | Read-only map with `highlightPosition`; message that booking works without the map. |
| **Emergency** | User + optional responder; `mode="emergency"`; primary CTA = call; text states location shared even if map fails. |

## 4. Environment variable setup

- In `pwa/`, create `.env` with:
  - `VITE_GOOGLE_MAPS_API_KEY=<your_key>`
- Copy from `.env.example`. If key is missing or invalid, map shows fallback; app and all primary actions still work.

## 5. Accessibility notes

- No hover-only interactions; marker info opens on click/tap (keyboard activatable).
- Map container has `role="application"` and configurable `aria-label`.
- Loading/fallback use `role="status"` / `role="alert"` and `aria-live="polite"`.
- List/map toggle is a tablist with `aria-selected` and `aria-controls`.
- Info window content is readable (contrast, structure). No critical action depends on map interaction.
- Details: `pwa/docs/ACCESSIBILITY.md`.

## 6. Manual test checklist

- See `pwa/docs/MAP_TEST_CHECKLIST.md`. Covers: env, Matching (list/map, markers, info window), Booking (read-only, message), Emergency (user/responder, call link), failure handling (no key, network error), and a short a11y pass.

---

**Rule:** The map must never be a point of failure. If it breaks, the app must still save lives; booking and emergency flows do not depend on the map loading.

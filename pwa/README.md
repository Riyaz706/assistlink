# AssistLink PWA – Google Maps (view-only)

Vite + React + Tailwind PWA with a **view-only** Google Maps integration. For elderly and differently-abled users; stability and accessibility are mandatory.

## Folder structure

```
pwa/
├── public/
├── src/
│   ├── components/
│   │   └── Map/
│   │       ├── AssistLinkMapView.tsx   # Core map (load, markers, info window)
│   │       ├── MapFallback.tsx         # Shown when map fails
│   │       ├── MapLoading.tsx          # Loading state
│   │       ├── constants.ts
│   │       └── index.tsx               # AssistLinkMap (wires env API key)
│   ├── screens/
│   │   ├── CaregiverMatchingScreen.tsx # List / map toggle, nearby caregivers
│   │   ├── BookingLocationScreen.tsx  # Read-only location preview
│   │   └── EmergencyScreen.tsx         # User + optional responder
│   ├── types/
│   │   └── map.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
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

## Environment variable

Create `.env` in `pwa/`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_js_api_key
```

- Get a key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials); enable **Maps JavaScript API**.
- If the key is missing or invalid, the map shows a **fallback message** and the app continues to work (booking and emergency flows are not blocked).

## Commands

```bash
cd pwa
npm install
npm run dev    # http://localhost:5173
npm run build
npm run preview
```

## Map behavior

- **View-only:** Pan/zoom and marker click for info window. No routing, distance, or business logic in the map.
- **Failure:** On load error or missing key, a clear message is shown; no crash and no blocking of primary actions.
- **Accessibility:** No hover-only actions; info windows and tabs are keyboard and screen-reader friendly. See `docs/ACCESSIBILITY.md`.
- **Testing:** See `docs/MAP_TEST_CHECKLIST.md`.

## Rule

**If the map breaks, the app must still save lives.** All critical actions (booking, emergency call, list view) work without the map.

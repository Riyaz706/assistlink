# Building the AssistLink APK (Video Call + Payments)

This guide explains how to build an **Android APK** for AssistLink with **video calls** and **payments** enabled.

---

## What to use

- **Build system:** **Expo EAS Build** (recommended) or local **`expo run:android`**
- **Video calls:** **Twilio Video** — already in the app via `react-native-twilio-video-webrtc`. Works in **development/production builds** (not in Expo Go).
- **Payments:** **Razorpay** — backend is ready; the app uses **react-native-razorpay** for real checkout in the APK.

---

## Prerequisites

1. **Node.js** (v18+) and **npm** or **yarn**
2. **Expo CLI / EAS CLI:**  
   `npm install -g eas-cli`  
   Log in: `eas login`
3. **Backend:** Deploy your backend (e.g. Render) and set `EXPO_PUBLIC_API_BASE_URL` in build env.
4. **Twilio** (video): Account + credentials in backend `.env` for `/api/communications/video/token`.
5. **Razorpay** (payments): Key ID + Secret in backend `.env`; Key ID in app (e.g. `EXPO_PUBLIC_RAZORPAY_KEY_ID`) for the Razorpay SDK.

---

## 1. Build the APK with EAS Build (recommended)

Your project already has `eas.json` with **preview** and **production** profiles set to output **APK** for Android.

### One-time setup

```bash
cd frontend
npm install
eas login
```

### Build APK

**Preview (testing):**
```bash
cd frontend
eas build --platform android --profile preview
```

**Production:**
```bash
eas build --platform android --profile production
```

- Build runs in the cloud. When it finishes, EAS gives you a **download link** for the **APK**.
- **Video calls** work in this build because it includes the native Twilio module (not Expo Go).
- **Payments** work when Razorpay is configured (see below).

### Optional: build locally

If you prefer a local build:

```bash
cd frontend
npx expo prebuild
npx expo run:android
```

APK output is under `frontend/android/app/build/outputs/apk/`.

---

## 2. Video calls

- **Implementation:** `VideoCallScreen` uses **Twilio** (`react-native-twilio-video-webrtc`). The backend provides tokens via `/api/communications/video/token`.
- **Expo Go:** Video is **not** supported in Expo Go; the screen shows a “use dev build” message.
- **APK / dev build:** Video is **supported**. Ensure:
  - Backend has Twilio credentials set (e.g. `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`).
  - App has camera/microphone permissions (already in `app.config.js`).

No extra steps are needed for video in the APK beyond building with EAS or `expo run:android`.

---

## 3. Payments (Razorpay)

### Backend

- **Razorpay** is already integrated in `backend/app/routers/payments.py`.
- Set in backend `.env`:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
- Endpoints: `POST /api/payments/create-order`, `POST /api/payments/verify`.

### Frontend (APK)

- The app uses **react-native-razorpay** for real checkout.
- For production builds, set in EAS env or `.env`:
  - `EXPO_PUBLIC_RAZORPAY_KEY_ID` (same as backend Key ID; used by the SDK).
- If Razorpay is not configured, the app can still use the existing bypass/mock flow for testing.

### Testing payments

- Use Razorpay **test keys** and test cards from [Razorpay Docs](https://razorpay.com/docs/payments/payment-gateway/test-card-details/).
- For real money, switch to **live keys** and comply with Razorpay’s go-live checklist.

---

## 4. Summary

| Need            | Solution                          |
|-----------------|-----------------------------------|
| **Build APK**   | `eas build --platform android --profile preview` or `production` |
| **Video calls** | Twilio already in app; works in APK when backend has Twilio configured |
| **Payments**    | Razorpay in backend + `react-native-razorpay` in app; set Key ID in app env |

After the EAS build completes, download the APK from the link provided and install it on a device or share it for testing.

# Run backend + two emulators with APK

## 1. Backend (already started)

Backend is running at **http://0.0.0.0:8000**. To start it again later:

```bash
cd backend
source venv/bin/activate   # if you use a venv
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Ensure `frontend/.env` has your machine’s LAN IP (e.g. `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.9:8000`) so emulators can reach the backend.

---

## 2. Two emulators with the APK

### A. Start both emulators first

1. Open **Android Studio** → **Device Manager** (Tools → Device Manager).
2. Start **Emulator 1** (click ▶ on first AVD).
3. Start **Emulator 2** (click ▶ on second AVD).  
   If you only have one AVD, create another: **Create Device** (e.g. Pixel 6 and Pixel 7).

### B. Build and run the app on both (APK is built automatically)

**First device:**

```bash
cd frontend
npm install   # first time only
npx expo run:android
```

When prompted, pick the first emulator (or it will use the only one connected). This builds the debug APK and installs the app.

**Second device:**

With both emulators running:

```bash
npx expo run:android --device
```

When prompted, select the **second** emulator. The same build is installed on that device.

### C. Optional: install existing APK on second emulator

If you already built once and have the APK:

```bash
adb devices
# Install on second emulator (use its id, e.g. emulator-5556)
adb -s emulator-5556 install android/app/build/outputs/apk/debug/app-debug.apk
```

APK path after a local build: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`  
(You need to run `npx expo prebuild` and then `npx expo run:android` once to generate the `android/` folder and this APK.)

---

## 3. Quick checklist

- [ ] Backend: `http://0.0.0.0:8000` (or your LAN IP for the app)
- [ ] `frontend/.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000`
- [ ] Two emulators running (Device Manager)
- [ ] App on both: run `npx expo run:android` then `npx expo run:android --device` and pick the second
- [ ] Use two accounts (e.g. care recipient on one, caregiver on the other) to test flows

---

## 4. Useful commands

```bash
# List connected devices/emulators
adb devices

# Run on a specific device
npx expo run:android --device <device_id>
```

For more detail: `docs/TEST_TWO_EMULATORS.md`, `docs/RUN_STEPS.md`.

---

## 5. One emulator + one physical device

Same backend and `.env` as above. **Physical device must be on the same Wi‑Fi as your computer** (so it can reach the LAN IP).

### A. Prepare the physical device

1. **Enable Developer options** on the phone: Settings → About phone → tap **Build number** 7 times.
2. **Enable USB debugging**: Settings → Developer options → **USB debugging** ON.
3. Connect the phone via **USB** (or use [wireless debugging](https://developer.android.com/studio/command-line/adb#wireless) if you prefer).
4. On the phone, accept the “Allow USB debugging?” prompt and optionally check “Always allow from this computer”.

### B. Run app on emulator first

1. Start **one** emulator from Android Studio (Device Manager → ▶).
2. In terminal:
   ```bash
   cd frontend
   npx expo run:android
   ```
   When prompted, pick the **emulator**. The app installs and runs there.

### C. Run app on the physical device

With the phone connected and the emulator still running (or not—either is fine):

```bash
npx expo run:android --device
```

When prompted, select your **physical device** (it will show up with a name or model, e.g. `ABC123` or `Pixel 6`). The same build is installed on the phone.

### D. Check both can reach the backend

- **`frontend/.env`:** `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000` (your machine’s Wi‑Fi IP).
- Backend: `uvicorn ... --host 0.0.0.0 --port 8000`.
- In the app on **each** device: **Settings → Connection → Test connection** should show “Connection OK”.

Use one account on the emulator (e.g. care recipient) and another on the phone (e.g. caregiver) to test flows between the two.

**If you see `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (signatures do not match):** The phone has an older build of the app (e.g. from Play Store or another machine). Uninstall it first, then install again:

```bash
# Replace ef13f485 with your device id from `adb devices`
adb -s ef13f485 uninstall com.assistlink.app
```

Then run `npx expo run:android --device` again and pick the phone. Or on the phone: Settings → Apps → AssistLink → Uninstall.

**If the app shows "Network request failed" or login can't reach the backend:** The device cannot reach `http://YOUR_LAN_IP:8000`. Check: (1) Backend is running with `--host 0.0.0.0`. (2) Phone and computer are on the **same Wi‑Fi** (not mobile data, not guest network). (3) On the computer, `curl http://YOUR_LAN_IP:8000/health` works. (4) Mac firewall: allow incoming TCP on port 8000 or temporarily turn off to test. (5) If your LAN IP changed, update `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env`, restart Metro, and reload the app. See `docs/POINT_APP_TO_YOUR_MACHINE.md`.

**If you see `INSTALL_FAILED_USER_RESTRICTED` (Install canceled by user):** The phone is blocking installs via USB. 1) When you run the command, **watch the phone** — tap **Allow** (or **OK**) on any “Install via USB?” or “Allow from this computer?” prompt. 2) In **Settings → Developer options**, turn on **Install via USB** (or **USB debugging (Security settings)** on some brands). 3) Keep the screen **unlocked** during install. Then run `npx expo run:android --device` again.

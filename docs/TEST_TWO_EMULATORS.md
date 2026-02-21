# Testing the App with Two Emulators

Use two emulators to test flows between two users (e.g. care recipient and caregiver): login, bookings, chat, notifications, etc.

---

## 1. Start the backend (once)

On your **host machine**, start the API so both emulators can reach it:

```bash
cd backend
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Keep this terminal open. **Do not use localhost for the app.** Set `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` to your machine's **LAN IP** (e.g. `http://192.168.1.5:8000`) so both emulators can reach the backend. See [NETWORK_RULES.md](NETWORK_RULES.md).

---

## 2. Create two Android emulators (if needed)

1. Open **Android Studio** → **Device Manager** (or **Tools** → **Device Manager**).
2. Click **Create Device** and add a second AVD (e.g. "Pixel 6" and "Pixel 7").
3. Use the same or different API levels; ensure both have **Google APIs** if you use Google sign-in.

---

## 3. Run the app on both emulators

**Option A – From one terminal (run two devices in parallel)**

```bash
cd frontend
npx expo run:android --device
```

When prompted, pick the first emulator. After the app is installed and running, start a **second** emulator from Android Studio (AVD Manager → ▶ on another device), then:

```bash
npx expo run:android --device
```

Choose the second emulator. You now have the app on two emulators.

**Option B – Start both emulators first, then run**

1. In Android Studio Device Manager, **Launch** (▶) **Emulator 1**.
2. **Launch** **Emulator 2** (second AVD).
3. In terminal:

   ```bash
   cd frontend
   npx expo run:android
   ```

   Expo/React Native usually targets the first connected device. To target the second:

   ```bash
   adb devices
   npx expo run:android --device
   ```

   Select the device when asked, or use:

   ```bash
   npx expo run:android --device <device_id>
   ```

   (`device_id` is from `adb devices`, e.g. `emulator-5554` or `emulator-5556`.)

**Option C – Two terminals, two devices**

- Terminal 1: start Emulator 1, then `npx expo run:android` (uses that device).
- Terminal 2: start Emulator 2, then `npx expo run:android --device` and pick Emulator 2.

---

## 4. Use two different user accounts

Each emulator should use a **different account** so you can test interactions:

| Emulator 1              | Emulator 2              |
|-------------------------|-------------------------|
| **Care recipient**      | **Caregiver**           |
| e.g. `recipient@test.com` | e.g. `caregiver@test.com` |
| Register or login       | Register or login       |

Create both accounts in the app (Register) or ensure they exist in your backend/DB, then:

- **Emulator 1:** Login as care recipient.
- **Emulator 2:** Login as caregiver.

Now you can test: booking requests, accept/decline, chat, notifications, video calls, etc., between the two users.

---

## 5. Quick checklist

- [ ] Backend running: `uvicorn ... --host 0.0.0.0 --port 8000`
- [ ] Frontend `.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000` (e.g. `http://192.168.1.5:8000`). Never use localhost for multi-device testing.
- [ ] Two emulators running (see Device Manager)
- [ ] App installed on both (run `npx expo run:android` and select each device if needed)
- [ ] Two different accounts: one care recipient, one caregiver
- [ ] Optional: **Settings → Connection → Test connection** on each emulator to confirm backend reachability

---

## 6. Troubleshooting

| Issue | What to do |
|-------|------------|
| Second emulator not listed | Run `adb devices` and start the second AVD from Device Manager, then run `npx expo run:android --device` and pick it. |
| "No devices" | Start at least one emulator from Android Studio first, then run the app. |
| App on only one emulator | Run `npx expo run:android --device` again and choose the other device; the build will install on that emulator too. |
| Backend unreachable | On each emulator, open app → **Settings → Connection** and tap **Test connection**. Should show "Connection OK" if backend is running on host. |
| Same user on both | Log out on one emulator (Settings or profile) and log in with the other account. |
| Need fresh state | On an emulator: **Settings → clear app data**, or uninstall the app and run `npx expo run:android` again for that device. |

---

## 7. Optional: ADB commands

```bash
# List running devices/emulators
adb devices

# Install app on a specific device (after building)
adb -s emulator-5556 install android/app/build/outputs/apk/debug/app-debug.apk

# Clear app data on a specific emulator (replace with your package name)
adb -s emulator-5556 shell pm clear com.assistlink.app
```

Use this to quickly switch devices or reset one emulator’s app data while testing with two emulators.

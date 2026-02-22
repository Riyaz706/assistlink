# Connect wirelessly (phone ↔ backend on your computer)

Use this when running the app on a **physical device** over Wi‑Fi so it talks to your backend without a USB cable.

---

## Quick steps

### 1. Same Wi‑Fi

- **Phone** and **computer** must be on the **same Wi‑Fi network** (not guest network).
- If your IP changes later, see [Update your IP](#update-your-ip) below.

### 2. Backend reachable on the network

Start the backend so it accepts connections from the LAN (not only localhost):

```bash
cd backend
# Use 0.0.0.0 so the server listens on all interfaces (required for wireless)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or if you use a run script, ensure it uses `--host 0.0.0.0`.

Check from your computer:

```bash
curl http://192.168.1.21:8000/health
```

You should get a JSON response. If that works, the backend is reachable at your LAN IP.

### 3. Frontend .env (already set for wireless)

Your `frontend/.env` should point to your computer’s **LAN IP** (not localhost):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.21:8000
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.21
```

- `EXPO_PUBLIC_API_BASE_URL` – backend URL the app will use.
- `REACT_NATIVE_PACKAGER_HOSTNAME` – so the device loads the JS bundle from your computer over Wi‑Fi.

If your IP is different (e.g. 192.168.1.10), replace `192.168.1.21` with your IP in both lines. See [Find your LAN IP](#find-your-lan-ip) below.

### 4. Start Expo (LAN)

```bash
cd frontend
npx expo start
```

- When the QR code appears, **scan it with your phone** (Expo Go or dev client).
- The app will load the bundle over Wi‑Fi (no USB needed).
- The app will call the backend using `EXPO_PUBLIC_API_BASE_URL` (your LAN IP:8000).

### 5. Verify in the app

1. Open the app on the phone.
2. Go to **Settings**.
3. Under **Backend URL**, confirm it shows `http://192.168.1.21:8000` (or your IP).
4. Tap **Test connection**. It should say **Connection OK**.

If it fails, see [Troubleshooting](#troubleshooting) below.

---

## Find your LAN IP

**Mac (Wi‑Fi):**
```bash
ipconfig getifaddr en0
```

**Mac (if en0 is not Wi‑Fi):**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```
Use the `inet` address of the interface that is on the same network as your phone (e.g. `en0` for Wi‑Fi).

**Windows:** Run `ipconfig` and use the **IPv4 Address** of your Wi‑Fi adapter.

---

## Update your IP

If your router gives your computer a new IP (e.g. after reboot):

1. **Option A – .env (then restart Expo)**  
   - Run `ipconfig getifaddr en0` (Mac) or check `ipconfig` (Windows).  
   - Edit `frontend/.env`: set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000` and `REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_IP`.  
   - Restart Expo (`npx expo start`).

2. **Option B – In the app (no restart)**  
   - Open **Settings** → **Backend URL**.  
   - Enter `http://YOUR_IP:8000`, tap **Save URL**, then **Test connection**.

---

## Troubleshooting

| Issue | What to do |
|--------|-------------|
| **“Connection failed” or timeout** | 1) Backend running with `--host 0.0.0.0`. 2) Phone and computer on same Wi‑Fi. 3) Correct LAN IP in .env or Settings. 4) Try opening `http://YOUR_IP:8000/health` in the phone’s browser – if it fails, the phone can’t reach your machine. |
| **App won’t load (Metro)** | 1) Same Wi‑Fi. 2) `REACT_NATIVE_PACKAGER_HOSTNAME` in .env = your LAN IP. 3) Restart Expo. 4) In Expo dev menu, try “Reload”. |
| **Firewall** | Allow inbound TCP port **8000** (backend) on your computer for the local network. |
| **Wrong IP** | VPN or multiple adapters can give the wrong IP. Use the IP of the adapter on the same network as the phone; disable VPN to test. |

---

## Summary

1. Phone and computer on **same Wi‑Fi**.
2. Backend: `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
3. `frontend/.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000` and `REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_LAN_IP`.
4. Run `npx expo start` in `frontend`, scan QR code with phone.
5. In app: **Settings → Test connection** to confirm.

For more detail (other OS, firewall, etc.) see **POINT_APP_TO_YOUR_MACHINE.md**.

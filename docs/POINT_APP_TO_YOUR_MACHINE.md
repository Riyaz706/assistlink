# Point the app to your machine (detailed)

When the backend runs on your computer, the app (on an emulator or phone) cannot use `localhost` or `127.0.0.1` because that means “this device.” On the phone/emulator, “this device” is the phone/emulator, not your computer. So the app must use your computer’s **LAN IP address** — the address of your machine on your local Wi‑Fi or Ethernet network.

---

## 1. Why use the LAN IP?

| URL | Who can reach it |
|-----|-------------------|
| `http://localhost:8000` or `http://127.0.0.1:8000` | Only the machine where the backend is running (your computer). The app on a phone or emulator **cannot** use this. |
| `http://192.168.1.5:8000` (example LAN IP) | Any device on the same Wi‑Fi/Ethernet network (your computer, phone, emulator). |

So for the app to talk to your backend, you set:

```text
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000
```

where `YOUR_LAN_IP` is your computer’s IP on the same network as the phone/emulator.

---

## 2. Find your LAN IP

Use the interface that is actually connected to the same network as your phone/emulator (usually Wi‑Fi).

### macOS

1. Open **Terminal**.
2. Run:
   ```bash
   ifconfig
   ```
3. Find the section for your active connection:
   - **Wi‑Fi:** often `en0`.
   - **Ethernet:** often `en1` or similar.
4. Look for a line like:
   ```text
   inet 192.168.1.5 netmask 0xffffff00 broadcast 192.168.1.255
   ```
   The **LAN IP** is the number after `inet` (e.g. `192.168.1.5`). Ignore `127.0.0.1` (loopback).

**One-liner (Wi‑Fi on Mac):**
```bash
ipconfig getifaddr en0
```
If you use Ethernet, try `en1` or check `ifconfig` for the right interface name.

---

### Linux

1. Open a terminal.
2. Run one of:
   ```bash
   ip addr
   # or
   ifconfig
   ```
3. Find the interface that has an address:
   - **Wi‑Fi:** often `wlan0`.
   - **Ethernet:** often `eth0` or `enp...`.
4. Note the `inet` address (e.g. `192.168.1.5`). Again, ignore `127.0.0.1`.

**One-liner (first non-loopback IPv4):**
```bash
hostname -I | awk '{print $1}'
```
Or for a specific interface, e.g. Wi‑Fi:
```bash
ip -4 addr show wlan0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```

---

### Windows

1. Open **Command Prompt** or **PowerShell**.
2. Run:
   ```cmd
   ipconfig
   ```
3. Find the section for the adapter you use for the same network as your phone:
   - **Wi‑Fi:** “Wireless LAN adapter Wi-Fi” or “WLAN”.
   - **Ethernet:** “Ethernet adapter Ethernet”.
4. Note **IPv4 Address**, e.g. `192.168.1.5`. That is your LAN IP.

**In PowerShell (first IPv4 that is not loopback):**
```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' } | Select-Object -First 1).IPAddress
```

---

## 3. Set it in `frontend/.env`

1. Open the file **`frontend/.env`** in your project (same folder as `package.json`).
2. Find the line that sets the API URL. It might look like:
   ```env
   EXPO_PUBLIC_API_BASE_URL=https://assistlink-backend.onrender.com
   ```
3. Change it to use your LAN IP and port `8000` (no trailing slash):
   ```env
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.5:8000
   ```
   Replace `192.168.1.5` with the IP you found in step 2.

**Example for a different IP:**
```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.0.12:8000
```

Rules:

- Use **`http://`** for local backend (or **`https://`** only if you really have TLS on your machine).
- Use the **exact IP** from `ifconfig` / `ipconfig` (e.g. `192.168.1.5` or `10.0.0.12`).
- Port must match your backend (default **`8000`**).
- **Do not** use `localhost`, `127.0.0.1`, or `10.0.2.2` here.
- No space around `=` and no quotes needed:
  ```env
  EXPO_PUBLIC_API_BASE_URL=http://192.168.1.5:8000
  ```

4. Save the file.

---

## 4. Apply the change

- **Expo dev server:** Restart it so it picks up the new env:
  - Stop the current process (Ctrl+C).
  - Run again: `npm start` or `npx expo start`.
- **Already running app:** Reload the app (e.g. shake device → Reload, or press `r` in the Expo terminal). For a full guarantee, restart Expo as above.

---

## 5. Verify

### From your computer (backend must be running)

```bash
# Replace with your LAN IP and port
curl http://192.168.1.5:8000/health
```

You should get a JSON response (e.g. `{"status":"ok",...}`). If that works, the backend is reachable at that URL.

### From the app

1. Open the app (emulator or phone).
2. Go to **Settings** (or **Profile → Settings**).
3. Find **Connection** / **Backend URL** / **Test connection**.
4. Tap **Test connection**.  
   It should say the backend is reachable. If it fails, see troubleshooting below.

---

## 6. Troubleshooting

| Problem | What to check |
|--------|----------------|
| **“Connection failed” or timeout in app** | 1) Backend is running: `uvicorn app.main:app --host 0.0.0.0 --port 8000`. 2) Phone/emulator and computer are on the **same Wi‑Fi** (not guest network). 3) You used the **LAN IP** from the interface that is on that same network (e.g. `en0` on Mac for Wi‑Fi). 4) No typo in IP or port in `.env`. |
| **Wrong IP** | You may have several interfaces (e.g. Wi‑Fi and Ethernet or VPN). Use the IP of the adapter that is on the same network as the phone. Disable VPN temporarily to test. |
| **Request timeout (e.g. /api/caregivers)** | 1) Backend running: `cd backend && python run.py` (must use `--host 0.0.0.0`). 2) Firewall: allow inbound TCP port 8000. 3) Same Wi-Fi for phone and computer. 4) Test: `curl http://YOUR_LAN_IP:8000/health` from computer; open same URL in phone browser — if phone times out, device cannot reach your machine. |
| **Firewall** | Your OS or security software may block port 8000. Allow inbound TCP on port 8000 for your local network (or temporarily disable firewall to test). |
| **IP changed** | Home routers often give a new IP after a reboot. If the app stops connecting, run `ifconfig` / `ipconfig` again and update `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env`, then restart Expo. |
| **Android emulator** | Prefer using the same LAN IP as above so emulator and real device behave the same. Do **not** rely on `10.0.2.2` in the app; the app should use the single shared URL (LAN IP or production). |

---

## 7. Summary

1. **Find LAN IP:** `ifconfig` (Mac/Linux) or `ipconfig` (Windows); use the IPv4 address of the interface on the same network as the app (e.g. Wi‑Fi).
2. **Edit `frontend/.env`:** Set  
   `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000`  
   (no localhost, no 127.0.0.1, no 10.0.2.2).
3. **Restart Expo** (and reload the app if needed).
4. **Check:** `curl http://YOUR_LAN_IP:8000/health` and **Settings → Test connection** in the app.

After this, the app is pointed at your machine’s backend using your LAN IP.

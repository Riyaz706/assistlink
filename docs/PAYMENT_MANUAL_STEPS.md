# Payment setup – manual steps

Follow these steps in order to enable and test payments in AssistLink.

---

## 1. Database (Supabase)

### 1.1 Open Supabase SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project (`kpuspxawxrbajzevzwmp` or your project ref).
3. In the left sidebar, click **SQL Editor**.

### 1.2 Add payment columns (first time only)

1. Open this file in your project:  
   `backend/database/migrations/add_payment_fields.sql`
2. Copy **all** of its contents.
3. In Supabase SQL Editor, paste and click **Run**.
4. Confirm it runs without errors (e.g. “Success. No rows returned”).

### 1.3 Allow `payment_status = 'captured'` (if you ran an older migration)

Only if you had run the payment migration **before** `captured` was added to the CHECK:

1. Open:  
   `backend/database/migrations/fix_payment_status_captured.sql`
2. Copy all of its contents.
3. In Supabase SQL Editor, paste and click **Run**.

---

## 2. Backend

### 2.1 Go to backend folder

```bash
cd backend
```

### 2.2 Configure payment in `.env`

Edit `backend/.env`.

***Option A – Testing without real payment (bypass)**

- Set:
  ```env
  RAZORPAY_BYPASS_MODE=true
  ```
- You can leave `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` empty.
- “Pay Now” will confirm the booking and enable chat without opening Razorpay.

**Option B – Real Razorpay (test/live)**

1. Get keys from [Razorpay Dashboard](https://dashboard.razorpay.com) → **Settings** → **API Keys** (use **Test** keys for testing).
2. In `backend/.env` set:
   ```env
   RAZORPAY_BYPASS_MODE=false
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_key_secret_here
   ```
3. (Optional) Ensure payments are enabled:
   ```env
   ENABLE_RAZORPAY=true
   ```

### 2.3 Install dependencies (if not done)

```bash
pip install -r requirements.txt
```

### 2.4 Start the backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or, if you use a run script:

```bash
python run.py
```

Leave this terminal open. On your machine you can open `http://localhost:8000/docs`. **Apps must use a reachable URL (LAN IP or production), not localhost.** See [NETWORK_RULES.md](NETWORK_RULES.md).

---

## 3. Frontend

### 3.1 Go to frontend folder

Open a **new** terminal:

```bash
cd frontend
```

### 3.2 Configure API URL in `.env`

Edit `frontend/.env`:

- For device/emulator (replace with your machine’s IP if needed):
  ```env
  EXPO_PUBLIC_API_BASE_URL=http://192.168.1.9:8000
  ```
- **Hosted backend:** Use production URL (e.g. `https://assistlink-backend-1qjd.onrender.com`). See [NETWORK_RULES.md](NETWORK_RULES.md). Do not use localhost for the app.

### 3.3 Install dependencies (if not done)

```bash
npm install
```

### 3.4 Start the app

**Web:**

```bash
npx expo start --web
```

**Mobile (Expo Go):**

```bash
npx expo start
```

Then scan the QR code with Expo Go.  
(Note: In Expo Go, real Razorpay checkout does not run; use bypass mode or a dev build to test real payment.)

---

## 4. Test payment manually

### With bypass mode (`RAZORPAY_BYPASS_MODE=true`)

1. Log in as **care recipient**.
2. Create or open a booking that is in **accepted** state and needs payment (e.g. “Payment pending” on Schedule, or “Pay” on Booking detail).
3. Tap **Pay Now** or **Start Payment**.
4. On Payment screen, tap **Pay Now**.
5. You should see “Payment confirmed. Booking is confirmed and chat is enabled.” and be taken to Bookings.

### With real Razorpay (dev/production build, not Expo Go)

1. Use a **development or production build** (not Expo Go) so the Razorpay native SDK is available.
2. Log in as care recipient, open a booking that needs payment.
3. Tap **Pay Now** on Payment screen.
4. Razorpay checkout should open; complete test payment (use Razorpay test card details from their docs).
5. After success, you should see “Payment Successful and Booking Confirmed!” and be taken to Bookings.

---

## 5. Quick checklist

| Step | Action |
|------|--------|
| 1 | Run `add_payment_fields.sql` in Supabase SQL Editor (once). |
| 2 | If you had an old payment migration, run `fix_payment_status_captured.sql` (once). |
| 3 | In `backend/.env`: set `RAZORPAY_BYPASS_MODE=true` **or** set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. |
| 4 | Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`. |
| 5 | In `frontend/.env`: set `EXPO_PUBLIC_API_BASE_URL` to your backend URL. |
| 6 | Start frontend: `cd frontend && npx expo start --web` (or `npx expo start` for mobile). |
| 7 | Log in as care recipient → open a booking → Pay Now. |

---

## Troubleshooting

- **“Payment service is not configured”**  
  Backend could not create Razorpay client. For bypass: set `RAZORPAY_BYPASS_MODE=true`. For real payment: set both `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` and restart backend.

- **“Booking not found” / “Invalid payment signature”**  
  Ensure you ran the database migrations and that you are paying for a booking that exists and is in an accepted/pending state.

- **Payment columns or constraint errors in Supabase**  
  Run `add_payment_fields.sql` first, then `fix_payment_status_captured.sql` if the CHECK on `payment_status` was created without `captured`.

- **Expo Go: “Complete payment in app”**  
  Expected when Razorpay SDK is not available. Use bypass mode for testing in Expo Go, or a dev/production build for real Razorpay.

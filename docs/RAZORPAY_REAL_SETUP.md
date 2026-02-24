# Razorpay Real-Time Payment Setup

Enable **real Razorpay payments** (not bypass mode) so users complete actual checkout.

---

## 1. Get Razorpay Keys

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com) and sign in
2. **Settings** → **API Keys**
3. For **testing** (no real money): Copy **Test Key ID** (`rzp_test_...`) and **Test Key Secret**
4. For **production** (real payments): Copy **Live Key ID** (`rzp_live_...`) and **Live Key Secret** (requires account activation)

---

## 2. Backend Configuration

### Local development (`backend/.env`)

```env
# Razorpay – real payments (set both keys; do NOT use bypass)
RAZORPAY_BYPASS_MODE=false
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
ENABLE_RAZORPAY=true
```

### Production (Render)

In **Render** → your backend service → **Environment**:

| Key | Value |
|-----|-------|
| `RAZORPAY_BYPASS_MODE` | `false` |
| `RAZORPAY_KEY_ID` | `rzp_test_xxxxx` (test) or `rzp_live_xxxxx` (live) |
| `RAZORPAY_KEY_SECRET` | Your Key Secret from Razorpay dashboard |
| `ENABLE_RAZORPAY` | `true` |

Save and redeploy.

---

## 3. App Build Requirement

Real Razorpay checkout uses **react-native-razorpay**, which works only in:

- EAS dev/build APK
- Local prebuild (`expo run:android`)

**Not supported in Expo Go** – use bypass mode or a proper build for testing.

Rebuild your app:

```bash
cd frontend
eas build --platform android --profile preview
```

---

## 4. Real-Time Payment Webhook (recommended)

Razorpay can notify your backend when payment status changes (e.g. success, failure, refund).

1. In **Razorpay Dashboard** → **Settings** → **Webhooks** → **+ Add Webhook**
2. **Webhook URL:**  
   `https://YOUR-BACKEND-URL.onrender.com/api/payments/webhook`
3. **Events:** `payment.captured`, `payment.failed`
4. Razorpay will send `X-Razorpay-Signature` – your backend already has a webhook handler.

With the webhook enabled, the app shows **real-time payment confirmation** via Supabase Realtime: when the webhook updates the booking in the database, the Payment screen detects the change immediately and shows success without manual refresh.

---

## 5. Verify Setup

1. Check backend status:  
   `GET https://YOUR-BACKEND.onrender.com/api/payments/status`
2. Response should include `"configured": true`
3. Create a booking → **Pay Now** → Razorpay checkout should open
4. Use test card `4111 1111 1111 1111` (test keys only)

---

## Quick Checklist

- [ ] Razorpay keys added to `backend/.env` (local) or Render Environment
- [ ] `RAZORPAY_BYPASS_MODE=false`
- [ ] App built with EAS (not Expo Go)
- [ ] Webhook URL configured in Razorpay dashboard (optional)

# Razorpay Payment Setup Instructions

## ✅ What Has Been Implemented

### 1. Database Migration
- **File:** `database/migrations/add_payment_fields.sql`
- **Action Required:** Run this SQL in Supabase SQL Editor
- **Adds:** Payment fields to bookings table (amount, currency, payment_status, razorpay_order_id, etc.)

### 2. Backend Implementation
- **File:** `app/routers/payments.py`
- **Endpoints:**
  - `POST /api/payments/create-order` - Create Razorpay payment order
  - `POST /api/payments/verify` - Verify payment signature
  - `POST /api/payments/webhook` - Razorpay webhook handler

### 3. Configuration
- **File:** `app/config.py`
- **Added:** `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` environment variables

### 4. Dependencies
- **File:** `requirements.txt`
- **Added:** `razorpay>=1.4.0`

### 5. Frontend Integration
- **File:** `AssistLink-Frontend/src/PaymentScreen.tsx`
- **Updated:** Payment flow with Razorpay integration
- **File:** `AssistLink-Frontend/src/api/client.ts`
- **Added:** `createPaymentOrder` and `verifyPayment` API methods

### 6. Router Registration
- **File:** `app/main.py`
- **Added:** Payments router registration

## 📋 Setup Steps

### Step 1: Install Backend Dependencies
```bash
cd AssistLink-Backend
pip install -r requirements.txt
```

### Step 2: Run Database Migration
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `database/migrations/add_payment_fields.sql`
3. Paste and execute

### Step 3: Get Razorpay Credentials
1. Sign up at https://razorpay.com
2. Go to Dashboard → Settings → API Keys
3. Copy your **Key ID** and **Key Secret**
4. For testing, use test keys (starts with `rzp_test_`)

### Step 4: Add Environment Variables
Add to your `.env` file:
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
```

### Step 5: Restart Backend
```bash
# Stop current backend
# Then restart
python run.py
# or
uvicorn app.main:app --reload
```

### Step 6: Frontend Setup (Optional - for full Razorpay integration)
For React Native, you have two options:

**Option A: Use react-native-razorpay (Recommended)**
```bash
cd AssistLink-Frontend
npm install react-native-razorpay
# For Expo, you may need a custom development build
```

**Option B: Use WebView (Current implementation)**
The current PaymentScreen has a fallback that works without the SDK.

## 🧪 Testing

### Test Payment Flow
1. Create a booking (or use existing pending booking)
2. Navigate to PaymentScreen
3. Click "Pay Now"
4. Use Razorpay test card: `4111 1111 1111 1111`
5. Enter any CVV and future expiry date
6. Verify payment is processed
7. Check booking status is updated to "accepted"

### Test Cards
- **Success:** `4111 1111 1111 1111`
- **Failure:** `4000 0000 0000 0002`
- **CVV:** Any 3 digits
- **Expiry:** Any future date

## 🔍 Verification Checklist

- [ ] Database migration executed successfully
- [ ] Razorpay credentials added to `.env`
- [ ] Backend dependencies installed
- [ ] Backend restarted
- [ ] Payment order creation works (`POST /api/payments/create-order`)
- [ ] Payment verification works (`POST /api/payments/verify`)
- [ ] Frontend can create payment orders
- [ ] Frontend can verify payments
- [ ] Booking status updates after payment
- [ ] Chat session enabled after payment

## ⚠️ Common Issues

### Issue 1: "Payment service is not configured"
**Solution:** Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `.env`

### Issue 2: "Invalid payment signature"
**Solution:** Ensure you're using the correct Key Secret and signature verification logic

### Issue 3: Database errors
**Solution:** Run the migration SQL in Supabase SQL Editor

### Issue 4: Frontend can't find Razorpay SDK
**Solution:** 
- Install `react-native-razorpay` for native integration
- Or use the WebView fallback approach
- Or use the current fallback method (for testing only)

## 📚 Documentation

- **Workflow:** See `RAZORPAY_PAYMENT_WORKFLOW.md`
- **Razorpay Docs:** https://razorpay.com/docs/
- **React Native SDK:** https://github.com/razorpay/react-native-razorpay

## 🚀 Production Checklist

Before going live:
- [ ] Switch to Razorpay live keys
- [ ] Configure webhook URL in Razorpay Dashboard
- [ ] Enable webhook signature verification
- [ ] Test with real payment methods
- [ ] Set up payment monitoring
- [ ] Implement payment failure handling
- [ ] Add payment analytics

## 📞 Support

- **Razorpay Support:** support@razorpay.com
- **Documentation:** https://razorpay.com/docs/


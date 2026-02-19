# Razorpay Payment Integration Workflow

## Overview
This document describes the complete payment workflow using Razorpay integration with FastAPI backend and React Native frontend.

## Prerequisites

### 1. Razorpay Account Setup
1. Create a Razorpay account at https://razorpay.com
2. Get your **Key ID** and **Key Secret** from Dashboard → Settings → API Keys
3. Add them to your `.env` file:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_key_secret_here
   ```

### 2. Database Migration
Run the payment fields migration in Supabase SQL Editor:
```sql
-- File: database/migrations/add_payment_fields.sql
-- This adds payment-related columns to the bookings table
```

### 3. Install Dependencies
```bash
# Backend
pip install razorpay

# Frontend (if using React Native Razorpay SDK)
npm install react-native-razorpay
# For Expo, you may need to use a web-based approach or custom development build
```

## Payment Flow Architecture

```
┌─────────────┐
│   Frontend  │
│ PaymentScreen│
└──────┬──────┘
       │ 1. Create Order Request
       ▼
┌──────────────────┐
│  FastAPI Backend  │
│ /api/payments/    │
│ create-order      │
└──────┬────────────┘
       │ 2. Create Razorpay Order
       ▼
┌─────────────┐
│   Razorpay  │
│   Gateway   │
└──────┬──────┘
       │ 3. Return Order ID
       ▼
┌─────────────┐
│   Frontend  │
│ PaymentScreen│
│ (Razorpay UI)│
└──────┬──────┘
       │ 4. User Pays
       ▼
┌─────────────┐
│   Razorpay  │
│   Gateway   │
└──────┬──────┘
       │ 5. Payment Success
       ▼
┌─────────────┐
│   Frontend  │
│ PaymentScreen│
└──────┬──────┘
       │ 6. Verify Payment
       ▼
┌──────────────────┐
│  FastAPI Backend  │
│ /api/payments/    │
│ verify            │
└──────┬────────────┘
       │ 7. Update Booking
       ▼
┌─────────────┐
│  Database   │
│  (Supabase) │
└─────────────┘
```

## API Endpoints

### 1. Create Payment Order
**Endpoint:** `POST /api/payments/create-order`

**Request:**
```json
{
  "booking_id": "uuid-here",
  "amount": 500.00,
  "currency": "INR"
}
```

**Response:**
```json
{
  "order_id": "order_xxxxxxxxxxxxx",
  "amount": 500.00,
  "currency": "INR",
  "key_id": "rzp_test_xxxxxxxxxxxxx",
  "booking_id": "uuid-here"
}
```

### 2. Verify Payment
**Endpoint:** `POST /api/payments/verify`

**Request:**
```json
{
  "razorpay_order_id": "order_xxxxxxxxxxxxx",
  "razorpay_payment_id": "pay_xxxxxxxxxxxxx",
  "razorpay_signature": "signature_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified and booking confirmed",
  "booking_id": "uuid-here"
}
```

### 3. Webhook (Optional)
**Endpoint:** `POST /api/payments/webhook`

Razorpay calls this endpoint for payment status updates. Configure webhook URL in Razorpay Dashboard.

## Frontend Implementation

### PaymentScreen Component Flow

1. **Load Booking Details**
   - Display booking information
   - Show amount to be paid
   - Calculate amount if not set

2. **Create Payment Order**
   ```typescript
   const orderResponse = await api.createPaymentOrder({
     booking_id: appointment.id,
     amount: appointment.price || 500,
     currency: "INR"
   });
   ```

3. **Initialize Razorpay Checkout**
   ```typescript
   // For React Native Web or WebView
   const options = {
     key: orderResponse.key_id,
     amount: orderResponse.amount * 100, // Convert to paise
     currency: orderResponse.currency,
     name: "AssistLink",
     description: `Payment for booking ${appointment.id}`,
     order_id: orderResponse.order_id,
     handler: async (response) => {
       // Verify payment
       await verifyPayment(response);
     },
     prefill: {
       email: user.email,
       contact: user.phone,
       name: user.full_name
     },
     theme: {
       color: "#059669"
     }
   };
   
   // Open Razorpay Checkout
   RazorpayCheckout.open(options);
   ```

4. **Verify Payment**
   ```typescript
   const verifyResponse = await api.verifyPayment({
     razorpay_order_id: response.razorpay_order_id,
     razorpay_payment_id: response.razorpay_payment_id,
     razorpay_signature: response.razorpay_signature
   });
   
   if (verifyResponse.success) {
     // Navigate to success screen
     navigation.navigate('CareRecipientDashboard');
   }
   ```

## Database Schema Updates

The following fields are added to the `bookings` table:

- `amount` (DECIMAL): Payment amount
- `currency` (TEXT): Currency code (default: INR)
- `payment_status` (TEXT): pending, initiated, processing, completed, failed, refunded
- `razorpay_order_id` (TEXT): Unique Razorpay order ID
- `razorpay_payment_id` (TEXT): Razorpay payment ID after payment
- `razorpay_signature` (TEXT): Payment signature for verification
- `payment_initiated_at` (TIMESTAMPTZ): When payment was initiated
- `payment_completed_at` (TIMESTAMPTZ): When payment was completed

## Error Handling

### Common Errors

1. **Payment Service Not Configured**
   - Error: "Payment service is not configured"
   - Solution: Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `.env`

2. **Invalid Payment Signature**
   - Error: "Invalid payment signature"
   - Solution: Ensure signature verification logic matches Razorpay's algorithm

3. **Booking Not Found**
   - Error: "Booking not found"
   - Solution: Verify booking_id is correct and user has access

4. **Payment Not Successful**
   - Error: "Payment not successful"
   - Solution: Check payment status in Razorpay Dashboard

## Testing

### Test Mode
Use Razorpay test keys:
- Key ID: `rzp_test_xxxxxxxxxxxxx`
- Key Secret: `your_test_secret`

### Test Cards
Use Razorpay test cards:
- Success: `4111 1111 1111 1111`
- Failure: `4000 0000 0000 0002`

### Test Flow
1. Create a booking
2. Navigate to PaymentScreen
3. Click "Pay Now"
4. Use test card: `4111 1111 1111 1111`
5. Enter any CVV and expiry date
6. Verify payment is processed
7. Check booking status is updated to "accepted"

## Security Considerations

1. **Never expose Key Secret** in frontend code
2. **Always verify payment signature** on backend
3. **Use HTTPS** in production
4. **Validate amounts** on backend before creating orders
5. **Implement rate limiting** on payment endpoints
6. **Log all payment transactions** for audit

## Production Checklist

- [ ] Switch to Razorpay live keys
- [ ] Configure webhook URL in Razorpay Dashboard
- [ ] Enable webhook signature verification
- [ ] Set up payment failure notifications
- [ ] Implement retry logic for failed payments
- [ ] Add payment analytics and reporting
- [ ] Test with real payment methods
- [ ] Set up monitoring and alerts

## Support

For Razorpay integration issues:
- Razorpay Documentation: https://razorpay.com/docs/
- Razorpay Support: support@razorpay.com


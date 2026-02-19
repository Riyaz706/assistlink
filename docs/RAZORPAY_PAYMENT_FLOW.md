# Razorpay Payment Flow - Complete Implementation

## Overview
This document describes the complete Razorpay payment integration flow that redirects users to Razorpay checkout page and enables chat after successful payment.

## Payment Flow

### 1. User Clicks "Pay Now"
- Frontend calls `POST /api/payments/create-order`
- Backend creates a Razorpay order
- Returns order details including `order_id`, `key_id`, `amount`, `currency`

### 2. Razorpay Checkout Opens
**For Web Platform:**
- Razorpay checkout script is loaded automatically
- Checkout modal opens with payment options
- User can pay using:
  - Credit/Debit Cards
  - UPI
  - Net Banking
  - Wallets
  - Other payment methods

**For Mobile Platform:**
- Opens Razorpay checkout URL in browser
- User completes payment in browser
- Returns to app after payment

### 3. Payment Success
- Razorpay returns payment details:
  - `razorpay_payment_id`
  - `razorpay_order_id`
  - `razorpay_signature`
- Frontend calls `POST /api/payments/verify` with these details

### 4. Payment Verification
- Backend verifies payment signature
- Checks payment status with Razorpay API
- Updates booking:
  - `payment_status`: "completed"
  - `status`: "accepted"
  - Stores payment IDs
- Creates/enables chat session
- Marks caregiver as unavailable
- Sends notifications to both parties

### 5. Chat Enabled
- User is redirected to ChatList
- Chat session is now active
- Both parties can start messaging

## Backend Endpoints

### POST /api/payments/create-order
**Request:**
```json
{
  "booking_id": "uuid",
  "amount": 500,
  "currency": "INR"
}
```

**Response:**
```json
{
  "order_id": "order_xxx",
  "amount": 500,
  "currency": "INR",
  "key_id": "rzp_test_xxx",
  "booking_id": "uuid"
}
```

### POST /api/payments/verify
**Request:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified and booking confirmed. Chat is now enabled.",
  "booking_id": "uuid",
  "chat_session_id": "uuid"
}
```

## Frontend Implementation

### PaymentScreen.tsx
- Loads Razorpay checkout script for web
- Opens Razorpay checkout modal/webpage
- Handles payment success callback
- Verifies payment with backend
- Navigates to chat after successful payment

### Key Features
- ✅ Full Razorpay checkout integration
- ✅ Multiple payment methods supported
- ✅ Payment verification
- ✅ Automatic chat enabling
- ✅ Error handling
- ✅ Loading states

## Testing

### Test Mode
- Uses Razorpay test keys from `.env`
- Test card numbers available in Razorpay dashboard
- All test payments are simulated

### Test Cards
- Success: `4111 1111 1111 1111`
- Failure: `4000 0000 0000 0002`
- CVV: Any 3 digits
- Expiry: Any future date

## Configuration

### Environment Variables
```env
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
```

### Supabase
- Ensure payment fields are added to bookings table
- Run migration: `add_payment_fields.sql`

## Error Handling

- Payment gateway errors are caught and displayed
- Signature verification failures are handled
- Network errors are retried
- User-friendly error messages

## Security

- Payment signatures are verified server-side
- Payment status is confirmed with Razorpay API
- Only care recipients can initiate payments
- Booking ownership is verified

## Notes

- Payment must be completed within Razorpay's timeout
- Chat is only enabled after successful payment verification
- Booking status changes from "pending" to "accepted" after payment
- Caregiver is marked unavailable after payment


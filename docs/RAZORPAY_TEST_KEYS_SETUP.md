# Razorpay Test Keys Setup Guide

## Quick Setup

1. **Get Your Razorpay Test Keys:**
   - Go to https://razorpay.com and sign up/login
   - Navigate to Dashboard → Settings → API Keys
   - Copy your **Test Key ID** (starts with `rzp_test_`)
   - Copy your **Test Key Secret**

2. **Add to .env file:**
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_test_key_secret_here
   ```

3. **Example Test Keys Format:**
   ```env
   # Test Mode Keys (for development)
   RAZORPAY_KEY_ID=rzp_test_1234567890ABCDEF
   RAZORPAY_KEY_SECRET=abcdef1234567890abcdef1234567890
   ```

## Test Cards

Use these test cards in Razorpay checkout:

- **Success Card:** `4111 1111 1111 1111`
- **Failure Card:** `4000 0000 0000 0002`
- **CVV:** Any 3 digits (e.g., `123`)
- **Expiry:** Any future date (e.g., `12/25`)

## Testing Flow

1. Create a booking
2. Navigate to PaymentScreen
3. Click "Pay Now"
4. Use test card: `4111 1111 1111 1111`
5. Enter CVV and expiry
6. Payment should succeed
7. Chat should be enabled
8. Navigate to ChatList to see the chat

## Notes

- Test keys only work in test mode
- No real money is charged
- Switch to live keys for production


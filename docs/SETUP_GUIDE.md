# Setup Guide: Notifications, Twilio Video & Supabase Realtime

## 📋 Prerequisites

1. **Supabase Account** ✅ (Already set up)
2. **Firebase Account** (for push notifications)
3. **Twilio Account** (for video calls)

---

## 1. 🔔 Notifications System Setup

### Step 1: Run Database Schema

Run the notifications schema in Supabase SQL Editor:

```bash
# Copy contents of database/notifications_schema.sql
# Paste and execute in Supabase Dashboard → SQL Editor
```

Or run:
```sql
-- See database/notifications_schema.sql for full schema
```

### Step 2: Enable Supabase Realtime for Notifications

1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Find `notifications` table
3. Toggle **Enable Realtime** ✅
4. Save

**Frontend Integration:**
```javascript
// Subscribe to notifications in real-time
const channel = supabase
  .channel('notifications')
  .on('postgres_changes', 
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      // New notification received!
      const notification = payload.new;
      // Update UI, show badge, etc.
    }
  )
  .subscribe();
```

### Step 3: Firebase Cloud Messaging (FCM) Setup

#### For Push Notifications:

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create new project or use existing
   - Add your app (iOS/Android/Web)

2. **Get Server Key**
   - Go to **Project Settings** → **Cloud Messaging**
   - Copy **Server key** (legacy) or create **Service Account**

3. **Add to .env**
   ```env
   FCM_SERVER_KEY=your_fcm_server_key_here
   ```

4. **Install Dependencies**
   ```bash
   pip install pyfcm
   ```

**Note:** For production, consider using Firebase Admin SDK instead of FCM server key.

---

## 2. 🎥 Twilio Video Setup

### Step 1: Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial with $15.50 credit)
3. Verify your phone number

### Step 2: Get Twilio Credentials

1. Go to **Twilio Console** → **Account** → **API Keys & Tokens**
2. Get:
   - **Account SID** (starts with `AC...`)
   - **Auth Token**
3. Create **API Key**:
   - Go to **API Keys** → **Create API Key**
   - Save **API Key SID** (starts with `SK...`)
   - Save **API Key Secret** (shown only once!)

### Step 3: Add to .env

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret
```

### Step 4: Install Dependencies

```bash
pip install twilio
```

### Step 5: Test Twilio Connection

After implementing the video endpoints, test with:
```bash
# Generate a test token
curl -X POST http://localhost:8000/api/video/generate-token \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"room_name": "test-room", "user_identity": "test-user"}'
```

---

## 3. 💬 Supabase Realtime Chat Setup

### Step 1: Enable Realtime on Messages Table

1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Find `messages` table
3. Toggle **Enable Realtime** ✅
4. Save

**That's it!** No backend code changes needed.

### Step 2: Frontend Integration

```javascript
// Subscribe to new messages in a chat session
const channel = supabase
  .channel(`chat:${chatSessionId}`)
  .on('postgres_changes', 
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_session_id=eq.${chatSessionId}`
    },
    (payload) => {
      // New message received in real-time!
      const newMessage = payload.new;
      // Update chat UI
    }
  )
  .on('postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `chat_session_id=eq.${chatSessionId}`
    },
    (payload) => {
      // Message updated (e.g., read receipt)
      const updatedMessage = payload.new;
    }
  )
  .subscribe();
```

### Step 3: Test Realtime

1. Open two browser tabs (or two users)
2. Send a message from one
3. Other should receive it instantly (no polling needed!)

---

## 📝 Environment Variables Summary

Add these to your `.env` file:

```env
# Existing Supabase config
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Notifications (FCM)
FCM_SERVER_KEY=your_fcm_server_key  # Optional, for push notifications

# Twilio Video
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret
```

---

## 🧪 Testing Checklist

### Notifications:
- [ ] Run `database/notifications_schema.sql` in Supabase
- [ ] Enable Realtime on `notifications` table
- [ ] Test `GET /api/notifications` (should return empty list initially)
- [ ] Create video call request → Check notifications for caregiver
- [ ] Accept video call → Check notifications for other party
- [ ] Send message → Check notifications for recipient
- [ ] Test `POST /api/notifications/{id}/read`
- [ ] Test `GET /api/notifications/unread-count`

### Twilio Video:
- [ ] Create Twilio account
- [ ] Add credentials to `.env`
- [ ] Install `twilio` package
- [ ] Test token generation endpoint (after implementation)
- [ ] Test video call flow

### Supabase Realtime Chat:
- [ ] Enable Realtime on `messages` table
- [ ] Test sending message from one user
- [ ] Verify other user receives it instantly (no refresh needed)

---

## 🚀 Next Steps

1. **Run notifications schema** in Supabase
2. **Set up Firebase** for push notifications (optional but recommended)
3. **Create Twilio account** and add credentials
4. **Enable Realtime** on `messages` and `notifications` tables
5. **Test each feature** independently

---

## 💰 Cost Estimates

### Supabase Realtime:
- **Free Tier**: 200 concurrent connections, 2GB/month
- **Your Usage**: 50-100 users → **FREE** ✅

### Twilio Video:
- **15-second call**: ~$0.002 per call
- **1000 calls**: ~$2.00
- **Free Trial**: $15.50 credit (good for testing)

### Firebase FCM:
- **Free Tier**: Unlimited messages
- **Your Usage**: **FREE** ✅

---

## 📚 Documentation Links

- **Supabase Realtime**: https://supabase.com/docs/guides/realtime
- **Twilio Video**: https://www.twilio.com/docs/video
- **Firebase FCM**: https://firebase.google.com/docs/cloud-messaging



# Implementation Plan: Notifications, Video Conferencing & Real-time Chat

## 📋 Overview

This document outlines the implementation approach for three major features:
1. **Notifications System**
2. **Video Conferencing (Twilio)**
3. **Real-time Chat (Supabase Realtime or WebSockets)**

---

## 1. 🔔 Notifications System

### **What Events Need Notifications?**

Based on the current flow, these events should trigger notifications:

#### **Video Call Events:**
- ✅ New video call request created (notify caregiver)
- ✅ Video call request accepted/declined (notify both parties)
- ✅ Video call request status changed

#### **Chat Events:**
- ✅ New message received (when chat is enabled)
- ✅ Chat session enabled (notify both parties)
- ✅ Message read receipt

#### **Booking Events:**
- ✅ New booking created (notify caregiver)
- ✅ Booking status changed (pending → accepted/declined/completed)
- ✅ Booking reminder (before scheduled time)
- ✅ Recurring booking created

#### **Profile Events:**
- ✅ Profile update notifications
- ✅ Caregiver availability status changed

### **Notification Types to Support:**

1. **In-App Notifications** (stored in database)
   - User sees when they open the app
   - Mark as read/unread
   - Persistent history

2. **Push Notifications** (mobile/web)
   - Real-time alerts when app is closed
   - Requires device tokens (FCM, APNS, Web Push)

3. **Email Notifications** (optional)
   - For important events
   - Summary emails

### **Implementation Options:**

#### **Option A: Supabase Realtime + Custom Notifications Table** (Recommended)
**Pros:**
- ✅ Already using Supabase
- ✅ Realtime subscriptions can trigger notifications
- ✅ Free tier available
- ✅ Simple integration

**Cons:**
- ⚠️ Limited push notification support (need separate service)
- ⚠️ Email requires additional service

**Implementation:**
```sql
-- Add notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'video_call', 'message', 'booking', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional data (booking_id, video_call_id, etc.)
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend:**
- Create notification when events occur
- Endpoint: `GET /api/notifications` (list user's notifications)
- Endpoint: `POST /api/notifications/{id}/read` (mark as read)
- Endpoint: `GET /api/notifications/unread-count` (badge count)

**Frontend:**
- Subscribe to `notifications` table changes via Supabase Realtime
- Show in-app notification badge/count
- Display notification list

#### **Option B: Firebase Cloud Messaging (FCM) + In-App**
**Pros:**
- ✅ Full push notification support (iOS, Android, Web)
- ✅ Free tier (generous limits)
- ✅ Reliable delivery
- ✅ Rich notifications (images, actions)

**Cons:**
- ⚠️ Additional service to integrate
- ⚠️ Need device token management
- ⚠️ Requires Firebase project setup

**Implementation:**
- Store device tokens in `user_devices` table
- Use `firebase-admin` Python SDK
- Send push notifications when events occur
- Still need in-app notifications table for history

#### **Option C: Hybrid Approach** (Best for Production)
- **In-App**: Supabase notifications table + Realtime
- **Push**: Firebase Cloud Messaging (FCM)
- **Email**: SendGrid / AWS SES / Resend

### **Recommended Approach:**
**Start with Option A (Supabase)**, then add FCM for push notifications later.

**Database Schema Needed:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

**Backend Endpoints Needed:**
- `GET /api/notifications` - List notifications (with pagination)
- `GET /api/notifications/unread-count` - Get unread count
- `POST /api/notifications/{id}/read` - Mark as read
- `POST /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/{id}` - Delete notification

**Integration Points:**
- When video call created → Create notification for caregiver
- When video call accepted → Create notification for care recipient
- When message sent → Create notification for recipient
- When booking created → Create notification for caregiver
- When booking status changes → Create notification for both parties

---

## 2. 🎥 Video Conferencing with Twilio

### **Twilio Video API Overview**

**Pricing:**
- **Free Trial**: $15.50 credit
- **Pay-as-you-go**: $0.004 per participant-minute
- **15-second call**: ~$0.001 per call (very cheap!)

**Features:**
- ✅ WebRTC-based (browser & mobile SDKs)
- ✅ Room-based or peer-to-peer
- ✅ Recording support (optional)
- ✅ Screen sharing
- ✅ Mobile SDKs (iOS, Android)
- ✅ Web SDK (JavaScript)

### **Implementation Steps:**

#### **Step 1: Twilio Setup**
1. Create Twilio account
2. Get Account SID and Auth Token
3. Install Twilio Video SDK (client-side)
4. Install `twilio` Python SDK (backend)

#### **Step 2: Backend Implementation**

**New Endpoint: Generate Access Token**
```python
POST /api/video/generate-token
{
  "room_name": "video-call-{video_call_id}",
  "user_identity": "user_id"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "room_name": "video-call-abc-123"
}
```

**Update Video Call Request Creation:**
- Instead of placeholder URL, generate Twilio room name
- Store room name in `video_call_requests.video_call_url`
- Generate access tokens when both parties accept

**New Endpoint: Get Video Call Token**
```python
GET /api/bookings/video-call/{video_call_id}/token
Authorization: Bearer <token>

Response:
{
  "token": "...",
  "room_name": "...",
  "expires_in": 3600
}
```

#### **Step 3: 15-Second Call Enforcement**

**Options:**
1. **Client-side timer** (simple)
   - Frontend starts 15-second countdown
   - Auto-disconnect after 15 seconds
   - Call `POST /api/bookings/video-call/{id}/complete` when done

2. **Server-side enforcement** (more secure)
   - Backend tracks call start time
   - Webhook from Twilio when call ends
   - Auto-update status to "completed"

**Recommended:** Client-side timer + server-side webhook for reliability

#### **Step 4: Database Updates**

**Update `video_call_requests` table:**
- `video_call_url` → Store Twilio room name (e.g., `video-call-{uuid}`)
- Add `twilio_room_sid` (optional, for tracking)
- Add `call_started_at` (when call actually started)
- Add `call_ended_at` (when call ended)

#### **Step 5: Frontend Integration**

**Client-side (JavaScript/React):**
```javascript
import { connect } from '@twilio/video';

// Get token from backend
const response = await fetch('/api/bookings/video-call/{id}/token');
const { token, room_name } = await response.json();

// Connect to room
const room = await connect(token, {
  name: room_name,
  audio: true,
  video: true
});

// 15-second timer
setTimeout(() => {
  room.disconnect();
  // Mark as completed
  await fetch('/api/bookings/video-call/{id}/complete', { method: 'POST' });
}, 15000);
```

### **Environment Variables Needed:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret
```

### **Dependencies:**
```txt
twilio>=8.0.0
```

### **Cost Estimate:**
- 15-second call = 0.25 minutes × 2 participants = 0.5 minutes
- Cost = 0.5 × $0.004 = **$0.002 per call**
- 1000 calls = $2.00
- Very affordable for MVP!

---

## 3. 💬 Real-time Chat System

### **Option A: Supabase Realtime** (Recommended)

#### **Pricing:**
- **Free Tier**: 200 concurrent connections, 2GB bandwidth/month
- **Pro Tier**: $25/month (500 connections, 50GB bandwidth)
- **Team Tier**: $599/month (unlimited connections)

#### **How It Works:**
- Supabase Realtime listens to PostgreSQL changes
- When new message inserted → Realtime broadcasts to subscribed clients
- No backend code needed for real-time delivery!

#### **Implementation:**

**Backend Changes:**
- ✅ No changes needed! Messages already stored in `messages` table
- ✅ Existing `POST /api/chat/sessions/{id}/messages` endpoint works
- ✅ Realtime automatically broadcasts INSERT events

**Frontend Implementation:**
```javascript
// Subscribe to new messages
const channel = supabase
  .channel(`chat:${chat_session_id}`)
  .on('postgres_changes', 
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_session_id=eq.${chat_session_id}`
    },
    (payload) => {
      // New message received!
      const newMessage = payload.new;
      // Update UI
    }
  )
  .subscribe();

// Also subscribe to message updates (read receipts)
.on('postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'messages',
    filter: `chat_session_id=eq.${chat_session_id}`
  },
  (payload) => {
    // Message updated (e.g., read_at changed)
  }
);
```

**Database Changes:**
- ✅ No schema changes needed!
- ✅ Enable Realtime on `messages` table in Supabase Dashboard
- ✅ Set up RLS policies (already done)

**Pros:**
- ✅ Zero backend code changes
- ✅ Free for development
- ✅ Automatic scaling
- ✅ Built-in connection management
- ✅ Works with existing RLS policies

**Cons:**
- ⚠️ Free tier has connection limits (200 concurrent)
- ⚠️ Bandwidth limits (2GB/month free)
- ⚠️ Requires Supabase client SDK on frontend

#### **Supabase Dashboard Setup:**
1. Go to Database → Replication
2. Enable replication for `messages` table
3. Done! Realtime is now active

---

### **Option B: FastAPI WebSockets**

#### **Implementation:**

**Backend Changes:**
```python
# app/routers/chat.py
from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/ws/chat/{chat_session_id}")
async def websocket_chat(websocket: WebSocket, chat_session_id: str):
    await websocket.accept()
    # Join room for this chat session
    # Broadcast messages to all connected clients in room
    # Handle disconnections
```

**Architecture:**
- WebSocket server in FastAPI
- Room management (one room per chat session)
- Message broadcasting
- Connection management

**Dependencies:**
```txt
websockets>=11.0
python-socketio>=5.0  # Optional, for easier room management
```

**Pros:**
- ✅ Full control
- ✅ No external dependencies
- ✅ No connection limits
- ✅ Custom logic possible

**Cons:**
- ⚠️ More complex to implement
- ⚠️ Need to handle reconnections
- ⚠️ Need to manage connection state
- ⚠️ Scaling requires Redis/pub-sub
- ⚠️ More code to maintain

---

### **Recommendation: Supabase Realtime**

**Why:**
1. ✅ Already using Supabase
2. ✅ Zero backend changes needed
3. ✅ Free tier sufficient for MVP
4. ✅ Automatic scaling
5. ✅ Built-in connection management
6. ✅ Works with existing RLS policies

**When to Consider WebSockets:**
- If you exceed Supabase Realtime limits
- If you need custom real-time features
- If you want to avoid vendor lock-in

---

## 📊 Implementation Priority & Timeline

### **Phase 1: Notifications System** (1-2 days)
1. Create `notifications` table
2. Add notification creation helpers
3. Integrate into existing endpoints
4. Add notification API endpoints
5. Frontend: Subscribe to Realtime for notifications

### **Phase 2: Twilio Video** (2-3 days)
1. Set up Twilio account
2. Install Twilio SDK
3. Create token generation endpoint
4. Update video call request creation
5. Add call completion endpoint
6. Frontend: Integrate Twilio Video SDK
7. Implement 15-second timer

### **Phase 3: Real-time Chat** (1 day)
1. Enable Supabase Realtime on `messages` table
2. Test Realtime subscriptions
3. Frontend: Implement Realtime subscriptions
4. Update UI to show messages in real-time

---

## ❓ Questions to Clarify

### **Notifications:**
1. Do you want push notifications (mobile/web) or just in-app?
2. Should notifications be sent via email too?
3. Do you want notification preferences (user can disable certain types)?

### **Video Conferencing:**
1. Do you have a Twilio account already?
2. Should calls be recorded?
3. Do you need screen sharing?
4. Mobile app support needed immediately?

### **Chat:**
1. Is Supabase Realtime free tier sufficient for your expected users?
2. Do you need message delivery receipts (sent/delivered/read)?
3. Do you need typing indicators?

---

## 🎯 Recommended Implementation Order

1. **Start with Supabase Realtime Chat** (easiest, no backend changes)
2. **Add Notifications System** (needed for all features)
3. **Integrate Twilio Video** (most complex, but well-documented)

This order allows you to test each feature independently and build on previous work.

---

## 📝 Next Steps

Once you confirm:
1. Notification preferences (in-app only? push? email?)
2. Twilio account status
3. Expected user count (for Realtime limits)
4. Any specific requirements

I can start implementing in the recommended order!


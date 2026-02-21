# WebRTC Video Calls (AssistLink PWA)

The AssistLink PWA supports **1-to-1 video calling** on web using **WebRTC** with **Supabase Realtime** for signaling. No third-party video SDK (e.g. Twilio) is required for the web flow.

## Architecture

- **Signaling**: Supabase Realtime broadcast channel per call (`webrtc:{roomId}`).
- **Media**: Browser `getUserMedia` + `RTCPeerConnection` (peer-to-peer).
- **STUN**: Google STUN servers for NAT traversal.

## Setup

1. **Supabase**  
   Use the same Supabase project as the backend. In the frontend `.env` add:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   Get these from Supabase: Project Settings → API → Project URL and anon (public) key.

2. **Realtime**  
   No extra Realtime config is required; broadcast uses the anon key and public channels (room ID is the secret).

## Flow

- **Room ID** is one of: `callId` (video call request), `bookingId`, or `roomId` (e.g. chat session id).
- Both participants join the same Supabase channel and exchange **ready** → **offer** → **answer** → **ICE**.
- **Start call**: User opens VideoCallScreen with a room id (from booking, schedule, chat, or notifications). The hook requests camera/mic, subscribes to the channel, and starts signaling.
- **Accept call**: The other user opens the same screen with the same room id (e.g. from their schedule or notification) and joins the same channel; WebRTC negotiation runs automatically.
- **End call**: Either side can end; the hook sends a **hangup** and cleans up. If a `bookingId` or `callId` is present, the app calls the backend to mark the video call as completed.

## Features

- Start / accept / end call  
- Mute / unmute microphone  
- Camera on / off  
- Loading (getting media, connecting)  
- Reconnecting (ICE disconnect/fail)  
- Permission denied: clear message and “Try again”  
- Config error: message when Supabase URL/key are missing  
- Accessible controls (labels, roles, live region for status)  
- Mobile-friendly layout and touch targets  

## Where video calls are started

- **Booking detail**: `bookingId` → room id and completion.
- **Schedule (care recipient)**: `callId` + `otherPartyName`.
- **Chat**: On web, `roomId: chatSessionId`; on native, Jitsi URL.
- **Notifications**: `callId` from notification payload.

## Platform

- **Web (PWA)**: Full WebRTC implementation in `VideoCallScreen.web.tsx` and `useWebRTC.ts`.
- **Native (iOS/Android)**: Uses existing Twilio-based `VideoCallScreen.tsx` (or Jitsi from chat). The `.web.tsx` file is only used when building for web.

## Security

- Room id is a UUID or known id (booking/call/session); only users who have that id in the app can join the channel.
- Supabase anon key is public; channel names are not guessable if you use UUIDs for `callId` / `bookingId`.
- For stricter auth, you can switch to a private Realtime channel and pass a Supabase JWT (e.g. from your backend) when initializing the client.

# Twilio Video Integration Implementation Plan

## Overview

This document outlines the implementation of Twilio Video for 15-second video calls between care recipients and caregivers.

---

## Prerequisites

1. **Twilio Account** (not created yet - see setup steps)
2. **Twilio Video SDK** (client-side)
3. **Python Twilio SDK** (backend)

---

## Implementation Steps

### Step 1: Twilio Account Setup

1. **Sign up for Twilio**
   - Go to https://www.twilio.com/try-twilio
   - Create account (free trial: $15.50 credit)
   - Verify phone number

2. **Get Credentials**
   - **Account SID**: Dashboard → Account → API Keys & Tokens
   - **Auth Token**: Same location (click to reveal)
   - **Create API Key**:
     - Go to API Keys → Create API Key
     - Name: "AssistLink Video"
     - Save **API Key SID** (starts with `SK...`)
     - Save **API Key Secret** (shown only once - save it!)

3. **Add to .env**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_API_KEY_SID=SKxxxxxxxxxxxxx
   TWILIO_API_KEY_SECRET=your_api_key_secret_here
   ```

---

### Step 2: Backend Implementation

#### 2.1: Create Video Token Generation Service

**File**: `app/services/video.py`

```python
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VideoGrant
from app.config import settings
from typing import Optional

def generate_video_token(room_name: str, user_identity: str, ttl: int = 3600) -> Optional[str]:
    """
    Generate Twilio Video access token
    
    Args:
        room_name: Name of the video room
        user_identity: User identifier (user_id)
        ttl: Token time-to-live in seconds (default: 1 hour)
    
    Returns:
        JWT token string or None if Twilio not configured
    """
    if not all([
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_API_KEY_SID,
        settings.TWILIO_API_KEY_SECRET
    ]):
        return None
    
    # Create access token
    token = AccessToken(
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_API_KEY_SID,
        settings.TWILIO_API_KEY_SECRET,
        identity=user_identity
    )
    
    # Grant video permissions
    video_grant = VideoGrant(room=room_name)
    token.add_grant(video_grant)
    
    return token.to_jwt()
```

#### 2.2: Create Video Router

**File**: `app/routers/video.py`

```python
from fastapi import APIRouter, HTTPException, status, Depends
from app.dependencies import get_current_user
from app.services.video import generate_video_token
from app.config import settings
from pydantic import BaseModel

router = APIRouter()

class VideoTokenRequest(BaseModel):
    room_name: str
    user_identity: Optional[str] = None

@router.post("/generate-token")
async def generate_token(
    request: VideoTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate Twilio Video access token"""
    user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
    user_identity = request.user_identity or user_id
    
    token = generate_video_token(
        room_name=request.room_name,
        user_identity=user_identity
    )
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Video service not configured. Please set Twilio credentials."
        )
    
    return {
        "token": token,
        "room_name": request.room_name,
        "expires_in": 3600
    }
```

#### 2.3: Update Video Call Request Creation

**In**: `app/routers/bookings.py`

**Change**:
```python
# Instead of placeholder URL:
"video_call_url": f"https://video-call.assistlink.app/{uuid.uuid4()}"

# Use Twilio room name:
room_name = f"video-call-{uuid.uuid4()}"
"video_call_url": room_name  # Store room name, not URL
```

#### 2.4: Add Token Endpoint for Video Calls

**In**: `app/routers/bookings.py`

```python
@router.get("/video-call/{video_call_id}/token")
async def get_video_call_token(
    video_call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get Twilio Video token for a video call"""
    # Verify user has access to video call
    # Get video_call_url (room name)
    # Generate token
    # Return token
```

---

### Step 3: Frontend Integration

#### 3.1: Install Twilio Video SDK

```bash
npm install @twilio/video
# or
yarn add @twilio/video
```

#### 3.2: Get Token and Connect

```javascript
import { connect } from '@twilio/video';

// 1. Get token from backend
const response = await fetch('/api/bookings/video-call/{video_call_id}/token', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
const { token, room_name } = await response.json();

// 2. Connect to room
const room = await connect(token, {
  name: room_name,
  audio: true,
  video: true
});

// 3. Handle participants
room.on('participantConnected', participant => {
  // Show remote video
  participant.tracks.forEach(track => {
    if (track.kind === 'video') {
      // Attach to video element
      document.getElementById('remote-video').appendChild(track.attach());
    }
  });
});

// 4. Handle local video
room.localParticipant.videoTracks.forEach(track => {
  document.getElementById('local-video').appendChild(track.attach());
});

// 5. 15-second timer
const timer = setTimeout(async () => {
  room.disconnect();
  
  // Mark call as completed
  await fetch(`/api/bookings/video-call/${video_call_id}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
}, 15000);
```

---

### Step 4: Call Completion Tracking

**Add endpoint**: `POST /api/bookings/video-call/{video_call_id}/complete`

- Updates `status` to "completed"
- Sets `completed_at` timestamp
- Can be called by either party or automatically after 15 seconds

---

## Cost Estimate

- **15-second call**: 2 participants × 0.25 minutes = 0.5 minutes
- **Cost**: 0.5 × $0.004 = **$0.002 per call**
- **1000 calls**: $2.00
- **Free trial**: $15.50 credit = ~7,750 calls

---

## Security Considerations

1. **Token Generation**: Only authenticated users can get tokens
2. **Room Access**: Tokens are scoped to specific room names
3. **User Identity**: Tokens include user_id for identification
4. **Token Expiry**: Tokens expire after 1 hour (configurable)

---

## Testing Checklist

- [ ] Twilio account created
- [ ] Credentials added to `.env`
- [ ] Token generation endpoint works
- [ ] Frontend can connect to room
- [ ] Video/audio works
- [ ] 15-second timer works
- [ ] Call completion tracked
- [ ] Multiple calls work simultaneously

---

## Next Steps After Implementation

1. Test with two users
2. Verify 15-second limit enforcement
3. Test call completion tracking
4. Monitor Twilio usage/dashboard
5. Set up usage alerts in Twilio



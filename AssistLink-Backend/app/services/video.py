import uuid
from typing import Optional
from app.config import settings

def generate_video_call_url(provider: Optional[str] = None) -> str:
    """
    Generate a video call URL based on the configured provider.
    """
    provider = provider or settings.VIDEO_PROVIDER
    
    room_id = f"assistlink-{uuid.uuid4()}"
    
    if provider == "jitsi":
        return f"https://meet.jit.si/{room_id}"
    elif provider == "twilio":
        # In a real implementation, this might call Twilio API to create a room
        # and return a token-based URL or room name.
        # For now, return a placeholder or room name.
        return f"twilio-room-{room_id}"
    else:
        # Fallback to Jitsi
        return f"https://meet.jit.si/{room_id}"

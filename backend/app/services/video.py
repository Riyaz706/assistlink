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
        # The app uses Twilio Video SDK and requests a token based on booking_id.
        # This URL is just a placeholder for the database record.
        return "Twilio Video - Join via App"
    else:
        # Fallback to Jitsi
        return f"https://meet.jit.si/{room_id}"

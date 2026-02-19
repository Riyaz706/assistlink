from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VideoGrant
from app.config import settings
from app.error_handler import ConfigurationError

def generate_twilio_token(user_identity: str, room_name: str) -> str:
    """
    Generates a secure Twilio Video Access Token.
    
    Args:
        user_identity: Unique identifier for the user (e.g. user_id)
        room_name: The name of the room to join (e.g. booking_id)
        
    Returns:
        str: The JWT access token
    """
    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_API_KEY, settings.TWILIO_API_SECRET]):
        raise ConfigurationError("Twilio credentials are not configured")

    # Create an Access Token
    token = AccessToken(
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_API_KEY,
        settings.TWILIO_API_SECRET,
        identity=user_identity,
        ttl=3600  # Token valid for 1 hour
    )

    # Create a Video Grant
    video_grant = VideoGrant(room=room_name)

    # Add the grant to the token
    token.add_grant(video_grant)

    # Serialize the token to a JWT string
    return token.to_jwt()

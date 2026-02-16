from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.services.twilio_service import generate_twilio_token
from app.database import supabase
from app.error_handler import AuthorizationError, NotFoundError, DatabaseError
import uuid
from typing import Optional

router = APIRouter(prefix="/video", tags=["Video"])

class VideoTokenRequest(BaseModel):
    booking_id: str

class VideoTokenResponse(BaseModel):
    token: str
    room_name: str
    identity: str

@router.post("/token", response_model=VideoTokenResponse)
async def get_video_token(
    request: VideoTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a Twilio Video Access Token for a specific booking.
    Validates that the user is a participant in the booking.
    """
    booking_id = request.booking_id
    user_id = current_user.get("id")

    try:
        # Verify booking exists and user is a participant
        booking_query = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        
        if not booking_query.data:
            raise NotFoundError("Booking not found")

        booking = booking_query.data[0]
        
        care_recipient_id = booking.get("care_recipient_id")
        caregiver_id = booking.get("caregiver_id")

        # Strict Access Control
        if str(user_id) != str(care_recipient_id) and str(user_id) != str(caregiver_id):
            raise AuthorizationError("You are not a participant in this booking")

        # Booking Status Check (Optional: restrict to certain statuses)
        if booking.get("status") not in ["accepted", "confirmed", "in_progress"]:
             raise AuthorizationError("Video calls are only allowed for confirmed or active bookings")

        # Room Name = Booking ID
        room_name = str(booking_id)
        identity = str(user_id)

        # Generate Token
        token = generate_twilio_token(identity, room_name)

        # Log call attempt (create/update video_call record)
        # Using upsert to handle re-joins or existing rooms
        video_call_data = {
            "booking_id": booking_id,
            "room_name": room_name,
            "status": "active", # Assuming active if token requested
            "updated_at": "now()" 
        }
        
        # Check if record exists to decide insert vs update (or just let frontend handle start/end)
        # For simplicity, we just log ensuring the table exists.
        try:
             supabase.table("video_calls").upsert(video_call_data, on_conflict="booking_id").execute()
        except Exception as e:
            print(f"Warning: Failed to log video call state: {e}")
            # Don't block token generation on logging failure

        return {
            "token": token,
            "room_name": room_name,
            "identity": identity
        }

    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(f"Error generating video token: {str(e)}")

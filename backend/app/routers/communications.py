from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.services.twilio_service import generate_twilio_token
from app.database import supabase
from app.error_handler import AuthorizationError, NotFoundError, DatabaseError
import uuid
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(tags=["Communications"])

class VideoTokenRequest(BaseModel):
    booking_id: str

class VideoTokenResponse(BaseModel):
    token: str
    room_name: str
    identity: str

class SupportRequest(BaseModel):
    email: str
    message: str

class FeedbackSubmission(BaseModel):
    content: str

@router.post("/video/token", response_model=VideoTokenResponse)
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

        # Log call attempt (create/update video_call_requests record)
        try:
             # Match by participants or booking (if linked)
             supabase.table("video_call_requests").upsert({
                 "care_recipient_id": care_recipient_id,
                 "caregiver_id": caregiver_id,
                 "status": "accepted",
                 "video_call_url": room_name,
                 "updated_at": datetime.now(timezone.utc).isoformat()
             }).execute()
        except Exception as e:
            print(f"Warning: Failed to log video call state: {e}")

        return {
            "token": token,
            "room_name": room_name,
            "identity": identity
        }

    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(f"Error generating video token: {str(e)}")

@router.post("/video/complete")
async def complete_video_call(
    request: VideoTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a video call as completed.
    """
    try:
        supabase.table("video_call_requests") \
            .update({"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("care_recipient_id", current_user.get("id")) \
            .or_(f"caregiver_id.eq.{current_user.get('id')}") \
            .execute()
        return {"message": "Video call marked as completed"}
    except Exception as e:
        raise DatabaseError(str(e))

@router.post("/support")
async def contact_support(
    support_data: SupportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit a support request.
    """
    user_id = current_user.get("id")
    print(f"[SUPPORT] Message from {support_data.email} (UID: {user_id}): {support_data.message}")
    return {"message": "Support request submitted successfully"}

@router.post("/feedback")
async def submit_app_feedback(
    feedback_data: FeedbackSubmission,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit general app feedback.
    """
    user_id = current_user.get("id")
    print(f"[FEEDBACK] App feedback from UID {user_id}: {feedback_data.content}")
    return {"message": "Feedback submitted successfully"}

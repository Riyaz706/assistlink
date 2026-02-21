"""
Communications router — Video room + support/feedback endpoints.
Video calls use WebRTC with Supabase Realtime signaling; this endpoint returns room info for clients that request it.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.database import supabase_admin
from app.error_handler import AuthorizationError, NotFoundError
import sys

router = APIRouter(tags=["Communications"])


class VideoTokenRequest(BaseModel):
    booking_id: str


class SupportRequest(BaseModel):
    email: str
    message: str


class FeedbackSubmission(BaseModel):
    content: str


@router.post("/video/token")
async def get_video_token(
    request: VideoTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Return room name and identity for WebRTC video calls.
    Clients use room_name as the signaling room ID (e.g. Supabase Realtime channel webrtc:{room_name}).
    """
    booking_id = request.booking_id
    user_id = current_user.get("id")

    try:
        booking_query = supabase_admin.table("bookings").select(
            "id, care_recipient_id, caregiver_id, status"
        ).eq("id", booking_id).execute()

        if not booking_query.data:
            raise NotFoundError("Booking not found")

        booking = booking_query.data[0]
        care_recipient_id = booking.get("care_recipient_id")
        caregiver_id = booking.get("caregiver_id")

        if str(user_id) != str(care_recipient_id) and str(user_id) != str(caregiver_id):
            raise AuthorizationError("You are not a participant in this booking")

        if booking.get("status") not in ["accepted", "confirmed", "in_progress"]:
            raise AuthorizationError("Video calls are only allowed for confirmed or active bookings")

        room_name = str(booking_id)
        identity = str(user_id)

        return {"token": None, "room_name": room_name, "identity": identity}

    except (HTTPException, NotFoundError, AuthorizationError):
        raise
    except Exception as e:
        print(f"[ERROR] video/token unexpected error: {e}", file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail="Video call setup failed")


@router.post("/video/complete")
async def complete_video_call(
    request: VideoTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark a video call as completed."""
    try:
        supabase_admin.table("video_call_requests") \
            .update({"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("care_recipient_id", current_user.get("id")) \
            .execute()
    except Exception as e:
        print(f"[WARN] video/complete error (non-fatal): {e}", file=sys.stderr, flush=True)
    return {"message": "Video call marked as completed"}


@router.post("/support")
async def contact_support(
    support_data: SupportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Submit a support request."""
    user_id = current_user.get("id")
    print(f"[SUPPORT] Message from {support_data.email} (UID: {user_id}): {support_data.message}")
    return {"message": "Support request submitted successfully"}


@router.post("/feedback")
async def submit_app_feedback(
    feedback_data: FeedbackSubmission,
    current_user: dict = Depends(get_current_user)
):
    """Submit general app feedback."""
    user_id = current_user.get("id")
    print(f"[FEEDBACK] App feedback from UID {user_id}: {feedback_data.content}")
    return {"message": "Feedback submitted successfully"}

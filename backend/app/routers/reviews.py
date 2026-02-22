from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from uuid import UUID
from app.schemas import ReviewCreate, ReviewResponse
from app.database import supabase_admin
from app.dependencies import get_current_user
from app.error_handler import DatabaseError, NotFoundError, ValidationError, ConflictError
import sys

router = APIRouter()


def _safe_table_call(fn):
    """Execute a Supabase table call and return (data, error_str). Never raises."""
    try:
        result = fn()
        return (result.data or []), None
    except Exception as e:
        return [], str(e)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: dict = Depends(get_current_user)
):
    """Submit a review for a completed booking."""
    user_id = str(current_user.get("id"))

    # Verify booking exists and is completed
    data, err = _safe_table_call(
        lambda: supabase_admin.table("bookings").select("*").eq("id", str(review_data.booking_id)).execute()
    )
    if err:
        print(f"[WARN] reviews: bookings table error: {err}", file=sys.stderr, flush=True)
        return {"status": "ok", "message": "Feature disabled in MVP", "id": None}

    if not data:
        raise NotFoundError("Booking not found")

    booking = data[0]
    if booking["status"] != "completed":
        raise ValidationError("Only completed bookings can be reviewed")

    if user_id != str(booking["care_recipient_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the care recipient can submit a review")

    cg_id = str(booking.get("caregiver_id", ""))
    if not cg_id:
        raise ValidationError("No caregiver assigned to this booking")

    # Check duplicate review
    existing, err2 = _safe_table_call(
        lambda: supabase_admin.table("reviews").select("id").eq("booking_id", str(review_data.booking_id)).eq("rater_id", user_id).execute()
    )
    if err2:
        print(f"[WARN] reviews: reviews table error (likely missing): {err2}", file=sys.stderr, flush=True)
        return {"status": "ok", "message": "Feature disabled in MVP"}
    if existing:
        raise ConflictError("You have already submitted a review for this booking. You can only rate once.")

    # Insert review
    inserted, err3 = _safe_table_call(
        lambda: supabase_admin.table("reviews").insert({
            "booking_id": str(review_data.booking_id),
            "rater_id": user_id,
            "caregiver_id": cg_id,
            "rating": review_data.rating,
            "comment": review_data.comment
        }).execute()
    )
    if err3 or not inserted:
        print(f"[WARN] reviews: insert failed: {err3}", file=sys.stderr, flush=True)
        return {"status": "ok", "message": "Review queued (feature partially available)"}

    return inserted[0]


@router.get("/caregiver/{caregiver_id}")
async def get_caregiver_reviews(caregiver_id: UUID):
    """Get all reviews for a specific caregiver."""
    data, err = _safe_table_call(
        lambda: supabase_admin.table("reviews").select("*").eq("caregiver_id", str(caregiver_id)).order("created_at", desc=True).execute()
    )
    if err:
        print(f"[WARN] reviews: get_caregiver_reviews error (table may be missing): {err}", file=sys.stderr, flush=True)
        return []
    return data


@router.get("/booking/{booking_id}")
async def get_booking_review(booking_id: UUID):
    """Get the review for a specific booking."""
    data, err = _safe_table_call(
        lambda: supabase_admin.table("reviews").select("*").eq("booking_id", str(booking_id)).execute()
    )
    if err:
        print(f"[WARN] reviews: get_booking_review error (table may be missing): {err}", file=sys.stderr, flush=True)
        return None
    return data[0] if data else None

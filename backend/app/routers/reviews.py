from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from uuid import UUID
from app.schemas import ReviewCreate, ReviewResponse
from app.database import supabase_admin
from app.dependencies import get_current_user
from app.error_handler import DatabaseError, NotFoundError, ValidationError, ConflictError

router = APIRouter()

@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit a review for a completed booking.
    In AssistLink, care recipients rate caregivers.
    """
    user_id = str(current_user.get("id"))
    
    # 1. Verify booking exists and is completed
    try:
        booking_res = supabase_admin.table("bookings").select("*").eq("id", str(review_data.booking_id)).execute()
        if not booking_res.data:
            raise NotFoundError("Booking not found")
        
        booking = booking_res.data[0]
        if booking["status"] != "completed":
            raise ValidationError("Only completed bookings can be reviewed")
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(f"Error verifying booking: {str(e)}")
    
    # 2. Verify current user is the care recipient of the booking
    if user_id != str(booking["care_recipient_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only the care recipient involved in the booking can submit a review"
        )

    # 3. Target is the caregiver
    cg_id = str(booking["caregiver_id"])
    if not cg_id:
        raise ValidationError("This booking does not have a caregiver assigned")

    # 4. Check if review already exists
    try:
        existing_review = supabase_admin.table("reviews").select("id").eq("booking_id", str(review_data.booking_id)).eq("rater_id", user_id).execute()
        if existing_review.data:
            raise ConflictError("You have already reviewed this booking")
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(f"Error checking for existing review: {str(e)}")

    # 5. Insert review
    review_dict = {
        "booking_id": str(review_data.booking_id),
        "rater_id": user_id,
        "caregiver_id": cg_id,
        "rating": review_data.rating,
        "comment": review_data.comment
    }
    
    try:
        response = supabase_admin.table("reviews").insert(review_dict).execute()
        if not response.data:
            raise DatabaseError("Failed to submit review")
        return response.data[0]
    except Exception as e:
        raise DatabaseError(f"Error submitting review: {str(e)}")

@router.get("/caregiver/{caregiver_id}", response_model=List[ReviewResponse])
async def get_caregiver_reviews(caregiver_id: UUID):
    """Get all reviews for a specific caregiver."""
    try:
        response = supabase_admin.table("reviews").select("*").eq("caregiver_id", str(caregiver_id)).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise DatabaseError(f"Error fetching reviews: {str(e)}")

@router.get("/booking/{booking_id}", response_model=Optional[ReviewResponse])
async def get_booking_review(booking_id: UUID):
    """Get the review for a specific booking."""
    try:
        response = supabase_admin.table("reviews").select("*").eq("booking_id", str(booking_id)).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise DatabaseError(f"Error fetching booking review: {str(e)}")

from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from app.schemas import DashboardStats, BookingResponse
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user
from app.error_handler import DatabaseError

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics for current user"""
    try:
        user_id = current_user["id"]
        
        # Get user role
        user_response = supabase.table("users").select("role").eq("id", user_id).execute()
        role = user_response.data[0].get("role") if user_response.data else None
        
        if not role:
             print(f"[WARN] User role not found for ID: {user_id}")
             return DashboardStats(upcoming_bookings=0, active_bookings=0, completed_bookings=0, pending_video_calls=0, active_chat_sessions=0)
        
        # Get bookings based on role (with limit for performance)
        if role == "care_recipient":
            bookings_query = supabase.table("bookings").select("*").eq("care_recipient_id", user_id).limit(1000)
        else:
            bookings_query = supabase.table("bookings").select("*").eq("caregiver_id", user_id).limit(1000)
        
        all_bookings = bookings_query.execute().data or []
        
        # Count bookings by status
        now = datetime.now(timezone.utc)
        upcoming_bookings = len([
            b for b in all_bookings 
            if b.get("status") in ["pending", "accepted"] 
            and b.get("scheduled_date")
            and datetime.fromisoformat(b["scheduled_date"].replace("Z", "+00:00")) > now
        ])
        active_bookings = len([b for b in all_bookings if b.get("status") == "in_progress"])
        completed_bookings = len([b for b in all_bookings if b.get("status") == "completed"])
        
        # Get pending video calls
        if role == "care_recipient":
            video_calls_query = supabase.table("video_call_requests").select("*").eq("care_recipient_id", user_id).eq("status", "pending")
        else:
            video_calls_query = supabase.table("video_call_requests").select("*").eq("caregiver_id", user_id).eq("status", "pending")
        
        pending_video_calls = len(video_calls_query.execute().data or [])
        
        # Get active chat sessions
        if role == "care_recipient":
            chat_query = supabase.table("chat_sessions").select("*").eq("care_recipient_id", user_id).eq("is_enabled", True)
        else:
            chat_query = supabase.table("chat_sessions").select("*").eq("caregiver_id", user_id).eq("is_enabled", True)
        
        active_chat_sessions = len(chat_query.execute().data or [])
        
        # Get caregiver profile stats if user is a caregiver
        total_earnings = 0.0
        avg_rating = 0.0
        hourly_rate = 500.0 # Default fallback
        
        if role == "caregiver":
            try:
                profile_response = supabase_admin.table("caregiver_profile").select("avg_rating, hourly_rate").eq("user_id", user_id).execute()
                if profile_response.data:
                    profile = profile_response.data[0]
                    avg_rating = profile.get("avg_rating", 0.0) or 0.0
                    hourly_rate = profile.get("hourly_rate", 500.0) or 500.0
            except Exception as e:
                print(f"[WARN] Failed to fetch caregiver profile for stats: {e}")
        
        # Calculate earnings from completed payments
        # We iterate over all_bookings (already fetched above)
        if role == "caregiver":
            for b in all_bookings:
                # Check for completed payment
                if b.get("payment_status") == "completed":
                    amount = b.get("amount")
                    if amount:
                        total_earnings += float(amount)
                    else:
                        # Fallback if amount is missing but payment is completed
                        duration = b.get("duration_hours", 0)
                        total_earnings += float(duration) * hourly_rate
                # Also check for completed bookings without explicit payment_status (legacy/manual)
                elif b.get("status") == "completed" and not b.get("payment_status"):
                    # For legacy completed bookings, assume paid? Or just skip?
                    # Let's be conservative and only count explicit payments or if we want to be generous for display:
                    # total_earnings += float(b.get("duration_hours", 0)) * hourly_rate
                    pass
        
        return DashboardStats(
            upcoming_bookings=upcoming_bookings,
            active_bookings=active_bookings,
            completed_bookings=completed_bookings,
            pending_video_calls=pending_video_calls,
            active_chat_sessions=active_chat_sessions,
            total_earnings=total_earnings,
            avg_rating=avg_rating
        )
    
    except Exception as e:
        raise DatabaseError(str(e))


@router.get("/bookings", response_model=List[dict])
async def get_dashboard_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    is_recurring: Optional[bool] = Query(None),
    upcoming_only: Optional[bool] = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get bookings for dashboard"""
    try:
        user_id = current_user["id"]
        
        # Get user role
        user_response = supabase_admin.table("users").select("role").eq("id", user_id).execute()
        role = user_response.data[0].get("role") if user_response.data else None
        
        if not role:
            print(f"[WARN] User role not found for ID: {user_id}")
            return []
        
        # Build query
        if role == "care_recipient":
            query = supabase_admin.table("bookings").select("*, caregiver:caregiver_id(*), video_call_request:video_call_request_id(*), chat_session:chat_session_id(*)").eq("care_recipient_id", user_id)
        else:
            query = supabase_admin.table("bookings").select("*, care_recipient:care_recipient_id(*), video_call_request:video_call_request_id(*), chat_session:chat_session_id(*)").eq("caregiver_id", user_id)
        
        if status_filter:
            # Allow multiple statuses separated by comma
            statuses = status_filter.split(',')
            if len(statuses) > 1:
                query = query.in_("status", statuses)
            else:
                query = query.eq("status", status_filter)
        
        if is_recurring is not None:
            query = query.eq("is_recurring", is_recurring)

        if upcoming_only:
             now = datetime.now(timezone.utc)
             query = query.gte("scheduled_date", now.isoformat())
        
        query = query.order("scheduled_date", desc=False).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        bookings = response.data or []
        print(f"[INFO] Dashboard bookings query - User ID: {user_id}, Role: {role}", flush=True)
        print(f"[INFO] Total bookings returned: {len(bookings)}", flush=True)
        for idx, booking in enumerate(bookings):
            print(f"[INFO] Booking {idx + 1}: ID={booking.get('id')}, Status={booking.get('status')}, Service Type={booking.get('service_type')}, Video Call ID={booking.get('video_call_request_id')}", flush=True)
        
        return bookings
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/upcoming", response_model=List[dict])
async def get_upcoming_bookings(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get upcoming bookings (next 7 days)"""
    try:
        user_id = current_user["id"]
        now = datetime.now(timezone.utc)
        next_week = now + timedelta(days=7)
        
        # Get user role
        user_response = supabase_admin.table("users").select("role").eq("id", user_id).execute()
        role = user_response.data[0].get("role") if user_response.data else None
        
        if not role:
            return []
        
        # Build query
        if role == "care_recipient":
            query = supabase_admin.table("bookings").select("*, caregiver:caregiver_id(*)").eq("care_recipient_id", user_id)
        else:
            query = supabase_admin.table("bookings").select("*, care_recipient:care_recipient_id(*)").eq("caregiver_id", user_id)
        
        query = query.gte("scheduled_date", now.isoformat()).lte("scheduled_date", next_week.isoformat()).in_("status", ["pending", "accepted", "in_progress"]).order("scheduled_date", desc=False).limit(limit)
        
        response = query.execute()
        
        return response.data or []
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/recurring", response_model=List[dict])
async def get_recurring_bookings(
    current_user: dict = Depends(get_current_user)
):
    """Get all recurring bookings"""
    try:
        user_id = current_user["id"]
        
        # Get user role
        user_response = supabase_admin.table("users").select("role").eq("id", user_id).execute()
        role = user_response.data[0].get("role") if user_response.data else None
        
        if not role:
            return []
        
        # Build query
        if role == "care_recipient":
            query = supabase_admin.table("bookings").select("*, caregiver:caregiver_id(*)").eq("care_recipient_id", user_id).eq("is_recurring", True).limit(500)
        else:
            query = supabase_admin.table("bookings").select("*, care_recipient:care_recipient_id(*)").eq("caregiver_id", user_id).eq("is_recurring", True).limit(500)
        
        query = query.order("scheduled_date", desc=False)
        
        response = query.execute()
        
        return response.data or []
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/video-calls", response_model=List[dict])
async def get_dashboard_video_calls(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get video call requests for dashboard"""
    try:
        user_id = current_user["id"]
        
        # Get user role
        user_response = supabase_admin.table("users").select("role").eq("id", user_id).execute()
        role = user_response.data[0].get("role") if user_response.data else None
        
        if not role:
            return []
        
        # Build query - include other party's info
        if role == "care_recipient":
            query = supabase_admin.table("video_call_requests").select("*, caregiver:caregiver_id(*)").eq("care_recipient_id", user_id)
        else:
            query = supabase_admin.table("video_call_requests").select("*, care_recipient:care_recipient_id(*)").eq("caregiver_id", user_id)
        
        if status_filter:
            query = query.eq("status", status_filter)
        
        query = query.order("scheduled_time", desc=False).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        return response.data or []
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

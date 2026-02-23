from fastapi import APIRouter, HTTPException, status, Depends, Query, Response
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from app.schemas import CaregiverProfileCreate, CaregiverProfileUpdate, CaregiverProfileResponse, SlotListItem
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user, get_optional_user, verify_caregiver

router = APIRouter()


def _normalize_profile(raw_profile):
    """Handle Supabase relationships that may return a dict or a list."""
    if not raw_profile:
        return None
    if isinstance(raw_profile, list):
        return raw_profile[0] if raw_profile else None
    if isinstance(raw_profile, dict):
        return raw_profile
    return None


@router.post("/profile", response_model=CaregiverProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_caregiver_profile(
    profile_data: CaregiverProfileCreate,
    current_user: dict = Depends(verify_caregiver)
):
    """Create or update caregiver profile"""
    try:
        profile_dict = profile_data.model_dump(exclude_unset=True)
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in authentication token"
            )
        
        profile_dict["user_id"] = user_id
        
        # Check if profile exists
        existing = supabase.table("caregiver_profile").select("id").eq("user_id", user_id).execute()
        
        if existing.data:
            # Update existing profile
            response = supabase.table("caregiver_profile").update(profile_dict).eq("user_id", user_id).execute()
        else:
            # Create new profile
            response = supabase.table("caregiver_profile").insert(profile_dict).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create/update caregiver profile"
            )
        
        return response.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Provide more specific error messages
        if "row-level security" in error_msg.lower() or "rls" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied. Check Row Level Security policies."
            )
        elif "duplicate key" in error_msg.lower() or "unique constraint" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profile already exists for this user"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating/updating caregiver profile: {error_msg}"
        )


@router.put("/profile", response_model=CaregiverProfileResponse)
async def update_caregiver_profile(
    profile_data: CaregiverProfileUpdate,
    current_user: dict = Depends(verify_caregiver)
):
    """Update caregiver profile"""
    try:
        # Get user_id first
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in authentication token"
            )
        
        # Check if profile exists first
        existing_check = supabase.table("caregiver_profile").select("id").eq("user_id", user_id).execute()
        
        if not existing_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caregiver profile not found. Create a profile first using POST /api/caregivers/profile"
            )
        
        # Get update data - include all fields that are set (even if they match defaults)
        update_data = profile_data.model_dump(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Update the profile
        response = supabase.table("caregiver_profile").update(update_data).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update caregiver profile. No data returned."
            )
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Provide more specific error messages
        if "row-level security" in error_msg.lower() or "rls" in error_msg.lower() or "permission denied" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied. Make sure you're authenticated as a caregiver and the profile belongs to you."
            )
        elif "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caregiver profile not found. Create a profile first using POST /api/caregivers/profile"
            )
        elif "check constraint" in error_msg.lower() or "invalid input" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid data: {error_msg}"
            )
        # Log the full error for debugging
        import traceback
        print(f"Error updating caregiver profile: {error_msg}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating caregiver profile: {error_msg}"
        )


@router.get("/profile", response_model=CaregiverProfileResponse)
async def get_my_caregiver_profile(current_user: dict = Depends(verify_caregiver)):
    """Get current caregiver's profile"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in authentication token"
            )
        
        response = supabase.table("caregiver_profile").select("*").eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caregiver profile not found. Create a profile first using POST /api/caregivers/profile"
            )
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "no rows" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caregiver profile not found. Create a profile first using POST /api/caregivers/profile"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving caregiver profile: {error_msg}"
        )


@router.get("", response_model=List[dict])
async def list_caregivers(
    availability_status: Optional[str] = Query(None, pattern="^(available|unavailable|busy)$"),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    skills: Optional[str] = Query(None, description="Comma-separated list of skills"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """List available caregivers with filters"""
    try:
        # Use supabase_admin to bypass RLS for listing all caregivers
        # This is safe because we're only reading public caregiver information
        from app.database import supabase_admin

        # Get all active caregivers with their profiles
        query = supabase_admin.table("users").select("*, caregiver_profile(*)").eq("role", "caregiver").eq("is_active", True)

        # Execute query to get all caregivers first
        response = query.execute()
        all_caregivers = response.data or []
        
        print(f"[INFO] Found {len(all_caregivers)} total active caregivers", flush=True)
        
        # Debug: Log first caregiver structure to see how caregiver_profile is returned
        if all_caregivers:
            first_caregiver = all_caregivers[0]
            print(f"[DEBUG] First caregiver structure - caregiver_profile type: {type(first_caregiver.get('caregiver_profile'))}, value: {first_caregiver.get('caregiver_profile')}", flush=True)

        # Filter by availability status
        # First, filter by availability_status if specified, otherwise show all active caregivers
        if availability_status:
            # If specific status is requested, filter by it
            if availability_status == "available":
                # Show caregivers with "available" status OR no profile (default to available)
                caregivers = []
                for caregiver in all_caregivers:
                    profile = _normalize_profile(caregiver.get("caregiver_profile"))
                    if not profile or profile.get("availability_status") == "available":
                        caregivers.append(caregiver)
            else:
                # For "unavailable" or "busy", only show those with profiles matching the status
                caregivers = []
                for caregiver in all_caregivers:
                    profile = _normalize_profile(caregiver.get("caregiver_profile"))
                    if profile and profile.get("availability_status") == availability_status:
                        caregivers.append(caregiver)
        else:
            # Default: show "available" and "busy" caregivers (exclude only "unavailable")
            # So caregivers like "riyaz" still appear when marked busy; active commitments filter runs next
            caregivers = []
            for caregiver in all_caregivers:
                profile = _normalize_profile(caregiver.get("caregiver_profile"))
                current_caregiver_status = profile.get("availability_status") if profile else None

                # Include if no profile, "available", or "busy"; only exclude "unavailable"
                if current_caregiver_status != "unavailable":
                    caregivers.append(caregiver)
        
        print(f"[INFO] After availability_status filter: {len(caregivers)} caregivers", flush=True)

        # Filter by skills if provided
        if skills:
            skill_list = [s.strip().lower() for s in skills.split(",")]
            filtered_caregivers = []
            for caregiver in caregivers:
                profile = _normalize_profile(caregiver.get("caregiver_profile"))
                if profile and profile.get("skills"):
                    caregiver_skills = [s.lower() for s in profile["skills"]]
                    if any(skill in caregiver_skills for skill in skill_list):
                        filtered_caregivers.append(caregiver)
            caregivers = filtered_caregivers

        # Apply min_rating filter if specified
        if min_rating:
            caregivers = [
                c
                for c in caregivers
                if (_normalize_profile(c.get("caregiver_profile")) or {}).get("avg_rating", 0) >= min_rating
            ]

        # Filter out caregivers who have ACTIVE (non-completed) video calls or bookings
        # These caregivers are already engaged and should not appear in search
        filtered_caregivers = []
        for caregiver in caregivers:
            caregiver_id = caregiver.get("id")
            if not caregiver_id:
                continue

            try:
                # Check if caregiver has any ACTIVE (non-completed) video calls
                # Get all accepted video calls for this caregiver
                all_video_calls = (
                    supabase_admin.table("video_call_requests")
                    .select("id, status, completed_at")
                    .eq("caregiver_id", caregiver_id)
                    .eq("care_recipient_accepted", True)
                    .eq("caregiver_accepted", True)
                    .eq("status", "accepted")
                    .execute()
                )

                # Filter out video calls that are truly active (not completed)
                active_video_calls = []
                if all_video_calls.data:
                    for vc in all_video_calls.data:
                        # Check if video call is completed (has completed_at or status is completed)
                        if vc.get("completed_at") or vc.get("status") == "completed":
                            continue  # Skip completed video calls

                        # Check if related booking is completed
                        video_call_id = vc.get("id")
                        if video_call_id:
                            try:
                                related_booking = (
                                    supabase_admin.table("bookings")
                                    .select("id, status")
                                    .eq("video_call_request_id", video_call_id)
                                    .execute()
                                )
                                # If there's a related booking and it's completed, skip this video call
                                if related_booking.data:
                                    all_completed = all(
                                        booking.get("status") == "completed" for booking in related_booking.data
                                    )
                                    if all_completed:
                                        continue  # All related bookings are completed, skip this video call
                            except Exception:
                                # If no related booking found, video call is still active
                                pass

                        # This video call is still active
                        active_video_calls.append(vc)

                # If caregiver has active (non-completed) video calls, exclude them
                if len(active_video_calls) > 0:
                    # ASCII-only logging to avoid encoding issues on Windows terminals
                    print(
                        f"[WARN] Excluding caregiver {caregiver_id} - has {len(active_video_calls)} active video calls",
                        flush=True,
                    )
                    continue  # Skip this caregiver

                # Check for active bookings (requested, accepted, or in_progress - but NOT completed)
                # DB enum uses "requested" not "pending"
                active_bookings = (
                    supabase_admin.table("bookings")
                    .select("id")
                    .eq("caregiver_id", caregiver_id)
                    .in_("status", ["requested", "accepted", "in_progress"])
                    .execute()
                )

                # If caregiver has active bookings, exclude them
                if active_bookings.data and len(active_bookings.data) > 0:
                    print(
                        f"[WARN] Excluding caregiver {caregiver_id} - has {len(active_bookings.data)} active bookings",
                        flush=True,
                    )
                    continue  # Skip this caregiver

                # Caregiver has no active commitments - they should be available
                # Check manual availability status, but if they have no commitments, they're effectively available
                profile = _normalize_profile(caregiver.get("caregiver_profile"))
                availability_status_value = profile.get("availability_status") if profile else None

                # Only exclude if manually set to "unavailable" AND they have no active commitments
                # (If they have active commitments, they're already excluded above)
                # If availability_status is "busy" or None, still include them if no active commitments
                if availability_status_value == "unavailable":
                    print(
                        f"[WARN] Excluding caregiver {caregiver_id} - manually set as unavailable",
                        flush=True,
                    )
                    continue

                # Caregiver is available - include them
                caregiver_name = caregiver.get("full_name", "Unknown")
                print(
                    f"[INFO] Including caregiver {caregiver_id} ({caregiver_name}) - no active commitments, availability_status={availability_status_value!r}",
                    flush=True,
                )
                filtered_caregivers.append(caregiver)
            except Exception as filter_error:
                # If filtering fails, include the caregiver to be safe (don't exclude due to errors)
                print(
                    f"[WARN] Error filtering caregiver {caregiver_id}, including anyway: {filter_error!r}",
                    flush=True,
                )
                import traceback
                traceback.print_exc()
                filtered_caregivers.append(caregiver)

        caregivers = filtered_caregivers

        print(f"[INFO] Total caregivers after filtering: {len(caregivers)}", flush=True)

        # Apply pagination
        caregivers = caregivers[offset : offset + limit]

        return caregivers

    except Exception as e:
        # Log full traceback for easier debugging (ASCII-only)
        import traceback
        print("[ERROR] Error in list_caregivers:", repr(e), flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


def _slot_overlap(s_start: datetime, s_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Overlap: (startA < endB) AND (endA > startB). All UTC."""
    return s_start < b_end and s_end > b_start


@router.get("/{caregiver_id}/slots", response_model=List[SlotListItem])
async def get_caregiver_slots(
    caregiver_id: str,
    response: Response,
    from_date: str = Query(..., description="Start of range (ISO datetime UTC)"),
    to_date: str = Query(..., description="End of range (ISO datetime UTC)"),
    slot_duration_minutes: int = Query(60, ge=15, le=240, description="Slot length in minutes"),
    current_user: dict = Depends(get_current_user),
):
    """
    List slots for a caregiver with availability. Backend is the single source of truth.
    Returns [{ start, end, available }] in UTC. Excludes past slots (available=false for past).
    Overlap rule: (startA < endB) AND (endA > startB). Pending + confirmed bookings block slots.
    """
    try:
        from_parsed = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
        to_parsed = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid from_date or to_date; use ISO format (UTC).")
    if from_parsed.tzinfo is None:
        from_parsed = from_parsed.replace(tzinfo=timezone.utc)
    if to_parsed.tzinfo is None:
        to_parsed = to_parsed.replace(tzinfo=timezone.utc)
    if from_parsed >= to_parsed:
        raise HTTPException(status_code=400, detail="from_date must be before to_date.")
    if slot_duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="slot_duration_minutes must be positive.")

    # Caregiver exists and is caregiver role
    user_row = supabase_admin.table("users").select("id, role, is_active").eq("id", caregiver_id).execute()
    if not user_row.data or user_row.data[0].get("role") != "caregiver":
        raise HTTPException(status_code=404, detail="Caregiver not found.")
    if not user_row.data[0].get("is_active", True):
        raise HTTPException(status_code=422, detail="Caregiver is not available.")

    now_utc = datetime.now(timezone.utc)
    delta = timedelta(minutes=slot_duration_minutes)
    slot_start = from_parsed
    slots: List[dict] = []

    # Fetch all blocking bookings in range (requested, accepted, confirmed, in_progress)
    range_start = from_parsed - timedelta(days=1)
    range_end = to_parsed + timedelta(days=1)
    bookings_res = supabase_admin.table("bookings").select("scheduled_date, duration_hours").eq(
        "caregiver_id", caregiver_id
    ).in_("status", ["requested", "accepted", "confirmed", "in_progress"]).gte(
        "scheduled_date", range_start.isoformat()
    ).lte("scheduled_date", range_end.isoformat()).execute()
    blocking: List[tuple] = []
    for b in (bookings_res.data or []):
        start_str = (b.get("scheduled_date") or "").replace("Z", "+00:00")
        if not start_str:
            continue
        b_start = datetime.fromisoformat(start_str)
        if b_start.tzinfo is None:
            b_start = b_start.replace(tzinfo=timezone.utc)
        dur = float(b.get("duration_hours") or 0)
        if dur <= 0:
            continue
        b_end = b_start + timedelta(hours=dur)
        blocking.append((b_start, b_end))

    while slot_start + delta <= to_parsed:
        slot_end = slot_start + delta
        # Past slots are not available for booking
        if slot_end <= now_utc:
            slots.append({"start": slot_start, "end": slot_end, "available": False})
        else:
            available = True
            for b_start, b_end in blocking:
                if _slot_overlap(slot_start, slot_end, b_start, b_end):
                    available = False
                    break
            slots.append({"start": slot_start, "end": slot_end, "available": available})
        slot_start = slot_end

    result = [SlotListItem(start=s["start"], end=s["end"], available=s["available"]) for s in slots]
    response.headers["Cache-Control"] = "max-age=60"
    return result


@router.get("/{caregiver_id}/busy-slots", response_model=List[dict])
async def get_caregiver_busy_slots(
    caregiver_id: str,
    from_date: str = Query(..., description="Start of range (ISO datetime or date)"),
    to_date: str = Query(..., description="End of range (ISO datetime or date)"),
    current_user: dict = Depends(get_current_user),
):
    """Get time slots when the caregiver is already booked (accepted/confirmed/in_progress). Used to show free vs busy before booking."""
    try:
        from_parsed = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
        to_parsed = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid from_date or to_date; use ISO format.")
    if from_parsed.tzinfo is None:
        from_parsed = from_parsed.replace(tzinfo=timezone.utc)
    if to_parsed.tzinfo is None:
        to_parsed = to_parsed.replace(tzinfo=timezone.utc)
    if from_parsed >= to_parsed:
        raise HTTPException(status_code=400, detail="from_date must be before to_date.")
    res = supabase_admin.table("bookings").select("scheduled_date, duration_hours").eq("caregiver_id", caregiver_id).in_("status", ["accepted", "confirmed", "in_progress"]).gte("scheduled_date", from_parsed.isoformat()).lte("scheduled_date", to_parsed.isoformat()).execute()
    now_utc = datetime.now(timezone.utc)
    slots = []
    for b in res.data or []:
        start_str = (b.get("scheduled_date") or "").replace("Z", "+00:00")
        if not start_str:
            continue
        start = datetime.fromisoformat(start_str)
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        dur = float(b.get("duration_hours") or 0)
        if dur <= 0:
            continue
        if dur > 24:
            dur = 24
        end = start + timedelta(hours=dur)
        if end <= now_utc:
            continue
        slots.append({"start": start.isoformat(), "end": end.isoformat()})
    return slots


@router.get("/{caregiver_id}", response_model=dict)
async def get_caregiver(
    caregiver_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Get caregiver details by ID (for care recipients viewing a caregiver profile). Uses admin client so RLS does not block."""
    try:
        response = supabase_admin.table("users").select("*, caregiver_profile(*)").eq("id", caregiver_id).eq("role", "caregiver").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caregiver not found"
            )
        row = response.data[0]
        # Normalize caregiver_profile to a single object for consistent API shape
        raw = row.get("caregiver_profile")
        row["caregiver_profile"] = _normalize_profile(raw)
        return row
    except HTTPException:
        raise
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caregiver not found"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )



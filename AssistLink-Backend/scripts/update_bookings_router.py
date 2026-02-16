import os

FILE_PATH = "app/routers/bookings.py"

NEW_CONTENT = '''
# --- HELPER ---
async def _log_booking_history(booking_id: str, old_status: str | None, new_status: str, changed_by: str, reason: str | None = None):
    """Helper to log status changes to booking_history"""
    try:
        history_data = {
            "booking_id": booking_id,
            "previous_status": old_status,
            "new_status": new_status,
            "changed_by": changed_by,
            "reason": reason
        }
        supabase_admin.table("booking_history").insert(history_data).execute()
    except Exception as e:
        print(f"[WARN] Failed to log booking history: {e}", flush=True)


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: dict = Depends(verify_care_recipient)
):
    """
    Create a booking.
    - Validates caregiver availability.
    - Prevents double booking.
    - Supports initial status 'draft' or 'requested'.
    """
    print(f"[INFO] Creating booking for user {current_user.get('id')}", flush=True)
    try:
        user_id = current_user.get("id")
        booking_dict = booking_data.model_dump(exclude_unset=True)
        
        # 1. Format Data
        if "scheduled_date" in booking_dict and isinstance(booking_dict["scheduled_date"], datetime):
            booking_dict["scheduled_date"] = booking_dict["scheduled_date"].isoformat()
        
        # Ensure UUIDs are strings
        from uuid import UUID
        for key, value in booking_dict.items():
            if isinstance(value, UUID):
                booking_dict[key] = str(value)
        
        booking_dict["care_recipient_id"] = str(user_id)
        
        # Default status for creation is 'requested' unless specified as 'draft'
        initial_status = booking_dict.get("status", "requested")
        booking_dict["status"] = initial_status

        caregiver_id = booking_dict.get("caregiver_id")

        # 2. Availability & Double Booking Check (Only if not draft)
        if initial_status == "requested" and caregiver_id:
            # Check if caregiver exists and is active
            cg_check = supabase.table("users").select("id, is_active").eq("id", caregiver_id).eq("role", "caregiver").execute()
            if not cg_check.data or not cg_check.data[0]["is_active"]:
                 raise ValidationError("Caregiver is not available or inactive.")

            # Check for overlapping bookings for this caregiver
            # Fetch bookings for this caregiver on the same day (+/- 24 hrs)
            scheduled_time = booking_data.scheduled_date
            duration_hours = booking_data.duration_hours
            
            day_start = scheduled_time - timedelta(days=1)
            day_end = scheduled_time + timedelta(days=1)
            
            existing_bookings = supabase_admin.table("bookings").select("scheduled_date, duration_hours").eq("caregiver_id", caregiver_id).in_("status", ["accepted", "confirmed", "in_progress"]).gte("scheduled_date", day_start.isoformat()).lte("scheduled_date", day_end.isoformat()).execute()
            
            req_start = scheduled_time
            req_end = req_start + timedelta(hours=duration_hours)
            
            for b in existing_bookings.data:
                # Naive datetime handling - assuming UTC or matching naive
                b_start_str = b["scheduled_date"].replace('Z', '+00:00')
                b_start = datetime.fromisoformat(b_start_str)
                b_end = b_start + timedelta(hours=b["duration_hours"])
                
                # Check overlap
                if req_start < b_end and req_end > b_start:
                    raise ConflictError("Caregiver is already booked for this time slot.")

        # 3. Link Video Call / Chat if applicable
        if caregiver_id:
            try:
                # Check accepted video call
                video_call_check = supabase.table("video_call_requests").select("*").eq("care_recipient_id", user_id).eq("caregiver_id", caregiver_id).eq("status", "accepted").order("created_at", desc=True).limit(1).execute()
                if video_call_check.data:
                    booking_dict["video_call_request_id"] = video_call_check.data[0]["id"]
                
                # Check enabled chat session
                chat_check = supabase.table("chat_sessions").select("*").eq("care_recipient_id", user_id).eq("caregiver_id", caregiver_id).eq("is_enabled", True).limit(1).execute()
                if chat_check.data:
                    booking_dict["chat_session_id"] = chat_check.data[0]["id"]
            except Exception as e:
                print(f"[WARN] Error validation video/chat linkage: {e}")

        # 4. Insert Booking
        print(f"[INFO] Inserting booking: {booking_dict}", flush=True)
        response = supabase.table("bookings").insert(booking_dict).execute()
        
        if not response.data:
            raise DatabaseError("Failed to create booking")
        
        booking = response.data[0]
        booking_id = booking["id"]

        # 5. Log History
        await _log_booking_history(booking_id, None, initial_status, str(user_id), "Initial booking creation")

        # 6. Post-Creation Actions (Notifications, Availability)
        if initial_status == "requested" and caregiver_id:
             # Notify Caregiver
            try:
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", user_id).execute()
                care_recipient_name = care_recipient_response.data[0].get("full_name", "A care recipient") if care_recipient_response.data else "A care recipient"
                
                await notify_booking_created(
                    caregiver_id=caregiver_id,
                    care_recipient_name=care_recipient_name,
                    booking_id=booking_id
                )
            except Exception as e:
                 print(f"[WARN] Failed to send notification: {e}", flush=True)
                 import traceback
                 traceback.print_exc()

        return booking

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise DatabaseError(f"Error creating booking: {str(e)}")


@router.post("/{booking_id}/respond", response_model=BookingResponse)
async def respond_to_booking(
    booking_id: str,
    response_data: BookingStatusUpdate,
    current_user: dict = Depends(verify_caregiver)
):
    """
    Caregiver accepts or rejects a booking request.
    - Transitions: requested -> accepted OR rejected
    """
    try:
        user_id = current_user.get("id")
        
        res = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not res.data:
            raise NotFoundError("Booking not found")
        booking = res.data[0]
        
        if booking["caregiver_id"] != user_id:
            raise AuthorizationError("You are not assigned to this booking")
            
        if booking["status"] != "requested":
            raise ConflictError(f"Cannot respond to booking in '{booking['status']}' state. Only 'requested' bookings can be accepted/rejected.")
            
        new_status = response_data.status
        if new_status not in ["accepted", "rejected"]:
             raise ValidationError("Response status must be 'accepted' or 'rejected'")
             
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if new_status == "accepted":
            update_data["accepted_at"] = datetime.now(timezone.utc).isoformat()
        elif new_status == "rejected":
            update_data["rejection_reason"] = response_data.reason

        updated_res = supabase_admin.table("bookings").update(update_data).eq("id", booking_id).execute()
        if not updated_res.data:
            raise DatabaseError("Failed to update booking")
            
        updated_booking = updated_res.data[0]
        
        await _log_booking_history(booking_id, booking["status"], new_status, user_id, response_data.reason)
        
        # Notify Care Recipient
        try:
            caregiver_name = current_user.get("full_name", "Caregiver")
            await notify_booking_status_change(
                user_id=booking["care_recipient_id"],
                booking_id=booking_id,
                status=new_status,
                other_party_name=caregiver_name
            )
        except Exception as e:
            print(f"[WARN] Failed to notify status change: {e}", flush=True)

        return updated_booking

    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(f"Error responding to booking: {str(e)}")


@router.patch("/{booking_id}/status", response_model=BookingResponse)
async def update_booking_status(
    booking_id: str,
    status_update: BookingStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update booking status (Start, Complete, Cancel).
    - Enforces state transitions.
    """
    try:
        user_id = current_user.get("id")
        user_role = current_user.get("role")
        
        res = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not res.data:
            raise NotFoundError("Booking not found")
        booking = res.data[0]
        
        if booking["caregiver_id"] != user_id and booking["care_recipient_id"] != user_id:
             raise AuthorizationError("Access denied")
             
        current_status = booking["status"]
        new_status = status_update.status
        
        allowed = False
        
        if new_status == "in_progress":
            if user_role != "caregiver":
                raise AuthorizationError("Only caregivers can start a service")
            if current_status == "confirmed":
                allowed = True
            else:
                raise ConflictError("Booking must be 'confirmed' (paid) before starting.")
                
        elif new_status == "completed":
            if user_role != "caregiver":
                raise AuthorizationError("Only caregivers can complete a service")
            if current_status == "in_progress":
                allowed = True
            else:
                 raise ConflictError("Booking must be 'in_progress' before completion.")
                 
        elif new_status == "cancelled":
            if current_status in ["completed", "cancelled"]:
                raise ConflictError("Cannot cancel a completed or already cancelled booking.")
            allowed = True
            
        elif new_status == "confirmed":
             raise ConflictError("Confirmation should be done via payment.")
        
        else:
             raise ValidationError(f"Invalid status transition to '{new_status}'")
             
        if not allowed:
             raise ConflictError(f"Transition from '{current_status}' to '{new_status}' is not allowed.")
             
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if new_status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        if new_status == "cancelled":
            update_data["cancellation_reason"] = status_update.reason
            
        updated_res = supabase_admin.table("bookings").update(update_data).eq("id", booking_id).execute()
        updated_booking = updated_res.data[0]
        
        await _log_booking_history(booking_id, current_status, new_status, user_id, status_update.reason)
        
        try:
            other_id = booking["care_recipient_id"] if user_role == "caregiver" else booking["caregiver_id"]
            if other_id:
                my_name = current_user.get("full_name", "User")
                await notify_booking_status_change(
                    user_id=other_id,
                    booking_id=booking_id,
                    status=new_status,
                    other_party_name=my_name
                )
        except Exception as e:
             print(f"[WARN] Failed to notify: {e}", flush=True)

        return updated_booking

    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(f"Error updating status: {str(e)}")


@router.get("/{booking_id}/history", response_model=list[BookingHistoryResponse])
async def get_booking_history(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get history of status changes"""
    try:
        booking = supabase.table("bookings").select("caregiver_id, care_recipient_id").eq("id", booking_id).execute()
        if not booking.data:
             raise NotFoundError("Booking not found")
        b = booking.data[0]
        if b["caregiver_id"] != current_user["id"] and b["care_recipient_id"] != current_user["id"]:
             raise AuthorizationError("Access denied")
             
        res = supabase.table("booking_history").select("*").eq("booking_id", booking_id).order("created_at", desc=False).execute()
        return res.data
    except Exception as e:
        raise DatabaseError(str(e))


@router.post("/{booking_id}/notes", response_model=BookingNoteResponse)
async def add_booking_note(
    booking_id: str,
    note: BookingNoteCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a note to the booking"""
    try:
        booking = supabase.table("bookings").select("caregiver_id, care_recipient_id").eq("id", booking_id).execute()
        if not booking.data:
             raise NotFoundError("Booking not found")
        b = booking.data[0]
        if b["caregiver_id"] != current_user["id"] and b["care_recipient_id"] != current_user["id"]:
             raise AuthorizationError("Access denied")
             
        data = {
             "booking_id": booking_id,
             "user_id": current_user["id"],
             "note": note.note,
             "is_private": note.is_private
        }
        res = supabase.table("booking_notes").insert(data).execute()
        return res.data[0]
    except Exception as e:
        raise DatabaseError(str(e))
'''

with open(FILE_PATH, 'r') as f:
    content = f.read()

# Marker used to truncate
marker = '@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)'

if marker not in content:
    print("Marker not found! Aborting.")
    exit(1)

parts = content.split(marker)
header = parts[0]

final_content = header + NEW_CONTENT

with open(FILE_PATH, 'w') as f:
    f.write(final_content)

print("Successfully rewrote bookings.py to include new implementation.")

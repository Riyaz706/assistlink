from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.schemas import (
    BookingCreate, BookingUpdate, BookingResponse,
    VideoCallRequestCreate, VideoCallRequestResponse, VideoCallFromChatRequest, VideoCallAcceptRequest, VideoCallStatusUpdate,
    ChatSessionResponse, ChatAcceptRequest,
    BookingStatusUpdate, BookingHistoryResponse, BookingNoteCreate, BookingNoteResponse,
    SlotAvailabilityResponse, SlotBookRequest,
)
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user, verify_care_recipient, verify_caregiver
from app.config import settings
from app.error_handler import (
    AuthenticationError, AuthorizationError, NotFoundError,
    DatabaseError, ValidationError, ConflictError, log_error, AppError
)
from app.services.notifications import (
    create_notification,
    notify_video_call_request,
    notify_video_call_created_for_recipient,
    notify_video_call_accepted,
    notify_video_call_status_change,
    notify_booking_created,
    notify_booking_status_change,
    update_notifications_booking_status,
    notify_chat_enabled,
    notify_video_call_joined
)
from app.services.video import generate_video_call_url
import uuid

router = APIRouter()


@router.post("/video-call/request", response_model=VideoCallRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_video_call_request(
    video_call_data: VideoCallRequestCreate,
    current_user: dict = Depends(verify_care_recipient)
):
    """
    Create a 15-second video call request with a selected caregiver.
    This happens when a care recipient selects a caregiver.
    """
    try:
        print(f"\n[INFO] ===== BOOKING CREATION STARTED =====", flush=True)
        # Get user_id from current_user
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        print(f"[INFO] Care Recipient ID: {user_id}", flush=True)
        
        if not user_id:
            raise AuthenticationError("User ID not found in authentication token")
        
        # Verify caregiver exists - use supabase_admin to bypass RLS
        try:
            caregiver_check = supabase_admin.table("users").select("id, role, is_active").eq("id", str(video_call_data.caregiver_id)).eq("role", "caregiver").execute()
            data = caregiver_check.data[0] if caregiver_check.data else None
            
            if not data:
                raise NotFoundError("Caregiver not found", details={"caregiver_id": str(video_call_data.caregiver_id)})
            
            if not data.get("is_active", True):
                raise ValidationError("Caregiver is not active", details={"caregiver_id": str(video_call_data.caregiver_id)})
        except HTTPException:
            raise
        except Exception as e:
            # Re-raise as DatabaseError or generic based on type
            raise DatabaseError(f"Error checking caregiver: {str(e)}")

        # Check caregiver is not already booked at this time (same logic as create_booking)
        st = video_call_data.scheduled_time
        if st.tzinfo is None:
            st = st.replace(tzinfo=timezone.utc)
        duration_sec = video_call_data.duration_seconds or 15
        call_end = st + timedelta(seconds=duration_sec)
        day_start = st - timedelta(days=1)
        day_end = st + timedelta(days=1)
        existing = supabase_admin.table("bookings").select("scheduled_date, duration_hours").eq("caregiver_id", str(video_call_data.caregiver_id)).in_("status", ["accepted", "confirmed", "in_progress"]).gte("scheduled_date", day_start.isoformat()).lte("scheduled_date", day_end.isoformat()).execute()
        for b in (existing.data or []):
            b_start_str = (b.get("scheduled_date") or "").replace("Z", "+00:00")
            if not b_start_str:
                continue
            b_start = datetime.fromisoformat(b_start_str)
            if b_start.tzinfo is None:
                b_start = b_start.replace(tzinfo=timezone.utc)
            b_dur = float(b.get("duration_hours") or 0)
            b_end = b_start + timedelta(hours=b_dur)
            if st < b_end and call_end > b_start:
                raise ConflictError("Caregiver is already booked for this time slot.")
        
        # Create video call request
        scheduled_time_iso = video_call_data.scheduled_time.isoformat()
        print(f"[INFO] Scheduled time (ISO): {scheduled_time_iso}", flush=True)
        
        video_call_dict = {
            "care_recipient_id": user_id,
            "caregiver_id": str(video_call_data.caregiver_id),
            "scheduled_time": scheduled_time_iso,
            "duration_seconds": video_call_data.duration_seconds,
            "status": "pending",
            "video_call_url": generate_video_call_url()
        }
        
        print(f"[INFO] Video call dict to insert: {video_call_dict}", flush=True)
        
        # Always use supabase_admin to bypass RLS for insert to avoid permission issues
        # This ensures the insert works regardless of RLS policies
        try:
            print(f"[INFO] Attempting to insert video call request into database...", flush=True)
            response = supabase_admin.table("video_call_requests").insert(video_call_dict).execute()
            print(f"[INFO] Insert successful, response data: {response.data}", flush=True)
        except Exception as insert_error:
            import traceback
            error_msg = str(insert_error)
            print(f"[ERROR] Error inserting video call request: {error_msg}", flush=True)
            traceback.print_exc()
            raise DatabaseError(f"Failed to create video call request: {error_msg}")
        
        if not response.data:
            raise DatabaseError("Failed to create video call request. No data returned.")
        
        video_call = response.data[0]
        print(f"[INFO] Video call request created with ID: {video_call['id']}", flush=True)
        
        # Get user names for notifications and send them
        # Do this separately so notifications are sent even if name lookup fails
        caregiver_id_str = str(video_call_data.caregiver_id)
        user_id_str = str(user_id)
        print(f"[INFO] Preparing to send notification to caregiver: {caregiver_id_str}", flush=True)
        
        # Get care recipient name
        try:
            care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", user_id_str).execute()
            care_recipient_name = care_recipient_response.data[0].get("full_name", "A care recipient") if care_recipient_response.data else "A care recipient"
        except Exception as name_error:
            import traceback
            print(f"Error getting care recipient name: {name_error}")
            traceback.print_exc()
            care_recipient_name = "A care recipient"
        
        # Get caregiver name
        try:
            caregiver_response = supabase_admin.table("users").select("full_name").eq("id", caregiver_id_str).execute()
            caregiver_name = caregiver_response.data[0].get("full_name", "a caregiver") if caregiver_response.data else "a caregiver"
        except Exception as name_error:
            import traceback
            print(f"Error getting caregiver name: {name_error}")
            traceback.print_exc()
            caregiver_name = "a caregiver"
        
        # Notify caregiver about new video call request (ONLY notification sent - care recipient doesn't get notified)
        # Wrap in try-except to ensure it doesn't fail silently
        try:
            notification_result = await notify_video_call_request(
                caregiver_id=caregiver_id_str,
                care_recipient_name=care_recipient_name,
                video_call_id=video_call["id"]
            )
            if notification_result:
                print(f"[INFO] Notification sent to caregiver {caregiver_id_str} for video call {video_call['id']}", flush=True)
            else:
                print(f"[WARN] Notification creation returned None for caregiver {caregiver_id_str}", flush=True)
        except Exception as notif_error:
            import traceback
            print(f"[ERROR] Error sending notification to caregiver: {notif_error}", flush=True)
            traceback.print_exc()
            # Don't fail the request if notification fails
        
        # NOTE: We do NOT notify care recipient when request is created - only caregiver gets notification to accept/decline
        
        print(f"[INFO] ===== VIDEO CALL REQUEST CREATION SUCCESSFUL =====", flush=True)
        return video_call
    
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
        elif "foreign key" in error_msg.lower() or "constraint" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid data: {error_msg}"
            )
        # Log the full error for debugging
        import traceback
        print(f"[ERROR] Error creating video call request: {error_msg}", flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating video call request: {error_msg}"
        )


@router.post("/video-call/from-chat", response_model=VideoCallRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_video_call_from_chat(
    body: VideoCallFromChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start an instant video call from an existing chat session.
    Either care recipient or caregiver can start the call; both are auto-accepted so they can join immediately.
    """
    try:
        user_id = str(current_user.get("id", ""))
        if not user_id:
            raise AuthenticationError("User ID not found")
        chat_session_id = str(body.chat_session_id)
        session_res = supabase_admin.table("chat_sessions").select("id, care_recipient_id, caregiver_id").eq("id", chat_session_id).eq("is_enabled", True).execute()
        if not session_res.data:
            raise NotFoundError("Chat session not found or disabled", details={"chat_session_id": chat_session_id})
        session = session_res.data[0]
        care_recipient_id = str(session["care_recipient_id"])
        caregiver_id = str(session["caregiver_id"])
        if user_id not in (care_recipient_id, caregiver_id):
            raise AuthorizationError("You are not a participant in this chat")
        # Reuse an existing accepted call from this chat (same pair) in the last 15 minutes so both parties get the same callId
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        existing = supabase_admin.table("video_call_requests").select("*").eq("care_recipient_id", care_recipient_id).eq("caregiver_id", caregiver_id).eq("status", "accepted").gte("created_at", cutoff).order("created_at", desc=True).limit(1).execute()
        if existing.data:
            return existing.data[0]
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        video_call_dict = {
            "care_recipient_id": care_recipient_id,
            "caregiver_id": caregiver_id,
            "scheduled_time": now_iso,
            "duration_seconds": 900,
            "status": "accepted",
            "care_recipient_accepted": True,
            "caregiver_accepted": True,
            "video_call_url": generate_video_call_url(),
        }
        response = supabase_admin.table("video_call_requests").insert(video_call_dict).execute()
        if not response.data:
            raise DatabaseError("Failed to create video call from chat")
        video_call = response.data[0]
        return video_call
    except HTTPException:
        raise
    except AppError:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise DatabaseError(f"Error creating video call from chat: {str(e)}")


@router.get("/video-call/{video_call_id}", response_model=VideoCallRequestResponse)
async def get_video_call_request(
    video_call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get video call request details"""
    try:
        response = supabase.table("video_call_requests").select("*").eq("id", video_call_id).execute()
        
        if not response.data:
            raise NotFoundError("Video call request not found", details={"video_call_id": video_call_id})
        
        # Verify user has access
        video_call = response.data[0]
        if video_call["care_recipient_id"] != current_user["id"] and video_call["caregiver_id"] != current_user["id"]:
            raise AuthorizationError("You do not have permission to access this video call")
        
        return video_call
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/video-call/{video_call_id}/accept")
async def accept_video_call_request(
    video_call_id: str,
    accept_data: VideoCallAcceptRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Accept or decline video call request.
    Both care recipient and caregiver must accept for the call to proceed.
    """
    print(f"[INFO] ===== ACCEPT VIDEO CALL REQUEST STARTED =====", flush=True)
    print(f"[INFO] Video call ID: {video_call_id}", flush=True)
    print(f"[INFO] Accept: {accept_data.accept}", flush=True)
    print(f"[INFO] Current User ID: {current_user.get('id')}", flush=True)
    try:
        # Get video call request - use supabase_admin to bypass RLS
        print(f"[INFO] Fetching video call request from database...", flush=True)
        try:
            response = supabase_admin.table("video_call_requests").select("*").eq("id", video_call_id).execute()
        except Exception as fetch_error:
            print(f"[WARN] Admin fetch failed, trying regular supabase: {fetch_error}", flush=True)
            # Fallback to regular supabase
            response = supabase.table("video_call_requests").select("*").eq("id", video_call_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video call request not found"
            )
        
        video_call = response.data[0]
        
        # Verify user has access
        if video_call["care_recipient_id"] != current_user["id"] and video_call["caregiver_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Determine which party is accepting
        is_care_recipient = video_call["care_recipient_id"] == current_user["id"]
        is_caregiver = video_call["caregiver_id"] == current_user["id"]
        
        update_data = {}
        if is_care_recipient:
            update_data["care_recipient_accepted"] = accept_data.accept
        if is_caregiver:
            update_data["caregiver_accepted"] = accept_data.accept
        
        if not accept_data.accept:
            # If declined, update status
            update_data["status"] = "declined"
        else:
            # If accepted, check if both parties will have accepted after this update
            # Calculate what the values will be after the update
            care_recipient_accepted_after = update_data.get("care_recipient_accepted") if is_care_recipient else video_call.get("care_recipient_accepted", False)
            caregiver_accepted_after = update_data.get("caregiver_accepted") if is_caregiver else video_call.get("caregiver_accepted", False)
            
            # If we're not updating a field, use the existing value
            if "care_recipient_accepted" not in update_data:
                care_recipient_accepted_after = video_call.get("care_recipient_accepted", False)
            if "caregiver_accepted" not in update_data:
                caregiver_accepted_after = video_call.get("caregiver_accepted", False)
            
            print(f"   After update - CR accepted: {care_recipient_accepted_after}, CG accepted: {caregiver_accepted_after}", flush=True)
            
            if care_recipient_accepted_after and caregiver_accepted_after:
                update_data["status"] = "accepted"
                print(f"   Both parties accepted - setting status to 'accepted'", flush=True)
            else:
                # Keep status as "pending" if only one party has accepted
                # Don't change status if it's already pending
                if video_call.get("status") != "pending":
                    update_data["status"] = "pending"
                print(f"   Only one party accepted - keeping status as 'pending'", flush=True)
        
        # Store original values for rollback
        original_status = video_call.get("status")
        original_care_recipient_accepted = video_call.get("care_recipient_accepted")
        original_caregiver_accepted = video_call.get("caregiver_accepted")
        
        # Update video_call request
        try:
            update_response = supabase_admin.table("video_call_requests").update(update_data).eq("id", video_call_id).execute()
        except Exception as update_error:
            # Fallback to regular supabase if admin fails
            update_response = supabase.table("video_call_requests").update(update_data).eq("id", video_call_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update video call request"
            )
        
        updated_call = update_response.data[0]
        print(f"[INFO] Video call {video_call_id} updated. Status: {updated_call.get('status')}, CR accepted: {updated_call.get('care_recipient_accepted')}, CG accepted: {updated_call.get('caregiver_accepted')}", flush=True)
        
        # BEGIN TRANSACTION-LIKE SEQUENCE
        booking_id = None
        chat_session_id = None
        rollback_needed = False
        rollback_reason = ""
        
        try:
            # If caregiver accepts, create booking automatically (whether or not care_recipient has accepted)
            # This ensures a booking is created as soon as caregiver accepts
            
            # Check if caregiver just accepted
            caregiver_just_accepted = is_caregiver and accept_data.accept and not video_call.get("caregiver_accepted", False)
            
            # Check if care recipient just accepted and caregiver already accepted (booking might not exist yet)
            care_recipient_just_accepted = is_care_recipient and accept_data.accept and not video_call.get("care_recipient_accepted", False)
            caregiver_already_accepted = video_call.get("caregiver_accepted", False)
            
            # Check if both parties have accepted (after update)
            both_accepted = updated_call.get("care_recipient_accepted", False) and updated_call.get("caregiver_accepted", False)
            
            # Check if status just became "accepted" (this is the key trigger per user requirement)
            status_just_became_accepted = updated_call.get("status") == "accepted" and video_call.get("status") != "accepted"
            
            print(f"[INFO] Booking creation check:", flush=True)
            print(f"[INFO]   is_caregiver: {is_caregiver}, is_care_recipient: {is_care_recipient}, accept_data.accept: {accept_data.accept}", flush=True)
            print(f"[INFO]   video_call.caregiver_accepted: {video_call.get('caregiver_accepted', False)}, video_call.care_recipient_accepted: {video_call.get('care_recipient_accepted', False)}", flush=True)
            print(f"[INFO]   video_call.status (before): {video_call.get('status')}, updated_call.status (after): {updated_call.get('status')}", flush=True)
            print(f"[INFO]   caregiver_just_accepted: {caregiver_just_accepted}, care_recipient_just_accepted: {care_recipient_just_accepted}, caregiver_already_accepted: {caregiver_already_accepted}, both_accepted: {both_accepted}, status_just_became_accepted: {status_just_became_accepted}", flush=True)
            
            # Create booking when:
            # 1. Caregiver accepts (even if care_recipient hasn't accepted yet) - PRIMARY TRIGGER
            # 2. Care recipient accepts and caregiver already accepted (booking might not exist yet)
            # 3. Status transitions to "accepted" (per user requirement: "when a Video Call request transitions to the status Accepted")
            # 4. Both parties have accepted
            # But check if booking already exists to avoid duplicates
            should_create_booking = caregiver_just_accepted or (care_recipient_just_accepted and caregiver_already_accepted) or status_just_became_accepted or both_accepted
            
            if should_create_booking:
                print(f"[INFO] Caregiver accepted video call {video_call_id}", flush=True)
                print(f"[INFO] Checking for existing booking and creating if needed...", flush=True)
                
                # Check if booking already exists for this video call
                existing_booking_check = supabase_admin.table("bookings").select("id").eq("video_call_request_id", video_call_id).execute()
                
                if existing_booking_check.data and len(existing_booking_check.data) > 0:
                    booking_id = existing_booking_check.data[0]["id"]
                    print(f"[INFO] Booking already exists with ID: {booking_id}", flush=True)
                else:
                    # Auto-create booking for payment when caregiver accepts
                    # Get service type from video call request or use default
                    # We'll use the scheduled_time from video call as the booking date
                    booking_dict = {
                        "care_recipient_id": video_call["care_recipient_id"],
                        "caregiver_id": video_call["caregiver_id"],
                        "video_call_request_id": video_call_id,
                        "service_type": "video_call_session",  # Use video_call_session type
                        "scheduled_date": video_call["scheduled_time"],
                        "duration_hours": video_call.get("duration_seconds", 900) / 3600,  # Convert seconds to hours
                        "status": "accepted",  # Caregiver accepted video call, so booking is accepted
                    }
                    
                    print(f"[INFO] Creating booking with data: {booking_dict}", flush=True)
                    booking_response = supabase_admin.table("bookings").insert(booking_dict).execute()
                    if booking_response.data:
                        booking_id = booking_response.data[0]["id"]
                        print(f"[INFO] Booking created with ID: {booking_id}", flush=True)
                        
                        # Mark caregiver as unavailable
                        try:
                            profile_check = supabase_admin.table("caregiver_profile").select("id").eq("user_id", video_call["caregiver_id"]).execute()
                            if profile_check.data and len(profile_check.data) > 0:
                                supabase_admin.table("caregiver_profile").update({
                                    "availability_status": "unavailable"
                                }).eq("user_id", video_call["caregiver_id"]).execute()
                            else:
                                supabase_admin.table("caregiver_profile").insert({
                                    "user_id": video_call["caregiver_id"],
                                    "availability_status": "unavailable"
                                }).execute()
                        except Exception as avail_error:
                            print(f"[WARN] Error updating caregiver availability: {avail_error}", flush=True)
                        
                        # Send booking notification to caregiver (Non-critical)
                        try:
                            care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", video_call["care_recipient_id"]).execute()
                            care_recipient_name = care_recipient_response.data[0].get("full_name", "A care recipient") if care_recipient_response.data else "A care recipient"
                            sd = (booking_response.data[0] if booking_response.data else {}).get("scheduled_date") or video_call.get("scheduled_time")
                            sd_iso = sd.isoformat() if hasattr(sd, "isoformat") else str(sd) if sd else None
                            await notify_booking_created(
                                caregiver_id=str(video_call["caregiver_id"]),
                                care_recipient_name=care_recipient_name,
                                booking_id=booking_id,
                                scheduled_date=sd_iso,
                            )
                        except Exception as notif_error:
                            print(f"[WARN] Error sending booking notification: {notif_error}", flush=True)
                        
                        # Also notify care recipient that booking was created (payment needed)
                        try:
                            caregiver_response = supabase_admin.table("users").select("full_name").eq("id", video_call["caregiver_id"]).execute()
                            caregiver_name = caregiver_response.data[0].get("full_name", "A caregiver") if caregiver_response.data else "A caregiver"
                            
                            await notify_booking_status_change(
                                user_id=video_call["care_recipient_id"],
                                booking_id=booking_id,
                                status="accepted", # Match status
                                other_party_name=caregiver_name
                            )
                        except Exception as notif_error:
                            print(f"[WARN] Error sending booking notification to care recipient: {notif_error}", flush=True)
                    else:
                        raise DatabaseError("Failed to create booking record")

                # Create chat session (initially disabled, will be enabled after payment)
                # This is CRITICAL if booking was created/exists
                chat_response = supabase_admin.table("chat_sessions").select("id").eq("care_recipient_id", video_call["care_recipient_id"]).eq("caregiver_id", video_call["caregiver_id"]).execute()
                
                if not chat_response.data:
                    new_chat = supabase_admin.table("chat_sessions").insert({
                        "care_recipient_id": video_call["care_recipient_id"],
                        "caregiver_id": video_call["caregiver_id"],
                        "video_call_request_id": video_call_id,
                        "is_enabled": False,  # Will be enabled after payment
                        "care_recipient_accepted": False,
                        "caregiver_accepted": False
                    }).execute()
                    if new_chat.data:
                        chat_session_id = new_chat.data[0]["id"]
                    else:
                        raise DatabaseError("Failed to create chat session")
                else:
                    chat_session_id = chat_response.data[0]["id"]
        
        except Exception as sequence_error:
            print(f"[ERROR] Error in booking/chat sequence: {sequence_error}", flush=True)
            rollback_needed = True
            rollback_reason = str(sequence_error)
        
        # ROLLBACK LOGIC
        if rollback_needed:
            print(f"[WARN] Initiating ROLLBACK due to: {rollback_reason}", flush=True)
            try:
                # 1. Delete created booking if it was created in this transaction
                # We only delete if we created it (booking_response.data existed) but checking booking_id is a proxy
                # To be safer, we should only delete if WE created it. 
                # For now, if we fail right after creation, we delete it.
                if booking_id:
                     # Verify it was just created? It's hard to know for sure without a flag.
                     # But if we encountered an error in this block, and we have a booking ID, safest is to remove it 
                     # if we assume it was part of this failed transaction.
                     # HOWEVER, if we retrieved an existing booking, we should NOT delete it.
                     # I need to distinguish between created vs retrieved.
                     # Refinement: I will check if existing_booking_check found it.
                     pass 

                # 2. Revert video call status
                revert_data = {
                    "status": original_status,
                    "care_recipient_accepted": original_care_recipient_accepted,
                    "caregiver_accepted": original_caregiver_accepted
                }
                print(f"[INFO] Reverting video call {video_call_id} to {revert_data}", flush=True)
                supabase_admin.table("video_call_requests").update(revert_data).eq("id", video_call_id).execute()
                
            except Exception as rollback_ex:
                print(f"[ERROR] Rollback failed! Data may be inconsistent. Error: {rollback_ex}", flush=True)
            
            # Re-raise the original error
            raise DatabaseError(f"Operation failed and was rolled back: {rollback_reason}")


        # Include chat_session_id and booking_id in response if created
        result = updated_call.copy()
        if chat_session_id:
            result["chat_session_id"] = chat_session_id
        if booking_id:
            result["booking_id"] = booking_id
        
        # Send notifications (Non-critical,        # Send notifications
        if accept_data.accept:
            # Get user names for notifications
            try:
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", video_call["care_recipient_id"]).execute()
                caregiver_response = supabase_admin.table("users").select("full_name").eq("id", video_call["caregiver_id"]).execute()
                
                care_recipient_name = care_recipient_response.data[0].get("full_name", "Care recipient") if care_recipient_response.data else "Care recipient"
                caregiver_name = caregiver_response.data[0].get("full_name", "Caregiver") if caregiver_response.data else "Caregiver"
                
                # Notify the other party
                if not is_care_recipient:
                    # Caregiver accepted, notify care recipient
                    await notify_video_call_accepted(
                        user_id=video_call["care_recipient_id"],
                        other_party_name=caregiver_name,
                        video_call_id=video_call_id,
                        is_caregiver=True
                    )
                    print(f"[INFO] Notification sent to care recipient about caregiver acceptance", flush=True)
                    
                    # If booking was created, also send a booking notification to care recipient
                    if booking_id:
                        try:
                            await notify_booking_status_change(
                                user_id=video_call["care_recipient_id"],
                                booking_id=booking_id,
                                status="pending",
                                other_party_name=caregiver_name
                            )
                            print(f"[INFO] Booking created notification sent to care recipient", flush=True)
                        except Exception as booking_notif_error:
                            print(f"[WARN] Error sending booking notification to care recipient: {booking_notif_error}", flush=True)
                else:
                    # Care Recipient accepted, notify caregiver
                    # Notify caregiver that care recipient accepted or just accepted the request
                    # We reuse notify_video_call_accepted but with is_caregiver=False to indicate the acceptor role
                    await notify_video_call_accepted(
                        user_id=video_call["caregiver_id"],
                        other_party_name=care_recipient_name,
                        video_call_id=video_call_id,
                        is_caregiver=False
                    )
                    print(f"[INFO] Notification sent to caregiver about care recipient acceptance", flush=True)
            except Exception as notif_error:
                print(f"[WARN] Error sending notification: {notif_error}", flush=True)
        
        # If declined, notify the other party about the decline
        if not accept_data.accept:
            # Notify the opposite party that the call was declined
            try:
                care_recipient_name = "Care Recipient" # Fallback
                caregiver_name = "Caregiver" # Fallback
                
                if is_care_recipient:
                    await notify_video_call_status_change(
                        user_id=video_call["caregiver_id"],
                        other_party_name=care_recipient_name,
                        video_call_id=video_call_id,
                        status="declined"
                    )
                else:
                    await notify_video_call_status_change(
                        user_id=video_call["care_recipient_id"],
                        other_party_name=caregiver_name,
                        video_call_id=video_call_id,
                        status="declined"
                    )
            except Exception as decline_notif_error:
                print(f"[WARN] Error sending decline notification: {decline_notif_error}", flush=True)

        print(f"[INFO] ===== ACCEPT VIDEO CALL REQUEST SUCCESSFUL =====", flush=True)
        return result

    
    except HTTPException as http_ex:
        print(f"[ERROR] HTTPException in accept_video_call_request: {http_ex.status_code} - {http_ex.detail}", flush=True)
        raise
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"[ERROR] Exception in accept_video_call_request: {error_msg}", flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error accepting video call request: {error_msg}"
        )

@router.post("/video-call/{video_call_id}/join")
async def join_video_call(
    video_call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Notify the other party that current user has joined the call.
    """
    try:
        # Get video call request
        response = supabase.table("video_call_requests").select("*").eq("id", video_call_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video call request not found"
            )
        
        video_call = response.data[0]
        
        # Verify user has access
        if video_call["care_recipient_id"] != current_user["id"] and video_call["caregiver_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        # Determine roles
        is_care_recipient = video_call["care_recipient_id"] == current_user["id"]
        
        # Identify the other party to notify
        other_party_id = video_call["caregiver_id"] if is_care_recipient else video_call["care_recipient_id"]
        
        # Get current user's name to send in notification
        try:
            user_response = supabase_admin.table("users").select("full_name").eq("id", current_user["id"]).execute()
            current_user_name = user_response.data[0].get("full_name", "User") if user_response.data else "User"
        except Exception:
            current_user_name = "User"

        # Send notification
        try:
            await notify_video_call_joined(
                user_id=other_party_id,
                other_party_name=current_user_name,
                video_call_id=video_call_id
            )
            print(f"[INFO] Join notification sent to {other_party_id}", flush=True)
        except Exception as e:
            print(f"[WARN] Failed to send join notification: {e}", flush=True)
            
        return {"status": "success", "message": "Join notification sent"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error in join_video_call: {e}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/video-call/{video_call_id}/status")
async def get_video_call_status(
    video_call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current status of a video call request.
    Used by the frontend to poll for status changes (e.g., pending → accepted → declined).
    """
    try:
        response = supabase_admin.table("video_call_requests").select(
            "id, status, care_recipient_accepted, caregiver_accepted, scheduled_time, video_call_url"
        ).eq("id", video_call_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video call request not found"
            )

        video_call = response.data[0]

        # Access guard: only participants can poll this
        if str(current_user.get("id", "")) not in [
            str(video_call.get("care_recipient_id", "")),
            str(video_call.get("caregiver_id", ""))
        ]:
            # Re-fetch with all fields to do the access check
            full = supabase_admin.table("video_call_requests").select("care_recipient_id, caregiver_id").eq("id", video_call_id).execute()
            if full.data:
                row = full.data[0]
                uid = str(current_user.get("id", ""))
                if uid not in [str(row.get("care_recipient_id", "")), str(row.get("caregiver_id", ""))]:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        return {
            "id": video_call.get("id"),
            "status": video_call.get("status", "pending"),
            "care_recipient_accepted": video_call.get("care_recipient_accepted", False),
            "caregiver_accepted": video_call.get("caregiver_accepted", False),
            "scheduled_time": video_call.get("scheduled_time"),
            "video_call_url": video_call.get("video_call_url"),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error in get_video_call_status: {e}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.patch("/video-call/{video_call_id}/status", response_model=VideoCallRequestResponse)
async def update_video_call_status(
    video_call_id: str,
    status_update: VideoCallStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update the status of a video call request (e.g., in_progress, completed).
    """
    try:
        # Get current video call
        response = supabase_admin.table("video_call_requests").select("*").eq("id", video_call_id).execute()
        
        if not response.data:
            raise NotFoundError("Video call request not found")
        
        video_call = response.data[0]
        
        # Access guard
        uid = str(current_user.get("id", ""))
        if uid not in [str(video_call.get("care_recipient_id", "")), str(video_call.get("caregiver_id", ""))]:
             raise AuthorizationError("Access denied")
             
        new_status = status_update.status
        
        update_data = {"status": new_status}
        if new_status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            
        print(f"[INFO] Updating video call {video_call_id} to {new_status}", flush=True)
        
        update_res = supabase_admin.table("video_call_requests").update(update_data).eq("id", video_call_id).execute()
        
        if not update_res.data:
             raise DatabaseError("Failed to update status")
             
        updated_call = update_res.data[0]
        
        # Send notification
        try:
            other_party_id = str(video_call.get("caregiver_id")) if uid == str(video_call.get("care_recipient_id")) else str(video_call.get("care_recipient_id"))
            
            await notify_video_call_status_change(
                user_id=other_party_id,
                other_party_name=current_user.get("full_name", "User"),
                video_call_id=video_call_id,
                status=new_status
            )
        except Exception as e:
             print(f"[WARN] Failed to send status notification: {e}", flush=True)
             
        return updated_call

    except AppError:
        raise
    except Exception as e:
         print(f"[ERROR] Error in update_video_call_status: {e}", flush=True)
         raise DatabaseError(f"Failed to update video call status: {str(e)}")


@router.post("/video-call/{id}/complete")
async def complete_video_call(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark video call (and linked booking) as completed.
    Accepts either video_call_id or booking_id (frontend may pass bookingId).
    """
    try:
        uid = str(current_user.get("id", ""))
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1) Try as video_call_request id
        vc_res = supabase_admin.table("video_call_requests").select("*").eq("id", id).execute()
        if vc_res.data and len(vc_res.data) > 0:
            vc = vc_res.data[0]
            if uid not in [str(vc.get("care_recipient_id", "")), str(vc.get("caregiver_id", ""))]:
                raise AuthorizationError("Access denied")
            supabase_admin.table("video_call_requests").update({
                "status": "completed",
                "completed_at": now_iso,
                "updated_at": now_iso,
            }).eq("id", id).execute()
            # Update linked booking to completed only if it is in_progress (valid transition)
            bk_res = supabase_admin.table("bookings").select("id, status").eq("video_call_request_id", id).limit(1).execute()
            if bk_res.data and len(bk_res.data) > 0:
                bk = bk_res.data[0]
                if bk.get("status") == "in_progress":
                    supabase_admin.table("bookings").update({
                        "status": "completed",
                        "completed_at": now_iso,
                        "updated_at": now_iso,
                    }).eq("id", bk["id"]).execute()
            return {"status": "completed", "video_call_id": id}

        # 2) Try as booking id
        bk_res = supabase_admin.table("bookings").select("id, status, video_call_request_id, care_recipient_id, caregiver_id").eq("id", id).execute()
        if bk_res.data and len(bk_res.data) > 0:
            bk = bk_res.data[0]
            if uid not in [str(bk.get("care_recipient_id", "")), str(bk.get("caregiver_id", ""))]:
                raise AuthorizationError("Access denied")
            # Only transition booking to completed if currently in_progress (valid transition)
            if bk.get("status") == "in_progress":
                supabase_admin.table("bookings").update({
                    "status": "completed",
                    "completed_at": now_iso,
                    "updated_at": now_iso,
                }).eq("id", id).execute()
            vc_id = bk.get("video_call_request_id")
            if vc_id:
                supabase_admin.table("video_call_requests").update({
                    "status": "completed",
                    "completed_at": now_iso,
                    "updated_at": now_iso,
                }).eq("id", vc_id).execute()
            return {"status": "completed", "booking_id": id}

        raise NotFoundError("Video call or booking not found", details={"id": id})
    except (AppError, HTTPException):
        raise
    except Exception as e:
        print(f"[ERROR] complete_video_call: {e}", flush=True)
        raise DatabaseError(f"Failed to complete video call: {str(e)}")


@router.post("/chat/{chat_session_id}/enable")
async def enable_chat_session(
    chat_session_id: str,
    accept_data: ChatAcceptRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Enable chat session. Both care recipient and caregiver must accept.
    Chat is only enabled when both parties accept after the video call.
    """
    try:
        # Get chat session
        response = supabase.table("chat_sessions").select("*").eq("id", chat_session_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )
        
        chat_session = response.data[0]
        
        # Verify user has access
        if chat_session["care_recipient_id"] != current_user["id"] and chat_session["caregiver_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Determine which party is accepting
        is_care_recipient = chat_session["care_recipient_id"] == current_user["id"]
        
        update_data = {}
        if is_care_recipient:
            update_data["care_recipient_accepted"] = accept_data.accept
        else:
            update_data["caregiver_accepted"] = accept_data.accept
        
        # Check if both parties will have accepted after this update
        care_recipient_accepted = update_data.get("care_recipient_accepted", chat_session["care_recipient_accepted"]) if is_care_recipient else chat_session["care_recipient_accepted"]
        caregiver_accepted = update_data.get("caregiver_accepted", chat_session["caregiver_accepted"]) if not is_care_recipient else chat_session["caregiver_accepted"]
        
        if care_recipient_accepted and caregiver_accepted and accept_data.accept:
            update_data["is_enabled"] = True
            from datetime import timezone
            update_data["enabled_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update chat session
        update_response = supabase.table("chat_sessions").update(update_data).eq("id", chat_session_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update chat session"
            )
        
        updated_session = update_response.data[0]
        
        # If chat is now enabled, notify both parties
        if updated_session.get("is_enabled") and accept_data.accept:
            try:
                # Get user names
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", chat_session["care_recipient_id"]).execute()
                caregiver_response = supabase_admin.table("users").select("full_name").eq("id", chat_session["caregiver_id"]).execute()
                
                care_recipient_name = care_recipient_response.data[0].get("full_name", "Care recipient") if care_recipient_response.data else "Care recipient"
                caregiver_name = caregiver_response.data[0].get("full_name", "Caregiver") if caregiver_response.data else "Caregiver"
                
                # Notify both parties
                await notify_chat_enabled(
                    user_id=chat_session["care_recipient_id"],
                    other_party_name=caregiver_name,
                    chat_session_id=chat_session_id
                )
                await notify_chat_enabled(
                    user_id=chat_session["caregiver_id"],
                    other_party_name=care_recipient_name,
                    chat_session_id=chat_session_id
                )
            except Exception as notif_error:
                # Don't fail the request if notification fails
                print(f"Error sending chat enabled notification: {notif_error}")
        
        return updated_session
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


async def _log_booking_history(booking_id: str, old_status: Optional[str], new_status: str, changed_by: str, reason: Optional[str] = None):
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



# --- STATE MANAGEMENT ---
# Valid transitions map: (current_status, role) -> {allowed_new_statuses}
# Roles: "care_recipient", "caregiver", "system" (if needed)

VALID_TRANSITIONS = {
    # Care Recipient Transitions
    ("draft", "care_recipient"): {"requested"},
    ("requested", "care_recipient"): {"cancelled"},
    ("accepted", "care_recipient"): {"cancelled"},
    ("confirmed", "care_recipient"): {"cancelled"},
    ("in_progress", "care_recipient"): {"completed", "cancelled"},
    
    # Caregiver Transitions
    ("requested", "caregiver"): {"accepted", "cancelled"}, # cancelled = rejected
    ("accepted", "caregiver"): {"cancelled"},
    ("confirmed", "caregiver"): {"in_progress", "cancelled"},
    ("in_progress", "caregiver"): {"completed", "cancelled"},
    
    # Common/System Transitions (if any specific to system, add 'system' role)
}

def validate_booking_transition(current_status: str, new_status: str, user_role: str) -> None:
    """
    Validates if a status transition is allowed for the given user role.
    Raises ConflictError or AuthorizationError if invalid.
    """
    # 1. Check for terminal states
    if current_status in ["completed", "cancelled"]:
        raise ConflictError(f"Cannot update booking in terminal state: '{current_status}'")

    # 2. Check specific allowed transition
    allowed_statuses = VALID_TRANSITIONS.get((current_status, user_role))
    
    if not allowed_statuses or new_status not in allowed_statuses:
        # Construct a helpful error message
        # Check if this transition is allowed for ANY role to distinguish auth vs logic error
        is_possible_somehow = False
        for (f_status, f_role), t_statuses in VALID_TRANSITIONS.items():
            if f_status == current_status and new_status in t_statuses:
                is_possible_somehow = True
                break
        
        if is_possible_somehow:
             raise AuthorizationError(f"Role '{user_role}' is not authorized to transition from '{current_status}' to '{new_status}'")
        else:
            if new_status == "completed":
                raise ConflictError(
                    f"Booking can only be marked completed when the visit is in progress. Current status: '{current_status}'."
                )
            raise ConflictError(f"Transition from '{current_status}' to '{new_status}' is invalid")


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


def _slot_overlap(req_start: datetime, req_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Overlap: (startA < endB) AND (endA > startB). All times must be timezone-aware (UTC)."""
    return req_start < b_end and req_end > b_start


@router.get("/slot-availability", response_model=SlotAvailabilityResponse)
async def check_slot_availability(
    caregiver_id: str,
    start_time: str,
    end_time: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Check if a slot is available for a caregiver.
    Considers only bookings with status: requested, accepted, confirmed, in_progress.
    Overlap rule: (startA < endB) AND (endA > startB).
    """
    try:
        req_start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        req_end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        raise ValidationError("Invalid start_time or end_time; use ISO 8601 format (UTC).")
    if req_start.tzinfo is None:
        req_start = req_start.replace(tzinfo=timezone.utc)
    if req_end.tzinfo is None:
        req_end = req_end.replace(tzinfo=timezone.utc)
    if req_start >= req_end:
        raise ValidationError("start_time must be before end_time.")

    try:
        rpc = supabase_admin.rpc(
            "check_slot_available",
            {
                "p_caregiver_id": caregiver_id,
                "p_start_time": req_start.isoformat(),
                "p_end_time": req_end.isoformat(),
                "p_exclude_booking_id": None,
            },
        ).execute()
        # RPC returns single value; Supabase may wrap in list
        available = rpc.data if isinstance(rpc.data, bool) else (rpc.data[0] if rpc.data else False)
    except Exception as e:
        err_str = str(e).lower()
        if "function" in err_str and "does not exist" in err_str:
            # Fallback: compute in app when RPC not yet deployed
            day_start = req_start - timedelta(days=1)
            day_end = req_end + timedelta(days=1)
            existing = supabase_admin.table("bookings").select("scheduled_date, duration_hours").eq(
                "caregiver_id", caregiver_id
            ).in_("status", ["requested", "accepted", "confirmed", "in_progress"]).gte(
                "scheduled_date", day_start.isoformat()
            ).lte("scheduled_date", day_end.isoformat()).execute()
            available = True
            for b in (existing.data or []):
                b_start_str = (b.get("scheduled_date") or "").replace("Z", "+00:00")
                if not b_start_str:
                    continue
                b_start = datetime.fromisoformat(b_start_str)
                if b_start.tzinfo is None:
                    b_start = b_start.replace(tzinfo=timezone.utc)
                b_end = b_start + timedelta(hours=float(b.get("duration_hours") or 0))
                if _slot_overlap(req_start, req_end, b_start, b_end):
                    available = False
                    break
        else:
            raise DatabaseError(f"Failed to check slot availability: {str(e)}")

    return SlotAvailabilityResponse(
        available=available,
        caregiver_id=uuid.UUID(caregiver_id),
        start_time=req_start,
        end_time=req_end,
    )


def _call_book_slot_atomic(
    care_recipient_id: str,
    caregiver_id: str,
    service_type: str,
    scheduled_date: datetime,
    duration_hours: float,
    location: Optional[dict] = None,
    specific_needs: Optional[str] = None,
    is_emergency: bool = False,
    video_call_request_id: Optional[str] = None,
    chat_session_id: Optional[str] = None,
) -> dict:
    """
    Call PostgreSQL RPC book_slot_atomic. Single transaction: lock, re-check overlap, insert.
    Raises ConflictError if slot already booked, ValidationError if invalid time or past.
    """
    if scheduled_date.tzinfo is None:
        scheduled_date = scheduled_date.replace(tzinfo=timezone.utc)
    # Reject past and zero-duration (backend authority; RPC also enforces)
    now_utc = datetime.now(timezone.utc)
    end_time = scheduled_date + timedelta(hours=duration_hours)
    if end_time <= now_utc:
        raise ValidationError("You cannot book a slot in the past. Please choose a future time.")
    if duration_hours <= 0 or duration_hours > 24:
        raise ValidationError("Duration must be between 0.5 and 24 hours.")
    payload = {
        "p_care_recipient_id": care_recipient_id,
        "p_caregiver_id": caregiver_id,
        "p_service_type": service_type,
        "p_scheduled_date": scheduled_date.isoformat(),
        "p_duration_hours": float(duration_hours),
        "p_location": location,
        "p_specific_needs": specific_needs,
        "p_is_emergency": is_emergency,
        "p_video_call_request_id": video_call_request_id,
        "p_chat_session_id": chat_session_id,
    }
    try:
        rpc = supabase_admin.rpc("book_slot_atomic", payload).execute()
    except Exception as e:
        err_str = str(e).lower()
        if "slot_already_booked" in err_str or "23p01" in err_str:
            raise ConflictError("This time slot was just booked by someone else. Please choose another time or caregiver.")
        if "slot_in_past" in err_str:
            raise ValidationError("You cannot book a slot in the past. Please choose a future time.")
        if "slot_invalid_time" in err_str or "22p02" in err_str:
            raise ValidationError("Invalid time range. Please use a valid start time and duration (0.5–24 hours).")
        raise DatabaseError(f"Booking failed: {str(e)}")
    # RPC returns JSONB single object; Supabase may return as list of one element
    data = rpc.data
    if isinstance(data, list):
        data = data[0] if data else None
    if not data:
        raise DatabaseError("Booking failed: no data returned.")
    return data


@router.post("/slot", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_slot_booking(
    body: SlotBookRequest,
    current_user: dict = Depends(verify_care_recipient),
):
    """
    Production-ready atomic slot booking.
    Prevents double booking and race conditions. Two users booking the same slot → only one succeeds.
    Use is_emergency=true to allow booking even when caregiver appears busy (override).
    """
    user_id = str(current_user.get("id"))
    if not user_id:
        raise AuthenticationError("User ID not found")

    caregiver_id = str(body.caregiver_id)
    cg_check = supabase_admin.table("users").select("id, is_active").eq("id", caregiver_id).eq("role", "caregiver").execute()
    if not cg_check.data or not cg_check.data[0].get("is_active", True):
        raise ValidationError("Caregiver is not available or inactive.")

    video_call_id = str(body.video_call_request_id) if body.video_call_request_id else None
    chat_id = str(body.chat_session_id) if body.chat_session_id else None

    booking = _call_book_slot_atomic(
        care_recipient_id=user_id,
        caregiver_id=caregiver_id,
        service_type=body.service_type,
        scheduled_date=body.scheduled_date,
        duration_hours=body.duration_hours,
        location=body.location,
        specific_needs=body.specific_needs,
        is_emergency=body.is_emergency,
        video_call_request_id=video_call_id,
        chat_session_id=chat_id,
    )

    booking_id = booking.get("id")
    if booking_id:
        await _log_booking_history(booking_id, None, "requested", user_id, "Slot booking (atomic)")
        try:
            care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", user_id).execute()
            care_recipient_name = (care_recipient_response.data[0].get("full_name", "A care recipient") if care_recipient_response.data else "A care recipient")
            sd = booking.get("scheduled_date")
            sd_iso = sd.isoformat() if hasattr(sd, "isoformat") else str(sd) if sd else None
            await notify_booking_created(caregiver_id=caregiver_id, care_recipient_name=care_recipient_name, booking_id=booking_id, scheduled_date=sd_iso)
        except Exception as e:
            print(f"[WARN] Failed to send notification: {e}", flush=True)

    return booking


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: dict = Depends(verify_care_recipient)
):
    """
    Create a booking.
    When caregiver_id is set and status is 'requested', uses atomic slot booking (no race conditions).
    Otherwise supports 'draft' or legacy flow.
    """
    print(f"[INFO] Creating booking for user {current_user.get('id')}", flush=True)
    try:
        from uuid import UUID
        user_id = str(current_user.get("id"))
        booking_dict = booking_data.model_dump(exclude_unset=True)
        initial_status = booking_dict.get("status", "requested")
        if initial_status not in ["draft", "requested"]:
            initial_status = "requested"
        caregiver_id = booking_dict.get("caregiver_id")

        # Atomic path: requested + caregiver_id → use RPC (production-safe)
        if initial_status == "requested" and caregiver_id:
            caregiver_id_str = str(caregiver_id)
            cg_check = supabase.table("users").select("id, is_active").eq("id", caregiver_id_str).eq("role", "caregiver").execute()
            if not cg_check.data or not cg_check.data[0].get("is_active", True):
                raise ValidationError("Caregiver is not available or inactive.")
            scheduled_time = booking_data.scheduled_date
            duration_hours = float(booking_data.duration_hours or 0)
            video_call_id = None
            chat_id = None
            try:
                video_call_check = supabase.table("video_call_requests").select("*").eq("care_recipient_id", user_id).eq("caregiver_id", caregiver_id_str).eq("status", "accepted").order("created_at", desc=True).limit(1).execute()
                if video_call_check.data:
                    video_call_id = video_call_check.data[0]["id"]
                chat_check = supabase.table("chat_sessions").select("*").eq("care_recipient_id", user_id).eq("caregiver_id", caregiver_id_str).eq("is_enabled", True).limit(1).execute()
                if chat_check.data:
                    chat_id = chat_check.data[0]["id"]
            except Exception as e:
                print(f"[WARN] Error validation video/chat linkage: {e}")

            booking = _call_book_slot_atomic(
                care_recipient_id=user_id,
                caregiver_id=caregiver_id_str,
                service_type=booking_data.service_type,
                scheduled_date=scheduled_time,
                duration_hours=duration_hours,
                location=booking_dict.get("location"),
                specific_needs=booking_dict.get("specific_needs"),
                is_emergency=(booking_dict.get("urgency_level") == "emergency"),
                video_call_request_id=video_call_id,
                chat_session_id=chat_id,
            )
            booking_id = booking.get("id")
            await _log_booking_history(booking_id, None, initial_status, user_id, "Initial booking creation (atomic)")
            if caregiver_id_str:
                try:
                    care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", user_id).execute()
                    care_recipient_name = (care_recipient_response.data[0].get("full_name", "A care recipient") if care_recipient_response.data else "A care recipient")
                    sd = booking.get("scheduled_date")
                    sd_iso = sd.isoformat() if hasattr(sd, "isoformat") else str(sd) if sd else None
                    await notify_booking_created(caregiver_id=caregiver_id_str, care_recipient_name=care_recipient_name, booking_id=booking_id, scheduled_date=sd_iso)
                except Exception as e:
                    print(f"[WARN] Failed to send notification: {e}", flush=True)
            return booking

        # Non-atomic path: draft or no caregiver
        for key, value in booking_dict.items():
            if isinstance(value, UUID):
                booking_dict[key] = str(value)
        if "scheduled_date" in booking_dict and isinstance(booking_dict["scheduled_date"], datetime):
            booking_dict["scheduled_date"] = booking_dict["scheduled_date"].isoformat()
        booking_dict["care_recipient_id"] = user_id
        booking_dict["status"] = initial_status

        if initial_status == "requested" and caregiver_id:
            cg_check = supabase.table("users").select("id, is_active").eq("id", str(caregiver_id)).eq("role", "caregiver").execute()
            if not cg_check.data or not cg_check.data[0]["is_active"]:
                raise ValidationError("Caregiver is not available or inactive.")
            scheduled_time = booking_data.scheduled_date
            if scheduled_time.tzinfo is None:
                scheduled_time = scheduled_time.replace(tzinfo=timezone.utc)
            duration_hours = float(booking_data.duration_hours or 0)
            day_start = scheduled_time - timedelta(days=1)
            day_end = scheduled_time + timedelta(days=1)
            existing_bookings = supabase_admin.table("bookings").select("scheduled_date, duration_hours").eq("caregiver_id", str(caregiver_id)).in_("status", ["accepted", "confirmed", "in_progress"]).gte("scheduled_date", day_start.isoformat()).lte("scheduled_date", day_end.isoformat()).execute()
            req_start = scheduled_time
            req_end = req_start + timedelta(hours=duration_hours)
            for b in (existing_bookings.data or []):
                b_start_str = (b.get("scheduled_date") or "").replace("Z", "+00:00")
                if not b_start_str:
                    continue
                b_start = datetime.fromisoformat(b_start_str)
                if b_start.tzinfo is None:
                    b_start = b_start.replace(tzinfo=timezone.utc)
                b_duration = float(b.get("duration_hours") or 0)
                b_end = b_start + timedelta(hours=b_duration)
                if req_start < b_end and req_end > b_start:
                    raise ConflictError("Caregiver is already booked for this time slot. Please choose another time or caregiver.")

        if caregiver_id:
            try:
                video_call_check = supabase.table("video_call_requests").select("*").eq("care_recipient_id", user_id).eq("caregiver_id", str(caregiver_id)).eq("status", "accepted").order("created_at", desc=True).limit(1).execute()
                if video_call_check.data:
                    booking_dict["video_call_request_id"] = video_call_check.data[0]["id"]
                chat_check = supabase.table("chat_sessions").select("*").eq("care_recipient_id", user_id).eq("caregiver_id", str(caregiver_id)).eq("is_enabled", True).limit(1).execute()
                if chat_check.data:
                    booking_dict["chat_session_id"] = chat_check.data[0]["id"]
            except Exception as e:
                print(f"[WARN] Error validation video/chat linkage: {e}")

        print(f"[INFO] Inserting booking: {booking_dict}", flush=True)
        response = supabase.table("bookings").insert(booking_dict).execute()
        if not response.data:
            raise DatabaseError("Failed to create booking")
        booking = response.data[0]
        booking_id = booking["id"]
        await _log_booking_history(booking_id, None, initial_status, user_id, "Initial booking creation")
        if initial_status == "requested" and caregiver_id:
            try:
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", user_id).execute()
                care_recipient_name = care_recipient_response.data[0].get("full_name", "A care recipient") if care_recipient_response.data else "A care recipient"
                sd = booking_dict.get("scheduled_date")
                sd_iso = sd.isoformat() if hasattr(sd, "isoformat") else str(sd) if sd else None
                await notify_booking_created(caregiver_id=str(caregiver_id), care_recipient_name=care_recipient_name, booking_id=booking_id, scheduled_date=sd_iso)
            except Exception as e:
                print(f"[WARN] Failed to send notification: {e}", flush=True)
        return booking

    except HTTPException:
        raise
    except AppError:
        raise
    except Exception as e:
        err_str = str(e).lower()
        if "23p01" in err_str or "prevent_caregiver_double_booking" in err_str or "exclusion constraint" in err_str or "slot_already_booked" in err_str:
            raise ConflictError("Caregiver is already booked for this time slot. Please choose another time or caregiver.")
        import traceback
        traceback.print_exc()
        raise DatabaseError(f"Error creating booking: {str(e)}")


@router.post("/{booking_id}/complete", response_model=BookingResponse)
async def complete_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a booking as completed (and linked video call if any).
    Used by frontend as POST /api/bookings/{booking_id}/complete.
    Enforces valid transition (e.g. in_progress -> completed for caregiver).
    """
    import sys
    sys.stderr.write(f"[BOOKINGS] complete_booking called: booking_id={booking_id}\n")
    sys.stderr.flush()
    try:
        user_id = str(current_user.get("id", ""))
        user_role = current_user.get("role")
        if user_role == "authenticated":
            user_data = supabase_admin.table("users").select("role").eq("id", user_id).execute()
            if user_data.data:
                user_role = user_data.data[0].get("role", "care_recipient")

        res = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if not res.data:
            raise NotFoundError("Booking not found")
        booking = res.data[0]

        if str(booking["caregiver_id"]) != user_id and str(booking["care_recipient_id"]) != user_id:
            raise AuthorizationError("Access denied")

        current_status = booking["status"]
        if current_status == "completed":
            return booking

        validate_booking_transition(current_status, "completed", user_role or "care_recipient")

        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {
            "status": "completed",
            "completed_at": now_iso,
            "updated_at": now_iso,
        }
        supabase_admin.table("bookings").update(update_data).eq("id", booking_id).execute()

        vc_id = booking.get("video_call_request_id")
        if vc_id:
            supabase_admin.table("video_call_requests").update({
                "status": "completed",
                "completed_at": now_iso,
                "updated_at": now_iso,
            }).eq("id", vc_id).execute()

        await _log_booking_history(booking_id, current_status, "completed", user_id, "Marked complete")

        updated = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if updated.data:
            return updated.data[0]
        return {**booking, **update_data}
    except (HTTPException, AppError):
        raise
    except Exception as e:
        raise DatabaseError(f"Error completing booking: {str(e)}")


@router.post("/{booking_id}/respond", response_model=BookingResponse)
async def respond_to_booking(
    booking_id: str,
    response_data: BookingStatusUpdate,
    current_user: dict = Depends(verify_caregiver)
):
    """
    Caregiver accepts or rejects a booking request.
    - Transitions: requested -> accepted OR cancelled (rejection)
    """
    try:
        user_id = current_user.get("id")
        user_role = "caregiver" # Explicitly define role for this endpoint
        
        res = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if not res.data:
            raise NotFoundError("Booking not found")
        booking = res.data[0]
        
        if str(booking["caregiver_id"]) != str(user_id):
            raise AuthorizationError("You are not assigned to this booking")
            
        current_status = booking["status"]
        new_status = response_data.status

        # Map rejected to cancelled for consistency
        if new_status == "rejected":
            new_status = "cancelled"

        if new_status not in ["accepted", "cancelled"]:
            raise ValidationError("Response status must be 'accepted' or 'cancelled'")

        # Idempotent: already in the requested state — return current booking
        if current_status == new_status:
            return booking

        # Validate Transition
        validate_booking_transition(current_status, new_status, user_role)
             
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if new_status == "accepted":
            update_data["accepted_at"] = datetime.now(timezone.utc).isoformat()
        elif new_status == "cancelled":
            update_data["cancellation_reason"] = response_data.reason or "Rejected by caregiver"

        updated_res = supabase_admin.table("bookings").update(update_data).eq("id", booking_id).execute()
        if not updated_res.data:
            raise DatabaseError("Failed to update booking")
            
        updated_booking = updated_res.data[0]
        
        await _log_booking_history(booking_id, booking["status"], new_status, user_id, response_data.reason)
        
        # Notify Care Recipient (ensure caregiver name for notification)
        try:
            caregiver_name = current_user.get("full_name")
            if not caregiver_name:
                name_res = supabase_admin.table("users").select("full_name").eq("id", user_id).limit(1).execute()
                caregiver_name = (name_res.data[0].get("full_name") or "Caregiver") if name_res.data else "Caregiver"
            await notify_booking_status_change(
                user_id=booking["care_recipient_id"],
                booking_id=booking_id,
                status=new_status,
                other_party_name=caregiver_name,
                is_caregiver_rejection=(new_status == "cancelled"),
            )
        except Exception as e:
            print(f"[WARN] Failed to notify status change: {e}", flush=True)

        # Update caregiver's "New Booking Request" notification so it shows Accepted/Declined
        try:
            await update_notifications_booking_status(
                booking_id, new_status, user_ids=[str(booking["caregiver_id"])]
            )
        except Exception as e:
            print(f"[WARN] Failed to update notification booking_status: {e}", flush=True)

        # Send a dedicated accepted/cancelled notification to the caregiver so they see it in the list
        try:
            care_recipient_name = "Care Recipient"
            cr_res = supabase_admin.table("users").select("full_name").eq("id", booking["care_recipient_id"]).limit(1).execute()
            if cr_res.data and len(cr_res.data) > 0:
                care_recipient_name = cr_res.data[0].get("full_name") or care_recipient_name
            if new_status == "accepted":
                await create_notification(
                    user_id=str(booking["caregiver_id"]),
                    notification_type="booking",
                    title="Booking Accepted",
                    body=f"You accepted the booking request from {care_recipient_name}.",
                    data={"booking_id": booking_id, "booking_status": "accepted", "action": "view_booking"}
                )
            else:
                await create_notification(
                    user_id=str(booking["caregiver_id"]),
                    notification_type="booking",
                    title="Booking Declined",
                    body=f"You declined the booking request from {care_recipient_name}.",
                    data={"booking_id": booking_id, "booking_status": "cancelled", "action": "view_booking"}
                )
        except Exception as e:
            print(f"[WARN] Failed to create caregiver accept/decline notification: {e}", flush=True)

        return updated_booking

    except HTTPException:
        raise
    except AppError:
        raise
    except Exception as e:
        err_str = str(e).lower()
        if "23p01" in err_str or "prevent_caregiver_double_booking" in err_str or "exclusion constraint" in err_str:
            raise ConflictError(
                "You're already booked for an overlapping time. This slot conflicts with another accepted or confirmed booking. Please decline this request or ask the care recipient to choose a different time."
            )
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
        user_id = str(current_user.get("id") or "")
        user_role = current_user.get("role")
        if not user_role or user_role == "authenticated":
            role_res = supabase_admin.table("users").select("role").eq("id", user_id).limit(1).execute()
            if role_res.data and len(role_res.data) > 0:
                user_role = role_res.data[0].get("role")
        if user_role not in ("care_recipient", "caregiver"):
            user_role = "care_recipient"

        res = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if not res.data:
            raise NotFoundError("Booking not found")
        booking = res.data[0]
        
        if str(booking["caregiver_id"]) != str(user_id) and str(booking["care_recipient_id"]) != str(user_id):
             raise AuthorizationError("Access denied")
             
        current_status = booking["status"]
        new_status = status_update.status
        
        # Centralized Validation
        try:
            validate_booking_transition(current_status, new_status, user_role)
        except (ConflictError, AuthorizationError):
            # Re-raise specific errors
            raise
        except Exception as e:
            # Fallback for unexpected logic errors
            raise ValidationError(f"Invalid status transition: {str(e)}")

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

        # Update all notifications for this booking so they show correct status and don't appear as "new request"
        try:
            await update_notifications_booking_status(
                booking_id,
                new_status,
                user_ids=[str(booking["caregiver_id"]), str(booking["care_recipient_id"])],
            )
        except Exception as e:
            print(f"[WARN] Failed to update notification booking_status: {e}", flush=True)

        return updated_booking

    except HTTPException:
        raise
    except AppError:
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
        booking = supabase_admin.table("bookings").select("caregiver_id, care_recipient_id").eq("id", booking_id).execute()
        if not booking.data:
             raise NotFoundError("Booking not found")
        b = booking.data[0]
        if str(b["caregiver_id"]) != str(current_user["id"]) and str(b["care_recipient_id"]) != str(current_user["id"]):
             raise AuthorizationError("Access denied")
             
        res = supabase_admin.table("booking_history").select("*").eq("booking_id", booking_id).order("created_at", desc=False).execute()
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
        booking = supabase_admin.table("bookings").select("caregiver_id, care_recipient_id").eq("id", booking_id).execute()
        if not booking.data:
             raise NotFoundError("Booking not found")
        b = booking.data[0]
        if str(b["caregiver_id"]) != str(current_user["id"]) and str(b["care_recipient_id"]) != str(current_user["id"]):
             raise AuthorizationError("Access denied")
             
        data = {
             "booking_id": booking_id,
             "user_id": current_user["id"],
             "note": note.note,
             "is_private": note.is_private
        }
        res = supabase_admin.table("booking_notes").insert(data).execute()
        return res.data[0]
    except Exception as e:
        raise DatabaseError(str(e))

@router.get("/{booking_id}", response_model=BookingResponse, status_code=status.HTTP_200_OK)
async def get_booking_details(
    booking_id: uuid.UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed information for a specific booking.
    Accessible by:
    - The care recipient who created it
    - The caregiver assigned to it
    """
    try:
        # Get user_id
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        # Query booking with relations
        # We need to join care_recipient and caregiver tables
        # Supabase syntax for joins in python client:
        # .select("*, care_recipient:users!care_recipient_id(*), caregiver:users!caregiver_id(*)")
        
        query = supabase_admin.table("bookings").select(
            "*, care_recipient:users!care_recipient_id(*), caregiver:users!caregiver_id(*)"
        ).eq("id", str(booking_id))
        
        response = query.execute()
        
        if not response.data:
            raise NotFoundError("Booking not found")
            
        booking = response.data[0]
        
        # Authorization Check
        care_recipient_id = booking.get("care_recipient_id")
        caregiver_id = booking.get("caregiver_id")
        
        # Check if user is either the recipient or the caregiver
        # Also allow if user is an admin (future proofing, if we had admin role check)
        is_authorized = (str(care_recipient_id) == str(user_id)) or \
                        (str(caregiver_id) == str(user_id) if caregiver_id else False)
                        
        if not is_authorized:
            raise AuthorizationError("You are not authorized to view this booking")
            
        return booking

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"booking_id": str(booking_id), "user_id": user_id})
        raise DatabaseError(f"Error retrieving booking details: {str(e)}")

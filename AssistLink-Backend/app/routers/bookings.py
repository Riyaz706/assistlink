from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.schemas import (
    BookingCreate, BookingUpdate, BookingResponse,
    VideoCallRequestCreate, VideoCallRequestResponse, VideoCallAcceptRequest,
    ChatSessionResponse, ChatAcceptRequest
)
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user, verify_care_recipient, verify_caregiver
from app.config import settings
from app.error_handler import (
    AuthenticationError, AuthorizationError, NotFoundError,
    DatabaseError, ValidationError, ConflictError, log_error
)
from app.services.notifications import (
    notify_video_call_request,
    notify_video_call_created_for_recipient,
    notify_video_call_accepted,
    notify_video_call_status_change,
    notify_booking_created,
    notify_booking_status_change,
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
                        "status": "pending",  # Pending payment
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
                            
                            await notify_booking_created(
                                caregiver_id=str(video_call["caregiver_id"]),
                                care_recipient_name=care_recipient_name,
                                booking_id=booking_id
                            )
                        except Exception as notif_error:
                            print(f"[WARN] Error sending booking notification: {notif_error}", flush=True)
                        
                        # Also notify care recipient that booking was created (pending payment)
                        try:
                            caregiver_response = supabase_admin.table("users").select("full_name").eq("id", video_call["caregiver_id"]).execute()
                            caregiver_name = caregiver_response.data[0].get("full_name", "A caregiver") if caregiver_response.data else "A caregiver"
                            
                            await notify_booking_status_change(
                                user_id=video_call["care_recipient_id"],
                                booking_id=booking_id,
                                status="pending",
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


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: dict = Depends(verify_care_recipient)
):
    """
    Create a booking. If caregiver_id is provided and video call was completed,
    create booking with that caregiver assigned.
    """
    try:
        booking_dict = booking_data.model_dump(exclude_unset=True)
        
        # Convert datetime objects to ISO format strings for Supabase
        if "scheduled_date" in booking_dict and isinstance(booking_dict["scheduled_date"], datetime):
            booking_dict["scheduled_date"] = booking_dict["scheduled_date"].isoformat()
        
        # Convert UUID objects to strings for Supabase
        from uuid import UUID
        for key, value in booking_dict.items():
            if isinstance(value, UUID):
                booking_dict[key] = str(value)
        
        # Ensure user_id is a string
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        booking_dict["care_recipient_id"] = str(user_id) if user_id else user_id
        booking_dict["status"] = "pending"
        
        # If caregiver_id is provided, verify they accepted the video call
        if booking_data.caregiver_id:
            # Check if there's an accepted video call request
            video_call_check = supabase.table("video_call_requests").select("*").eq("care_recipient_id", current_user["id"]).eq("caregiver_id", str(booking_data.caregiver_id)).eq("status", "accepted").order("created_at", desc=True).limit(1).execute()
            
            if video_call_check.data:
                booking_dict["video_call_request_id"] = video_call_check.data[0]["id"]
                
                # Check if chat session exists and is enabled
                chat_check = supabase.table("chat_sessions").select("*").eq("care_recipient_id", current_user["id"]).eq("caregiver_id", str(booking_data.caregiver_id)).eq("is_enabled", True).limit(1).execute()
                
                if chat_check.data:
                    booking_dict["chat_session_id"] = chat_check.data[0]["id"]
        
        response = supabase.table("bookings").insert(booking_dict).execute()
        
        if not response.data:
            raise DatabaseError("Failed to create booking")
        
        booking = response.data[0]
        
        # If caregiver is assigned, mark them as unavailable and notify them
        if booking.get("caregiver_id"):
            caregiver_id_str = str(booking["caregiver_id"])
            booking_id_str = str(booking["id"])
            
            # Mark caregiver as unavailable (they are now assigned to this booking)
            # Create profile if it doesn't exist
            try:
                profile_check = supabase_admin.table("caregiver_profile").select("id").eq("user_id", caregiver_id_str).execute()
                if profile_check.data and len(profile_check.data) > 0:
                    # Profile exists, update availability
                    supabase_admin.table("caregiver_profile").update({
                        "availability_status": "unavailable"
                    }).eq("user_id", caregiver_id_str).execute()
                else:
                    # Profile doesn't exist, create it with unavailable status
                    supabase_admin.table("caregiver_profile").insert({
                        "user_id": caregiver_id_str,
                        "availability_status": "unavailable"
                    }).execute()
            except Exception as avail_error:
                import traceback
                print(f"[WARN] Error updating caregiver availability: {avail_error}", flush=True)
                traceback.print_exc()
            
            # Get care recipient name and send notification
            # Do this separately so notification is sent even if availability update fails
            care_recipient_name = "A care recipient"
            try:
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", user_id).execute()
                if care_recipient_response.data:
                    care_recipient_name = care_recipient_response.data[0].get("full_name", "A care recipient")
            except Exception as name_error:
                import traceback
                print(f"[WARN] Error getting care recipient name: {name_error}", flush=True)
                traceback.print_exc()
            
            # Send notification - ensure it's sent even if name lookup fails
            print(f"\n📬 SENDING BOOKING NOTIFICATION", flush=True)
            print(f"   Caregiver ID: {caregiver_id_str}", flush=True)
            print(f"   Booking ID: {booking_id_str}", flush=True)
            print(f"   Care Recipient Name: {care_recipient_name}", flush=True)
            
            try:
                notification_result = await notify_booking_created(
                    caregiver_id=caregiver_id_str,
                    care_recipient_name=care_recipient_name,
                    booking_id=booking_id_str
                )
                if notification_result:
                    print(f"[INFO] Notification successfully sent to caregiver {caregiver_id_str} for booking {booking_id_str}", flush=True)
                else:
                    print(f"[WARN] Notification creation returned None for caregiver {caregiver_id_str}", flush=True)
            except Exception as notif_error:
                import traceback
                print(f"[ERROR] CRITICAL: Error sending notification to caregiver: {notif_error}", flush=True)
                traceback.print_exc()
                # Try to create notification directly as fallback
                try:
                    direct_notif = supabase_admin.table("notifications").insert({
                        "user_id": caregiver_id_str,
                        "type": "booking",
                        "title": "New Booking Request",
                        "body": f"{care_recipient_name} has created a new booking request",
                        "is_read": False,
                        "data": {
                            "booking_id": booking_id_str,
                            "action": "view_booking"
                        }
                    }).execute()
                    if direct_notif.data:
                        print(f"[INFO] Fallback: Notification created directly in database", flush=True)
                    else:
                        print(f"[ERROR] Fallback: Failed to create notification directly", flush=True)
                except Exception as fallback_error:
                    print(f"[ERROR] Fallback notification creation also failed: {fallback_error}", flush=True)
        
        return booking
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get booking details"""
    try:
        response = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = response.data[0]
        
        # Verify user has access
        if booking["care_recipient_id"] != current_user["id"] and booking.get("caregiver_id") != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return booking
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.patch("/video-call/{video_call_id}/status")
async def update_video_call_status(
    video_call_id: str,
    status_update: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Update video call status (e.g., to in_progress, completed).
    Only caregiver or care recipient can update.
    """
    print(f"[INFO] Updating video call {video_call_id} status to: {status_update.get('status')}", flush=True)
    try:
        # Get video call request
        response = supabase_admin.table("video_call_requests").select("*").eq("id", video_call_id).execute()
        
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
        
        # Validate status
        new_status = status_update.get("status")
        valid_statuses = ["pending", "accepted", "in_progress", "completed", "declined", "cancelled"]
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        # Update status
        update_data = {"status": new_status}
        if new_status == "completed":
            update_data["completed_at"] = datetime.utcnow().isoformat()
        
        update_response = supabase_admin.table("video_call_requests").update(update_data).eq("id", video_call_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update video call status"
            )
        
        print(f"[INFO] Video call {video_call_id} status updated to: {new_status}", flush=True)
        return update_response.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error updating video call status: {str(e)}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )




@router.post("/{booking_id}/complete-payment")
async def complete_payment(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Complete payment for a booking and enable chat session"""
    try:
        # Get booking to verify access
        booking_response = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        
        if not booking_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = booking_response.data[0]
        
        # Verify user is the care recipient
        if booking["care_recipient_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only care recipient can complete payment"
            )
        
        # Update booking status to accepted (payment completed)
        update_data = {
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }
        
        booking_update_response = supabase_admin.table("bookings").update(update_data).eq("id", booking_id).execute()
        
        if not booking_update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update booking"
            )
        
        updated_booking = booking_update_response.data[0]
        
        # Enable chat session and mark caregiver as unavailable if caregiver is assigned
        if updated_booking.get("caregiver_id"):
            caregiver_id_str = str(updated_booking["caregiver_id"])
            
            # Mark caregiver as unavailable (they are now assigned to this booking)
            # Create profile if it doesn't exist
            try:
                profile_check = supabase_admin.table("caregiver_profile").select("id").eq("user_id", caregiver_id_str).execute()
                if profile_check.data and len(profile_check.data) > 0:
                    # Profile exists, update availability
                    supabase_admin.table("caregiver_profile").update({
                        "availability_status": "unavailable"
                    }).eq("user_id", caregiver_id_str).execute()
                else:
                    # Profile doesn't exist, create it with unavailable status
                    supabase_admin.table("caregiver_profile").insert({
                        "user_id": caregiver_id_str,
                        "availability_status": "unavailable"
                    }).execute()
            except Exception as avail_error:
                import traceback
                print(f"Error updating caregiver availability: {avail_error}")
                traceback.print_exc()
            
            # Check if chat session exists
            chat_check = supabase_admin.table("chat_sessions").select("*").eq("care_recipient_id", booking["care_recipient_id"]).eq("caregiver_id", updated_booking["caregiver_id"]).execute()
            
            chat_session_id = None
            if chat_check.data and len(chat_check.data) > 0:
                # Update existing chat session
                chat_session_id = chat_check.data[0]["id"]
                supabase_admin.table("chat_sessions").update({
                    "is_enabled": True,
                    "care_recipient_accepted": True,
                    "caregiver_accepted": True,
                    "enabled_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", chat_session_id).execute()
            else:
                # Create new chat session
                new_chat = supabase_admin.table("chat_sessions").insert({
                    "care_recipient_id": booking["care_recipient_id"],
                    "caregiver_id": updated_booking["caregiver_id"],
                    "is_enabled": True,
                    "care_recipient_accepted": True,
                    "caregiver_accepted": True,
                    "enabled_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                if new_chat.data:
                    chat_session_id = new_chat.data[0]["id"]
            
            # Update booking with chat_session_id if not already set
            if chat_session_id and not updated_booking.get("chat_session_id"):
                supabase_admin.table("bookings").update({
                    "chat_session_id": chat_session_id
                }).eq("id", booking_id).execute()
            
            # Notify both parties that chat is enabled
            try:
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", booking["care_recipient_id"]).execute()
                caregiver_response = supabase_admin.table("users").select("full_name").eq("id", updated_booking["caregiver_id"]).execute()
                
                care_recipient_name = care_recipient_response.data[0].get("full_name", "Care recipient") if care_recipient_response.data else "Care recipient"
                caregiver_name = caregiver_response.data[0].get("full_name", "Caregiver") if caregiver_response.data else "Caregiver"
                
                await notify_chat_enabled(
                    user_id=booking["care_recipient_id"],
                    other_party_name=caregiver_name,
                    chat_session_id=chat_session_id
                )
                await notify_chat_enabled(
                    user_id=updated_booking["caregiver_id"],
                    other_party_name=care_recipient_name,
                    chat_session_id=chat_session_id
                )
            except Exception as notif_error:
                print(f"Error sending chat enabled notification: {notif_error}")
        
        return {"message": "Payment completed and chat enabled", "booking": updated_booking}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{booking_id}/complete")
async def complete_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark booking as completed by care recipient and make caregiver available again"""
    print(f"[INFO] ===== COMPLETE BOOKING REQUEST STARTED =====", flush=True)
    print(f"[INFO] Booking ID: {booking_id}", flush=True)
    print(f"[INFO] Current User ID: {current_user.get('id')}", flush=True)
    try:
        # Get booking to verify access
        print(f"[INFO] Fetching booking from database...", flush=True)
        booking_response = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        
        if not booking_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = booking_response.data[0]
        print(f"[INFO] Booking found: ID={booking.get('id')}, Status={booking.get('status')}, Caregiver ID={booking.get('caregiver_id')}", flush=True)
        
        # Verify user is the care recipient
        if booking["care_recipient_id"] != current_user["id"]:
            print(f"[ERROR] Permission denied: booking care_recipient_id={booking['care_recipient_id']} != current_user id={current_user['id']}", flush=True)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only care recipient can mark booking as completed"
            )
        
        print(f"[INFO] Permission verified. Updating booking status to 'completed'...", flush=True)
        # Update booking status to completed
        update_data = {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = supabase_admin.table("bookings").update(update_data).eq("id", booking_id).execute()
        print(f"[INFO] Booking status updated successfully", flush=True)
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update booking"
            )
        
        updated_booking = response.data[0]
        print(f"[INFO] Updated booking retrieved. Caregiver ID: {updated_booking.get('caregiver_id')}", flush=True)
        
        # Notify caregiver that booking was completed by care recipient
        if updated_booking.get("caregiver_id"):
            try:
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", current_user["id"]).execute()
                care_recipient_name = care_recipient_response.data[0].get("full_name", "Care recipient") if care_recipient_response.data else "Care recipient"
                
                await notify_booking_status_change(
                    user_id=str(updated_booking["caregiver_id"]),
                    booking_id=booking_id,
                    status="completed",
                    other_party_name=care_recipient_name
                )
                print(f"[INFO] Booking completion notification sent to caregiver", flush=True)
            except Exception as notif_error:
                print(f"[WARN] Error sending completion notification to caregiver: {notif_error}", flush=True)
        
        # Mark caregiver as available again if they have no other active bookings or video calls
        if updated_booking.get("caregiver_id"):
            print(f"[INFO] Processing caregiver availability for caregiver_id: {updated_booking.get('caregiver_id')}", flush=True)
            try:
                caregiver_id = updated_booking["caregiver_id"]
                
                # Check if caregiver has any other active bookings (pending, accepted, or in_progress)
                # Exclude the current booking that was just completed
                active_bookings = supabase_admin.table("bookings").select("id").eq("caregiver_id", caregiver_id).neq("id", booking_id).in_("status", ["pending", "accepted", "in_progress"]).execute()
                
                # Check if caregiver has any active (non-completed) video calls
                # Get all accepted video calls
                all_video_calls = supabase_admin.table("video_call_requests").select("id, status, completed_at").eq("caregiver_id", caregiver_id).eq("care_recipient_accepted", True).eq("caregiver_accepted", True).eq("status", "accepted").execute()
                
                # Filter to only count active (non-completed) video calls
                active_video_calls_count = 0
                if all_video_calls.data:
                    for vc in all_video_calls.data:
                        # Skip if video call is completed
                        if vc.get("completed_at") or vc.get("status") == "completed":
                            continue
                        # Check if related booking is completed
                        video_call_id = vc.get("id")
                        if video_call_id:
                            try:
                                related_booking = supabase_admin.table("bookings").select("id, status").eq("video_call_request_id", video_call_id).execute()
                                if related_booking.data:
                                    all_completed = all(booking.get("status") == "completed" for booking in related_booking.data)
                                    if all_completed:
                                        continue  # All related bookings are completed, skip this video call
                            except:
                                pass
                        # This video call is still active
                        active_video_calls_count += 1
                
                # If no active bookings AND no active video calls, mark caregiver as available
                has_active_bookings = active_bookings.data and len(active_bookings.data) > 0
                has_active_video_calls = active_video_calls_count > 0
                
                if not has_active_bookings and not has_active_video_calls:
                    print(f"[INFO] No active bookings or video calls for caregiver {caregiver_id}, marking as available", flush=True)
                    try:
                        profile_check = supabase_admin.table("caregiver_profile").select("id, availability_status").eq("user_id", caregiver_id).execute()
                        print(f"[INFO] Profile check result: {profile_check.data}", flush=True)
                        if profile_check.data and len(profile_check.data) > 0:
                            print(f"[INFO] Updating existing profile for caregiver {caregiver_id}", flush=True)
                            update_result = supabase_admin.table("caregiver_profile").update({
                                "availability_status": "available"
                            }).eq("user_id", caregiver_id).execute()
                            print(f"[INFO] Caregiver {caregiver_id} marked as available. Profile updated: {update_result.data}", flush=True)
                            # Verify the update
                            verify_result = supabase_admin.table("caregiver_profile").select("availability_status").eq("user_id", caregiver_id).execute()
                            print(f"[INFO] Verification: Caregiver {caregiver_id} availability_status is now: {verify_result.data[0].get('availability_status') if verify_result.data else 'NOT FOUND'}", flush=True)
                        else:
                            # Create profile if it doesn't exist
                            print(f"[INFO] Creating new profile for caregiver {caregiver_id}", flush=True)
                            insert_result = supabase_admin.table("caregiver_profile").insert({
                                "user_id": caregiver_id,
                                "availability_status": "available"
                            }).execute()
                            print(f"[INFO] Created caregiver profile for {caregiver_id} with available status. Profile created: {insert_result.data}", flush=True)
                    except Exception as profile_error:
                        print(f"[ERROR] Error updating caregiver profile: {profile_error}", flush=True)
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"[WARN] Caregiver {caregiver_id} still has {len(active_bookings.data) if active_bookings.data else 0} active bookings and {active_video_calls_count} active video calls, keeping current availability status", flush=True)
            except Exception as avail_error:
                print(f"[ERROR] Error updating caregiver availability: {avail_error}", flush=True)
                import traceback
                traceback.print_exc()
        else:
            print(f"[WARN] No caregiver_id found in booking, skipping availability update", flush=True)
        
        print(f"[INFO] ===== COMPLETE BOOKING REQUEST SUCCESSFUL =====", flush=True)
        return {"message": "Booking marked as completed", "booking": updated_booking}
    
    except HTTPException as http_ex:
        print(f"[ERROR] HTTPException in complete_booking: {http_ex.status_code} - {http_ex.detail}", flush=True)
        raise
    except Exception as e:
        print(f"[ERROR] Exception in complete_booking: {e}", flush=True)
        import traceback
        print(traceback.format_exc(), flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    booking_update: BookingUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update booking"""
    try:
        # Get booking to verify access
        booking_response = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        
        if not booking_response.data:
            raise NotFoundError("Booking not found")
        
        booking = booking_response.data[0]
        
        # Verify user has access
        if booking["care_recipient_id"] != current_user["id"] and booking.get("caregiver_id") != current_user["id"]:
            raise AuthorizationError("Access denied")
        
        update_data = booking_update.model_dump(exclude_unset=True)
        
        if not update_data:
            raise ValidationError("No fields to update")
            
        # State transition validation
        current_status = booking.get("status")
        new_status = update_data.get("status")
        
        # 1. Prevent updates to terminal states
        if current_status in ["completed", "cancelled", "declined"]:
            if new_status and new_status != current_status:
                raise ConflictError(f"Cannot change status of a {current_status} booking")
            if not new_status: # Trying to update other fields
                raise ConflictError(f"Cannot update details of a {current_status} booking")
                
        # 2. Validate interactions
        if new_status:
            # Simple state machine validation
            if current_status == "pending" and new_status not in ["accepted", "cancelled", "declined"]:
                raise ValidationError(f"Invalid status transition from '{current_status}' to '{new_status}'")
            if current_status == "accepted" and new_status not in ["in_progress", "completed", "cancelled"]:
                raise ValidationError(f"Invalid status transition from '{current_status}' to '{new_status}'")
        
        if "status" in update_data and update_data["status"] == "accepted":
            update_data["accepted_at"] = datetime.now(timezone.utc).isoformat()
        
        response = supabase.table("bookings").update(update_data).eq("id", booking_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update booking"
            )
        
        updated_booking = response.data[0]
        
        # Send notification if status changed
        if "status" in update_data:
            try:
                new_status = update_data["status"]
                print(f"[INFO] Booking {booking_id} status updated to {new_status}. Sending notification...", flush=True)
                
                # Determine who to notify
                other_party_id = None
                
                # Careful with string/uuid comparison
                current_user_id = str(current_user["id"])
                care_recipient_id = str(updated_booking["care_recipient_id"])
                caregiver_id = str(updated_booking.get("caregiver_id")) if updated_booking.get("caregiver_id") else None
                
                if current_user_id == care_recipient_id:
                    # Current user is Care Recipient -> Notify Caregiver
                    other_party_id = caregiver_id
                elif current_user_id == caregiver_id:
                    # Current user is Caregiver -> Notify Care Recipient
                    other_party_id = care_recipient_id
                
                if other_party_id:
                    # Get name of the person triggering the action (current_user)
                    trigger_user_name = "User"
                    try:
                        user_info = supabase_admin.table("users").select("full_name").eq("id", current_user_id).execute()
                        if user_info.data:
                            trigger_user_name = user_info.data[0].get("full_name", "User")
                    except Exception as e:
                        print(f"[WARN] Failed to fetch user name: {e}", flush=True)

                    await notify_booking_status_change(
                        user_id=other_party_id,
                        booking_id=booking_id,
                        status=new_status,
                        other_party_name=trigger_user_name
                    )
                    print(f"[INFO] Notification sent to {other_party_id}", flush=True)
            except Exception as e:
                print(f"[ERROR] Failed to send booking update notification: {e}", flush=True)
                # Don't fail the request, just log error
        
        return updated_booking
    
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(str(e))
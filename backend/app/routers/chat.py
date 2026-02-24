from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from app.schemas import MessageCreate, MessageResponse, ChatSessionResponse
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user
from app.services.notifications import notify_new_message
from app.error_handler import (
    AppError,
    NotFoundError,
    AuthorizationError,
    DatabaseError,
    ValidationError
)

router = APIRouter()


@router.get("/sessions", response_model=List[dict])
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    """Get all chat sessions for current user"""
    try:
        user_id = current_user["id"]
        
        # Get user role - use supabase_admin to bypass RLS
        try:
            user_response = supabase_admin.table("users").select("role").eq("id", user_id).execute()
            role = user_response.data[0].get("role") if user_response.data else None
        except Exception:
            # If user not found or error, try to infer from current_user
            role = current_user.get("role")
        
        # Build query - get sessions where user is either care_recipient or caregiver
        query = supabase_admin.table("chat_sessions").select("*").or_(f"care_recipient_id.eq.{user_id},caregiver_id.eq.{user_id}")
        response = query.execute()
        sessions = response.data or []
        
        # Manually fetch user data for each session
        enriched_sessions = []
        for session in sessions:
            enriched_session = session.copy()
            
            # Fetch care_recipient user data
            if session.get("care_recipient_id"):
                try:
                    care_recipient_response = supabase_admin.table("users").select("id, full_name, profile_photo_url, email").eq("id", session["care_recipient_id"]).execute()
                    if care_recipient_response.data:
                        enriched_session["care_recipient"] = care_recipient_response.data[0]
                except Exception as e:
                    print(f"Error fetching care_recipient data: {e}")
                    enriched_session["care_recipient"] = None
            
            # Fetch caregiver user data
            if session.get("caregiver_id"):
                try:
                    caregiver_response = supabase_admin.table("users").select("id, full_name, profile_photo_url, email").eq("id", session["caregiver_id"]).execute()
                    if caregiver_response.data:
                        enriched_session["caregiver"] = caregiver_response.data[0]
                except Exception as e:
                    print(f"Error fetching caregiver data: {e}")
                    enriched_session["caregiver"] = None
            
            # Get last message for preview and timestamp (for sorting - latest first)
            try:
                last_message_response = supabase_admin.table("messages").select("content, created_at").eq("chat_session_id", session["id"]).order("created_at", desc=True).limit(1).execute()
                if last_message_response.data and len(last_message_response.data) > 0:
                    lm = last_message_response.data[0]
                    enriched_session["last_message"] = lm.get("content", "")
                    enriched_session["last_message_at"] = lm.get("created_at")
            except Exception as e:
                print(f"Error fetching last message: {e}")
                enriched_session["last_message"] = None
                enriched_session["last_message_at"] = None
            
            enriched_sessions.append(enriched_session)
        
        # Sort by latest message first (upward = newest at top)
        def sort_key(s: dict):
            lm_at = s.get("last_message_at")
            if lm_at:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(lm_at.replace("Z", "+00:00")) if isinstance(lm_at, str) else lm_at
                    return dt.timestamp()
                except (ValueError, TypeError):
                    pass
            return 0
        enriched_sessions.sort(key=sort_key, reverse=True)
        
        return enriched_sessions
    
    except Exception as e:
        raise DatabaseError(f"Error retrieving chat sessions: {str(e)}")


@router.get("/sessions/{chat_session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    chat_session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get chat session details"""
    try:
        # Use supabase_admin to bypass RLS for checking session existence
        try:
            response = supabase_admin.table("chat_sessions").select("*").eq("id", chat_session_id).execute()
            
            if not response.data:
                raise NotFoundError("Chat session not found")
        except Exception as e:
            error_msg = str(e).lower()
            if "not found" in error_msg or "0 rows" in error_msg or "pgrst116" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Chat session not found"
                )
            raise
        
        chat_session = response.data[0]
        
        # Verify user has access
        if chat_session["care_recipient_id"] != current_user["id"] and chat_session["caregiver_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Verify chat is enabled
        if not chat_session["is_enabled"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chat session is not enabled"
            )
        
        return chat_session
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/sessions/{chat_session_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_session_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get messages for a chat session"""
    try:
        # Verify chat session exists and user has access - use supabase_admin to bypass RLS
        try:
            chat_response = supabase_admin.table("chat_sessions").select("*").eq("id", chat_session_id).execute()
            
            if not chat_response.data:
                raise NotFoundError("Chat session not found")
        except Exception as e:
            error_msg = str(e).lower()
            if "not found" in error_msg or "0 rows" in error_msg or "pgrst116" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Chat session not found"
                )
            raise
        
        chat_session = chat_response.data[0]
        
        # Verify user has access
        if chat_session["care_recipient_id"] != current_user["id"] and chat_session["caregiver_id"] != current_user["id"]:
            raise AuthorizationError("Access denied")
        
        # Verify chat is enabled
        if not chat_session["is_enabled"]:
            raise AuthorizationError("Chat session is not enabled")
        
        # Get messages using admin client to bypass RLS (select only fields needed for MessageResponse to avoid embed/validation issues)
        query = supabase_admin.table("messages").select("id, chat_session_id, sender_id, recipient_id, content, message_type, attachment_url, read_at, created_at").eq("chat_session_id", chat_session_id).order("created_at", desc=False).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        return response.data or []
    
    except HTTPException:
        raise
    except AppError:
        raise
    except Exception as e:
        raise DatabaseError(str(e))


@router.post("/sessions/{chat_session_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    chat_session_id: str,
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a message in a chat session"""
    try:
        # Verify chat session exists and user has access - use admin to bypass RLS for check
        try:
            chat_response = supabase_admin.table("chat_sessions").select("*").eq("id", chat_session_id).execute()
            
            if not chat_response.data:
                raise NotFoundError("Chat session not found")
        except Exception as e:
            error_msg = str(e).lower()
            if "not found" in error_msg or "0 rows" in error_msg or "pgrst116" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Chat session not found"
                )
            raise
        
        chat_session = chat_response.data[0]
        
        # Verify user has access
        if chat_session["care_recipient_id"] != current_user["id"] and chat_session["caregiver_id"] != current_user["id"]:
            raise AuthorizationError("Access denied")
        
        # Verify chat is enabled
        if not chat_session["is_enabled"]:
            raise AuthorizationError("Chat session is not enabled")
        
        # Determine recipient
        recipient_id = chat_session["caregiver_id"] if chat_session["care_recipient_id"] == current_user["id"] else chat_session["care_recipient_id"]
        
        # Create message
        message_dict = {
            "chat_session_id": chat_session_id,
            "sender_id": current_user["id"],
            "recipient_id": recipient_id,
            "content": message_data.content,
            "message_type": message_data.message_type,
            "attachment_url": message_data.attachment_url
        }
        
        # Use admin client to bypass RLS for insert while we already enforce access checks above
        response = supabase_admin.table("messages").insert(message_dict).execute()
        
        if not response.data or len(response.data) == 0:
            raise DatabaseError("Failed to send message")
        
        # The inserted message already has all required fields for MessageResponse
        # Just return it directly - the join with sender/recipient is optional and only needed for getMessages
        message = response.data[0]
        
        # Get sender name for notification
        sender_response = supabase_admin.table("users").select("full_name").eq("id", current_user["id"]).execute()
        sender_name = sender_response.data[0].get("full_name", "Someone") if sender_response.data else "Someone"
        
        # Notify recipient about new message
        message_preview = message_data.content[:100] if len(message_data.content) > 100 else message_data.content
        await notify_new_message(
            recipient_id=recipient_id,
            sender_name=sender_name,
            message_id=message["id"],
            chat_session_id=chat_session_id,
            message_preview=message_preview
        )
        
        return message
    
    except HTTPException:
        raise
    except AppError:
        raise
    except Exception as e:
        raise DatabaseError(str(e))


@router.post("/sessions/{chat_session_id}/read")
async def mark_messages_as_read(
    chat_session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark messages as read in a chat session"""
    try:
        # Verify chat session exists and user has access - use admin to bypass RLS for check
        try:
            chat_response = supabase_admin.table("chat_sessions").select("*").eq("id", chat_session_id).execute()
            
            if not chat_response.data:
                raise NotFoundError("Chat session not found")
        except Exception as e:
            error_msg = str(e).lower()
            if "not found" in error_msg or "0 rows" in error_msg or "pgrst116" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Chat session not found"
                )
            raise
        
        chat_session = chat_response.data[0]
        
        # Verify user has access
        if chat_session["care_recipient_id"] != current_user["id"] and chat_session["caregiver_id"] != current_user["id"]:
            raise AuthorizationError("Access denied")
        
        # Mark messages as read using admin client to bypass RLS
        # Update all unread messages for this recipient in this session in a single query
        read_at = datetime.now(timezone.utc).isoformat()
        try:
            # Try to update directly with null check
            supabase_admin.table("messages").update({"read_at": read_at}).eq("chat_session_id", chat_session_id).eq("recipient_id", current_user["id"]).is_("read_at", "null").execute()
        except Exception as update_error:
            # If direct update fails, try alternative approach: get IDs first, then update
            error_msg = str(update_error).lower()
            if "null" in error_msg or "syntax" in error_msg:
                # Fallback: get unread message IDs and update them
                try:
                    unread_response = supabase_admin.table("messages").select("id").eq("chat_session_id", chat_session_id).eq("recipient_id", current_user["id"]).is_("read_at", "null").execute()
                    if unread_response.data and len(unread_response.data) > 0:
                        message_ids = [msg["id"] for msg in unread_response.data]
                        for msg_id in message_ids:
                            supabase_admin.table("messages").update({"read_at": read_at}).eq("id", msg_id).execute()
                except Exception:
                    # If that also fails, it's okay - messages might already be read or there are none
                    pass
            else:
                raise
        
        return {"message": "Messages marked as read"}
    
    except HTTPException:
        raise
    except AppError:
        raise
    except Exception as e:
        raise DatabaseError(str(e))


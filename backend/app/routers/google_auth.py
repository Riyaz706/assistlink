from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os
from typing import Optional
from datetime import datetime, timedelta, timezone
from jose import jwt

from ..database import supabase, supabase_admin
from ..config import settings

router = APIRouter()

# Google OAuth Client IDs (from settings so .env is respected)
GOOGLE_CLIENT_IDS = [
    getattr(settings, "GOOGLE_WEB_CLIENT_ID", None) or os.getenv("GOOGLE_WEB_CLIENT_ID", ""),
    getattr(settings, "GOOGLE_IOS_CLIENT_ID", None) or os.getenv("GOOGLE_IOS_CLIENT_ID", ""),
    getattr(settings, "GOOGLE_ANDROID_CLIENT_ID", None) or os.getenv("GOOGLE_ANDROID_CLIENT_ID", ""),
]

class GoogleAuthRequest(BaseModel):
    id_token: str
    role: str  # "care_recipient" or "caregiver"
    full_name: Optional[str] = None
    profile_photo_url: Optional[str] = None

class GoogleAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict

@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(payload: GoogleAuthRequest):
    """
    Verify Google ID token and create/login user.
    """
    try:
        # Verify the Google ID token
        # Filter out empty client IDs
        valid_client_ids = [cid for cid in GOOGLE_CLIENT_IDS if cid]
        
        if not valid_client_ids:
            raise HTTPException(
                status_code=500,
                detail="Google OAuth is not configured. Please set GOOGLE_*_CLIENT_ID environment variables."
            )
        
        # Try to verify with each client ID
        idinfo = None
        for client_id in valid_client_ids:
            try:
                idinfo = id_token.verify_oauth2_token(
                    payload.id_token,
                    google_requests.Request(),
                    client_id
                )
                break
            except ValueError:
                continue
        
        if not idinfo:
            raise HTTPException(
                status_code=401,
                detail="Invalid Google ID token"
            )
        
        # Extract user info from the token
        email = idinfo.get("email")
        google_id = idinfo.get("sub")
        name = payload.full_name or idinfo.get("name", "")
        picture = payload.profile_photo_url or idinfo.get("picture", "")
        
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Email not found in Google token"
            )
        
        # Check if user exists in Supabase Auth
        try:
            # Try to get user by email
            user_response = supabase_admin.auth.admin.list_users()
            existing_user = None
            
            for user in user_response:
                if user.email == email:
                    existing_user = user
                    break
            
            if existing_user:
                # User exists, generate JWT token
                user_id = existing_user.id
                
                # Update user metadata if needed
                supabase_admin.auth.admin.update_user_by_id(
                    user_id,
                    {
                        "user_metadata": {
                            "full_name": name,
                            "profile_photo_url": picture,
                            "google_id": google_id,
                        }
                    }
                )
            else:
                # Create new user in Supabase Auth
                new_user_response = supabase_admin.auth.admin.create_user({
                    "email": email,
                    "email_confirm": True,  # Auto-confirm email for Google users
                    "user_metadata": {
                        "full_name": name,
                        "profile_photo_url": picture,
                        "role": payload.role,
                        "google_id": google_id,
                    }
                })
                
                user_id = new_user_response.user.id
                
                # Create user profile in database
                profile_data = {
                    "id": user_id,
                    "email": email,
                    "full_name": name,
                    "role": payload.role,
                    "profile_photo_url": picture,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                
                # Insert into users table
                supabase.table("users").insert(profile_data).execute()
                
                # If caregiver, create caregiver profile
                if payload.role == "caregiver":
                    caregiver_data = {
                        "user_id": user_id,
                        "availability_status": "available",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    supabase.table("caregiver_profile").insert(caregiver_data).execute()
            
            # Generate JWT access token
            access_token_expires = timedelta(days=7)
            access_token = jwt.encode(
                {
                    "sub": user_id,
                    "email": email,
                    "exp": datetime.now(timezone.utc) + access_token_expires,
                },
                settings.SECRET_KEY,
                algorithm="HS256",
            )
            
            # Generate refresh token (longer expiry)
            refresh_token_expires = timedelta(days=30)
            refresh_token = jwt.encode(
                {
                    "sub": user_id,
                    "email": email,
                    "exp": datetime.now(timezone.utc) + refresh_token_expires,
                    "type": "refresh",
                },
                settings.SECRET_KEY,
                algorithm="HS256",
            )
            
            # Get user data
            # Get user data - use limit(1) instead of single() to avoid errors
            user_response = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
            if not user_response.data:
                 # Logic ensures user should exist, but safety check
                 raise HTTPException(status_code=500, detail="User created/updated but not found")
            user_data = user_response.data[0] # Access the first item directly
            
            return GoogleAuthResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                user=user_data,
            )
            
        except Exception as e:
            print(f"[GoogleAuth] Error creating/updating user: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create or update user: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GoogleAuth] Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Google authentication failed: {str(e)}"
        )

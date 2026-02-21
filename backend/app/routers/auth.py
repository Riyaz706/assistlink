from fastapi import APIRouter, HTTPException, status, Depends, Request, Body
from fastapi.responses import RedirectResponse, JSONResponse
from app.schemas import UserCreate, UserResponse, LoginRequest, PasswordChangeRequest
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user, get_user_id
from app.error_handler import (
    ConflictError,
    AuthenticationError,
    ValidationError,
    DatabaseError,
    NotFoundError
)
from pydantic import BaseModel
from typing import Optional
import sys
from app.limiter import limiter
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from app.config import settings

router = APIRouter()


class GoogleOAuthCallback(BaseModel):
    code: Optional[str] = None
    error: Optional[str] = None
    state: Optional[str] = None


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate):
    """Register a new user"""
    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "full_name": user_data.full_name,
                    "role": user_data.role
                }
            }
        })
        
        if not auth_response.user:
            raise DatabaseError("Failed to create user account in authentication system")
        
        # Get user ID from auth response
        user_id = auth_response.user.id if hasattr(auth_response.user, 'id') else auth_response.user.get('id') if isinstance(auth_response.user, dict) else str(auth_response.user)
        
        # Create user profile in database
        user_profile = {
            "id": user_id,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "phone": user_data.phone,
            "date_of_birth": user_data.date_of_birth.isoformat() if user_data.date_of_birth else None,
            "role": user_data.role,
            "address": user_data.address,
            "profile_photo_url": user_data.profile_photo_url
        }
        
        # Use supabase_admin (service role) to bypass RLS policies for profile creation
        profile_response = supabase_admin.table("users").insert(user_profile).execute()
        
        if not profile_response.data:
            raise DatabaseError("Failed to create user profile in database")
        
        return profile_response.data[0]
    
    except ConflictError:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "already registered" in error_msg or "already exists" in error_msg or "duplicate" in error_msg:
            raise ConflictError(
                "An account with this email already exists. Please login or use a different email.",
                details={"email": user_data.email}
            )
        
        sys.stderr.write(f"[AUTH] Registration error: {str(e)}\n")
        sys.stderr.flush()
        raise DatabaseError(f"Registration failed: {str(e)}")


@router.post("/login", response_model=dict)
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginRequest):
    """Login user and get access token"""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        sys.stderr.write(f"[{request.state.request_id}] Supabase login successful for {credentials.email}\n")
        sys.stderr.flush()
        
        if not response.user:
            raise AuthenticationError("Invalid email or password. Please check your credentials.")
        
        # Check if session exists and has access_token
        if not response.session:
            raise AuthenticationError("Login failed: No session created. Please try again.")
        
        access_token = response.session.access_token
        if not access_token:
            raise AuthenticationError("Login failed: No access token received. Please try again.")
        
        # Get user profile
        user_id = response.user.id if hasattr(response.user, 'id') else response.user.get('id') if isinstance(response.user, dict) else str(response.user)
        
        user_profile_response = supabase.table("users").select("*").eq("id", user_id).execute()
        
        user_profile = None
        if user_profile_response.data and len(user_profile_response.data) > 0:
            user_profile = user_profile_response.data[0]
        
        return {
            "access_token": access_token,
            "refresh_token": response.session.refresh_token if response.session.refresh_token else None,
            "token_type": "bearer",
            "user": user_profile
        }
    
    except AuthenticationError:
        raise
    except Exception as e:
        error_message = str(e).lower()
        
        # Provide specific error messages based on error type
        if "invalid login credentials" in error_message or "invalid_credentials" in error_message:
            raise AuthenticationError("Invalid email or password. Please check your credentials.")
        elif "email not confirmed" in error_message or "email_not_confirmed" in error_message:
            raise AuthenticationError(
                "Email not verified. Please check your email for verification link.",
                details={"email": credentials.email}
            )
        elif "network" in error_message or "connection" in error_message:
            raise DatabaseError("Unable to connect to authentication service. Please try again.")
        else:
            sys.stderr.write(f"[AUTH] Login error: {str(e)}\n")
            sys.stderr.flush()
            raise AuthenticationError(f"Login failed: {str(e)}")



class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=dict)
async def refresh_token(body: RefreshTokenRequest = Body(..., embed=False)):
    """
    Refresh access token using refresh token.
    Supports both Supabase session tokens and custom JWT tokens (Google Auth).
    """
    try:
        # 1. Try Supabase refresh first (standard login)
        try:
            response = supabase.auth.refresh_session(body.refresh_token)
            if response.session and response.session.access_token:
                sys.stderr.write(f"[AUTH] Supabase session refreshed successfully\n")
                sys.stderr.flush()
                return {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "token_type": "bearer",
                    "user": response.user
                }
        except Exception as e:
            # If Supabase fails, it might be a custom token or expired Supabase token
            # Continue to custom logic
            pass
            
        # 2. Try Custom JWT refresh (Google Auth)
        try:
            sys.stderr.write(f"[AUTH] Attempting custom JWT refresh...\n")
            
            # Verify the refresh token
            payload = jwt.decode(body.refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
            
            if payload.get("type") != "refresh":
                raise AuthenticationError("Invalid token type")
                
            user_id = payload.get("sub")
            email = payload.get("email")
            
            if not user_id or not email:
                raise AuthenticationError("Invalid token payload")
                
            # Generate new access token
            access_token_expires = timedelta(days=7)
            new_access_token = jwt.encode(
                {
                    "sub": user_id,
                    "email": email,
                    "exp": datetime.now(timezone.utc) + access_token_expires,
                },
                settings.SECRET_KEY,
                algorithm="HS256",
            )
            
            # Generate new refresh token (rotate it)
            refresh_token_expires = timedelta(days=30)
            new_refresh_token = jwt.encode(
                {
                    "sub": user_id,
                    "email": email,
                    "exp": datetime.now(timezone.utc) + refresh_token_expires,
                    "type": "refresh",
                },
                settings.SECRET_KEY,
                algorithm="HS256",
            )
            
            # Get user profile
            user_response = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
            user_data = user_response.data[0] if user_response.data else None
            
            sys.stderr.write(f"[AUTH] Custom JWT refreshed successfully for {email}\n")
            sys.stderr.flush()
            
            return {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "user": user_data
            }
            
        except JWTError as jwt_err:
            sys.stderr.write(f"[AUTH] Custom refresh failed: {jwt_err}\n")
            raise AuthenticationError("Invalid or expired refresh token")
        except Exception as e:
             sys.stderr.write(f"[AUTH] Refresh error: {str(e)}\n")
             raise AuthenticationError(f"Token refresh failed: {str(e)}")

    except AuthenticationError:
        raise
    except Exception as e:
        sys.stderr.write(f"[AUTH] Unexpected refresh error: {str(e)}\n")
        raise DatabaseError(f"Refresh failed: {str(e)}")


class ResetPasswordRequest(BaseModel):
    email: str



@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(request: ResetPasswordRequest):
    """Send password reset email to user"""
    try:
        # Use Supabase Auth to send password reset email
        response = supabase.auth.reset_password_email(request.email)
        
        # Always return success to prevent email enumeration attacks
        return {
            "message": "If an account exists with this email, you will receive password reset instructions shortly."
        }
    except Exception as e:
        sys.stderr.write(f"[ERROR] Password reset error: {str(e)}\n")
        sys.stderr.flush()
        
        # Still return success to prevent email enumeration
        return {
            "message": "If an account exists with this email, you will receive password reset instructions shortly."
        }


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    request: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Change password for authenticated user with current password verification"""
    try:
        # Get user email from current_user
        email = current_user.get('email')
        if not email:
            raise ValidationError("User email not found in session", "email")

        # Verify current password by attempting to sign in
        # OAuth users (Google sign-in) may not have a password set
        if request.current_password:
            try:
                auth_response = supabase.auth.sign_in_with_password({
                    "email": email,
                    "password": request.current_password
                })
                if not auth_response.user:
                    raise AuthenticationError("Invalid current password")
                sys.stderr.write(f"[INFO] Current password verified for {email}\n")
                sys.stderr.flush()
            except Exception as e:
                sys.stderr.write(f"[ERROR] Password verification failed: {str(e)}\n")
                sys.stderr.flush()
                raise AuthenticationError("Incorrect current password")
        else:
            # OAuth user setting password for the first time
            sys.stderr.write(f"[INFO] OAuth user {email} setting password (no current password provided)\n")
            sys.stderr.flush()

        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise ValidationError("User ID not found in session", "user_id")
        
        # Ensure user_id is a string
        user_id_str = str(user_id)
        sys.stderr.write(f"[INFO] Password change request for user: {email} (ID: {user_id_str})\n")
        sys.stderr.flush()

        # Update user's password using admin client
        try:
            sys.stderr.write(f"[INFO] Calling update_user_by_id with ID: {user_id_str}\n")
            sys.stderr.flush()
            
            response = supabase_admin.auth.admin.update_user_by_id(
                user_id_str,
                {"password": request.new_password}
            )
            
            sys.stderr.write(f"[INFO] Update response received: {response}\n")
            sys.stderr.flush()
            
            if not response.user:
                raise DatabaseError("No user returned from password update operation")
                
            sys.stderr.write(f"[SUCCESS] Password updated for {email}\n")
            sys.stderr.flush()
            
        except Exception as e:
            sys.stderr.write(f"[ERROR] Password update failed: {str(e)}\n")
            sys.stderr.flush()
            raise DatabaseError(f"Failed to update password: {str(e)}")
            
        return {"message": "Password updated successfully"}
    
    except ValidationError:
        raise
    except AuthenticationError:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        sys.stderr.write(f"[ERROR] Change password error: {str(e)}\n")
        sys.stderr.flush()
        raise DatabaseError(f"An unexpected error occurred while changing password: {str(e)}")




@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise AuthenticationError("Invalid user session: User ID not found")
        
        # Use supabase_admin to bypass RLS policies
        response = supabase_admin.table("users").select("*").eq("id", user_id).execute()
        
        if not response.data:
            # Auto-provision user profile if it doesn't exist
            sys.stderr.write(f"[INFO] User {user_id} not found in users table, auto-provisioning profile...\n")
            sys.stderr.flush()
            try:
                email = current_user.get("email") if isinstance(current_user, dict) else None
                full_name = None
                
                # Try to get name from user_metadata
                metadata = None
                if isinstance(current_user, dict):
                    metadata = current_user.get("user_metadata") or current_user.get("userMetaData")
                if isinstance(metadata, dict):
                    full_name = metadata.get("full_name") or metadata.get("name")
                
                if not full_name and email:
                    full_name = email.split("@")[0].replace(".", " ").title()
                full_name = full_name or "User"
                
                # Determine role from metadata or default to care_recipient
                role = "care_recipient"
                if isinstance(metadata, dict):
                    role = metadata.get("role", "care_recipient")
                
                insert_payload = {
                    "id": str(user_id),
                    "email": email or f"user-{user_id}@example.com",
                    "full_name": full_name,
                    "role": role,
                    "is_active": True,
                }
                
                insert_resp = supabase_admin.table("users").insert(insert_payload).execute()
                if insert_resp.data:
                    sys.stderr.write(f"[INFO] Auto-provisioned user profile for {user_id}\n")
                    sys.stderr.flush()
                    return insert_resp.data[0]
                else:
                    raise DatabaseError("Failed to auto-provision user profile")
            except Exception as provision_error:
                sys.stderr.write(f"[ERROR] Error auto-provisioning user profile: {provision_error}\n")
                sys.stderr.flush()
                # Re-raise as DatabaseError but don't expose internal details too much
                raise DatabaseError(f"User profile could not be created: {str(provision_error)}")
        
        return response.data[0]
        
    except AuthenticationError:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        sys.stderr.write(f"[ERROR] Error in /api/auth/me: {str(e)}\n")
        sys.stderr.write(f"Traceback: {error_details}\n")
        sys.stderr.flush()
        raise DatabaseError(
            f"Failed to retrieve user profile: {str(e)}"
        )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout current user"""
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        sys.stderr.write(f"[ERROR] Logout error: {str(e)}\n")
        sys.stderr.flush()
        raise DatabaseError(f"Logout failed: {str(e)}")



@router.get("/google/url")
async def get_google_oauth_url(redirect_to: Optional[str] = None):
    """
    Get Google OAuth URL for authentication.
    This endpoint returns the URL that the frontend should redirect to for Google sign-in.
    The frontend should use Supabase client directly for OAuth, but this endpoint provides
    a helper to get the OAuth URL.
    """
    try:
        from app.config import settings
        import os
        
        # Get the redirect URL - use the one provided or construct from environment
        if not redirect_to:
            # Get from environment variable or fail
            redirect_to = os.getenv('OAUTH_REDIRECT_URL')
            if not redirect_to:
                raise ValidationError(
                    "redirect_to parameter is required or OAUTH_REDIRECT_URL must be set",
                    "redirect_to"
                )
        
        # Construct Supabase OAuth URL
        # Supabase OAuth URL format: {SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to={redirect_to}
        supabase_url = settings.SUPABASE_URL.rstrip('/')
        oauth_url = f"{supabase_url}/auth/v1/authorize?provider=google&redirect_to={redirect_to}"
        
        sys.stderr.write(f"[INFO] Generated Google OAuth URL with redirect_to: {redirect_to}\n")
        sys.stderr.flush()
        
        return {
            "url": oauth_url,
            "redirect_to": redirect_to,
            "provider": "google"
        }
        
    except ValidationError:
        raise
    except Exception as e:
        sys.stderr.write(f"[ERROR] Error generating Google OAuth URL: {str(e)}\n")
        sys.stderr.flush()
        raise DatabaseError(f"Failed to generate OAuth URL: {str(e)}")


@router.get("/google/callback")
async def google_oauth_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None):
    """
    Handle Google OAuth callback.
    This endpoint is called by Google after authentication.
    """
    try:
        if error:
            sys.stderr.write(f"[ERROR] Google OAuth error: {error}\n")
            sys.stderr.flush()
            raise AuthenticationError(f"Google authentication failed: {error}")
        
        if not code:
            raise ValidationError("Authorization code not provided", "code")
        
        # Exchange code for session
        # Note: Supabase handles this automatically, but we need to handle the callback
        # The frontend should handle the redirect and extract the session
        
        # For now, return a response that tells the frontend to extract the session
        return JSONResponse(
            content={
                "message": "OAuth callback received. Please extract session from URL hash.",
                "code": code
            }
        )
        
    except (ValidationError, AuthenticationError):
        raise
    except Exception as e:
        sys.stderr.write(f"[ERROR] Error in Google OAuth callback: {str(e)}\n")
        sys.stderr.flush()
        raise DatabaseError(f"OAuth callback processing failed: {str(e)}")


@router.post("/google/verify")
async def verify_google_session(session_data: dict):
    """
    Verify and process Google OAuth session from frontend.
    The frontend should call this after receiving the OAuth callback from Supabase.
    Supabase handles the OAuth flow, and the frontend receives a session.
    This endpoint verifies the session and ensures the user profile exists.
    """
    try:
        access_token = session_data.get("access_token")
        refresh_token = session_data.get("refresh_token")
        
        if not access_token:
            raise ValidationError("Access token not provided", "access_token")
        
        # Verify the token by getting the user
        # Use the access token to get user info
        user_response = supabase.auth.get_user(access_token)
        
        if not user_response.user:
            raise AuthenticationError("Invalid access token or expired session")
        
        user = user_response.user
        user_id = user.id if hasattr(user, 'id') else user.get('id') if isinstance(user, dict) else str(user)
        
        # Ensure user profile exists
        profile_check = supabase_admin.table("users").select("*").eq("id", user_id).execute()
        
        if not profile_check.data:
            # Auto-provision user profile from Google OAuth data
            email = user.email if hasattr(user, 'email') else user.get('email') if isinstance(user, dict) else None
            metadata = user.user_metadata if hasattr(user, 'user_metadata') else user.get('user_metadata') if isinstance(user, dict) else {}
            
            # Extract name from metadata
            full_name = None
            if isinstance(metadata, dict):
                full_name = metadata.get("full_name") or metadata.get("name")
            
            # If no name in metadata, try to construct from email
            if not full_name and email:
                full_name = email.split("@")[0].replace(".", " ").title()
            
            full_name = full_name or "User"
            
            # Get profile photo from metadata
            profile_photo_url = None
            if isinstance(metadata, dict):
                profile_photo_url = metadata.get("avatar_url") or metadata.get("picture")
            
            # Default role to care_recipient (can be changed later)
            role = metadata.get("role", "care_recipient") if isinstance(metadata, dict) else "care_recipient"
            
            profile_data = {
                "id": str(user_id),
                "email": email or f"user-{user_id}@example.com",
                "full_name": full_name,
                "role": role,
                "is_active": True,
                "profile_photo_url": profile_photo_url
            }
            
            insert_response = supabase_admin.table("users").insert(profile_data).execute()
            if not insert_response.data:
                sys.stderr.write(f"[WARN] Failed to create user profile for {user_id}\n")
                sys.stderr.flush()
                # Not raising error here to allow login to proceed, but logging warning
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token or "",
            "token_type": "bearer",
            "user": user
        }
        
    except (ValidationError, AuthenticationError):
        raise
    except Exception as e:
        sys.stderr.write(f"[ERROR] Error verifying Google session: {str(e)}\n")
        sys.stderr.flush()
        raise DatabaseError(f"Failed to verify Google session: {str(e)}")

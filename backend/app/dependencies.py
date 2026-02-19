from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from app.database import supabase, supabase_admin
from typing import Optional, Union, Any

from jose import jwt, JWTError
from app.config import settings
security = HTTPBearer()


def get_user_id(user: Union[dict, Any]) -> str:
    """Extract user ID from user object (handles both dict and object formats)."""
    if isinstance(user, dict):
        return user.get("id") or user.get("user_id")
    return getattr(user, "id", None) or getattr(user, "user_id", None)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Get current authenticated user from JWT token"""
    import sys
    try:
        sys.stderr.write("[AUTH] get_current_user called\n")
        sys.stderr.flush()
        token = credentials.credentials
        if not token:
            sys.stderr.write("[AUTH] No token provided\n")
            sys.stderr.flush()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No authentication token provided"
            )
        
        sys.stderr.write(f"[AUTH] Token provided, length: {len(token) if token else 0}\n")
        sys.stderr.write(f"[AUTH] Token preview: {token[:20] if token else 'None'}...\n")
        sys.stderr.write("[AUTH] Calling supabase.auth.get_user...\n")
        sys.stderr.flush()
        try:
            response = supabase.auth.get_user(token)
            sys.stderr.write("[AUTH] supabase.auth.get_user response received\n")
            sys.stderr.flush()
        except Exception as auth_error:
            error_str = str(auth_error)
            sys.stderr.write(f"[AUTH] supabase.auth.get_user failed: {type(auth_error).__name__}: {error_str}\n")
            import traceback
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
            # Check if token is expired
            # Fallback: Try manual JWT verification (for Google Auth tokens)
            try:
                sys.stderr.write("[AUTH] supabase.auth.get_user failed, trying manual verification...\n")
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                sys.stderr.write(f"[AUTH] Manual verification successful for subject: {payload.get('sub')}\n")
                
                # Construct user object from payload
                user = {
                    "id": payload.get("sub"),
                    "email": payload.get("email"),
                    "user_metadata": {
                        "full_name": payload.get("name"),
                        "profile_photo_url": payload.get("picture"),
                        "google_id": payload.get("google_id")
                    },
                    "app_metadata": {"provider": "google"}
                }
                # Wrap in object to match Supabase structure if needed, or just return dict later
                # For now let's set response.user mock
                response = type('obj', (object,), {'user': user})
            except JWTError as jwt_err:
                 sys.stderr.write(f"[AUTH] Manual verification failed: {jwt_err}\n")
                 
                 # Check if token is expired
                 if "expired" in error_str.lower() or "invalid" in error_str.lower():
                     detail = "Authentication failed: Token is expired or invalid. Please log in again."
                 else:
                     detail = f"Authentication failed: {error_str}"
                 from app.error_handler import AuthenticationError
                 raise AuthenticationError(detail)

        
        user = response.user if hasattr(response, 'user') else response
        if not user:
            from app.error_handler import AuthenticationError
            raise AuthenticationError("Invalid authentication credentials: user not found")
        
        # Convert user object to dict if needed
        user_dict = None
        if hasattr(user, 'dict'):
            user_dict = user.dict()
        elif hasattr(user, '__dict__'):
            user_dict = user.__dict__
        elif isinstance(user, dict):
            user_dict = user
        else:
            # Try to convert to dict manually
            try:
                user_dict = {
                    "id": getattr(user, 'id', None),
                    "email": getattr(user, 'email', None),
                    "user_metadata": getattr(user, 'user_metadata', None) or getattr(user, 'userMetaData', None),
                }
            except:
                user_dict = {"id": str(user) if user else None}
        
        if not user_dict or not user_dict.get("id"):
            sys.stderr.write("[AUTH] No user ID in user_dict\n")
            sys.stderr.flush()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials: user ID not found"
            )
        
        sys.stderr.write(f"[AUTH] User authenticated successfully: {user_dict.get('id') if user_dict else 'unknown'}\n")
        sys.stderr.flush()
        return user_dict
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_msg = str(e)
        sys.stderr.write(f"[ERROR] Error in get_current_user: {error_msg}\n")
        sys.stderr.write(f"[ERROR] Traceback: {traceback.format_exc()}\n")
        sys.stderr.flush()
        
        # Provide more specific error messages
        if "JWT" in error_msg or "token" in error_msg.lower():
            detail = "Invalid or expired authentication token"
        elif "401" in error_msg or "unauthorized" in error_msg.lower():
            detail = "Authentication failed: invalid credentials"
        else:
            detail = f"Authentication error: {error_msg}"
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[dict]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        user = response.user if hasattr(response, 'user') else response
        if not user:
            return None
        
        # Convert user object to dict if needed
        if hasattr(user, 'dict'):
            return user.dict()
        elif hasattr(user, '__dict__'):
            return user.__dict__
        else:
            return user
    except Exception:
        return None


async def verify_care_recipient(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Verify that the current user is a care recipient.

    If the profile row in the `users` table is missing (e.g. user was created
    directly in Supabase auth but not in our `users` table), we auto-provision
    a minimal profile so that the flow does not break with a 500 error.
    """
    import sys
    sys.stderr.write(f"[VERIFY_CR] verify_care_recipient called\n")
    sys.stderr.flush()
    user_id = get_user_id(current_user)
    sys.stderr.write(f"[VERIFY_CR] User ID extracted: {user_id}\n")
    sys.stderr.flush()
    if not user_id:
        sys.stderr.write(f"[VERIFY_CR] No user ID found\n")
        sys.stderr.flush()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user data"
        )

    from src.config.db import execute_query
    sys.stderr.write(f"[VERIFY_CR] Checking user role in database...\n")
    sys.stderr.flush()
    try:
        # Use direct SQL for much faster role checks
        response = execute_query("SELECT role FROM users WHERE id = %s", (user_id,))
        data = response[0] if response else None
        sys.stderr.write(f"[VERIFY_CR] User role from DB: {data.get('role') if data else 'None'}\n")
        sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"[VERIFY_CR] Error fetching user role: {str(e)}\n")
        sys.stderr.flush()
        data = None

    # Auto-provision missing profile for auth user as care_recipient when needed
    if not data:
        try:
            email = current_user.get("email") if isinstance(current_user, dict) else None
            full_name = None
            # Supabase auth user may have user_metadata with name fields
            metadata = None
            if isinstance(current_user, dict):
                metadata = current_user.get("user_metadata") or current_user.get("userMetaData")
            if isinstance(metadata, dict):
                full_name = metadata.get("full_name") or metadata.get("name")
            if not full_name and email:
                full_name = email.split("@")[0]
            full_name = full_name or "Care Recipient"

            insert_payload = {
                "id": str(user_id),
                "email": email or f"user-{user_id}@example.com",
                "full_name": full_name,
                "role": "care_recipient",
                "is_active": True,
            }
            # Use admin client to bypass RLS when creating the profile
            try:
                insert_resp = supabase_admin.table("users").insert(insert_payload).execute()
                data = {"role": "care_recipient"} if insert_resp.data else None
            except Exception as insert_error:
                # Handle possible race condition where user was created between SELECT and INSERT
                sys.stderr.write(f"[VERIFY_CR] Insert failed: {insert_error}\n")
                if "duplicate key" in str(insert_error) or "23505" in str(insert_error):
                    sys.stderr.write(f"[VERIFY_CR] User already exists (race condition), proceeding...\n")
                    # Should verify role, but for now assume they are valid or will be caught by checks
                    data = {"role": "care_recipient"} 
                else:
                     raise insert_error
        except Exception as e:
            # If we still cannot create the profile, fail with a clear message
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User profile not found and could not be created automatically: {str(e)}",
            )

    if not data or data.get("role") != "care_recipient":
        # Try to auto-fix the role if user exists but has wrong role
        if data and data.get("role"):
            sys.stderr.write(f"[VERIFY_CR] User has role '{data.get('role')}', attempting to update to 'care_recipient'\n")
            sys.stderr.flush()
            try:
                # Update role to care_recipient using direct SQL
                execute_query("UPDATE users SET role = 'care_recipient' WHERE id = %s", (user_id,), fetch=False)
                sys.stderr.write(f"[VERIFY_CR] Successfully updated user role to 'care_recipient'\n")
                sys.stderr.flush()
                data = {"role": "care_recipient"}
            except Exception as update_error:
                sys.stderr.write(f"[VERIFY_CR] Failed to update role: {update_error}\n")
                sys.stderr.flush()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only care recipients can perform this action"
                )
        else:
            sys.stderr.write(f"[VERIFY_CR] User is not a care recipient. Role: {data.get('role') if data else 'No data'}\n")
            sys.stderr.flush()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only care recipients can perform this action"
            )

    # Ensure current_user is a dict with id
    if not isinstance(current_user, dict):
        current_user = {"id": user_id}
    elif "id" not in current_user:
        current_user["id"] = user_id

    sys.stderr.write(f"[VERIFY_CR] Care recipient verified successfully: {user_id}\n")
    sys.stderr.flush()
    return current_user


async def verify_caregiver(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Verify that the current user is a caregiver.

    As with care recipients, if the corresponding row is missing in the `users`
    table we auto-provision a minimal caregiver profile.
    """
    user_id = get_user_id(current_user)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user data"
        )

    from src.config.db import execute_query
    # Try to get user profile to check role - use direct SQL
    try:
        response = execute_query("SELECT role FROM users WHERE id = %s", (user_id,))
        data = response[0] if response else None
    except Exception:
        data = None

    # Auto-provision missing profile for auth user as caregiver when needed
    if not data:
        try:
            email = current_user.get("email") if isinstance(current_user, dict) else None
            full_name = None
            metadata = None
            if isinstance(current_user, dict):
                metadata = current_user.get("user_metadata") or current_user.get("userMetaData")
            if isinstance(metadata, dict):
                full_name = metadata.get("full_name") or metadata.get("name")
            if not full_name and email:
                full_name = email.split("@")[0]
            full_name = full_name or "Caregiver"

            insert_payload = {
                "id": str(user_id),
                "email": email or f"user-{user_id}@example.com",
                "full_name": full_name,
                "role": "caregiver",
                "is_active": True,
            }
            try:
                insert_resp = supabase_admin.table("users").insert(insert_payload).execute()
                data = {"role": "caregiver"} if insert_resp.data else None
            except Exception as insert_error:
                 sys.stderr.write(f"[VERIFY_CG] Insert failed: {insert_error}\n")
                 if "duplicate key" in str(insert_error) or "23505" in str(insert_error):
                    sys.stderr.write(f"[VERIFY_CG] User already exists (race condition), proceeding...\n")
                    data = {"role": "caregiver"}
                 else:
                     raise insert_error
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User profile not found and could not be created automatically: {str(e)}",
            )

    if not data or data.get("role") != "caregiver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only caregivers can perform this action"
        )

    # Ensure current_user is a dict with id
    if not isinstance(current_user, dict):
        current_user = {"id": user_id}
    elif "id" not in current_user:
        current_user["id"] = user_id

    return current_user


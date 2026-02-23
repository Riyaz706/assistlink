from fastapi import APIRouter, HTTPException, status, Depends, File, UploadFile
from datetime import datetime
from app.schemas import UserUpdate, UserResponse
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user, get_user_id

# Bucket for profile photos in Supabase Storage (create in Dashboard and set to public)
PROFILE_PHOTOS_BUCKET = "profile-photos"

router = APIRouter()


@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user data: user ID not found"
            )
        
        # Convert to string to ensure proper matching
        user_id_str = str(user_id)
        
        # Try with regular supabase first, fallback to admin if needed
        try:
            response = supabase.table("users").select("*").eq("id", user_id_str).execute()
        except Exception as query_error:
            error_msg = str(query_error).lower()
            # If it's a "not found" error, try with admin client
            if "not found" in error_msg or "0 rows" in error_msg or "pgrst116" in error_msg:
                # Try with admin client to bypass RLS
                try:
                    response = supabase_admin.table("users").select("*").eq("id", user_id_str).execute()
                except Exception as admin_error:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User profile not found"
                    )
            else:
                raise
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        # Ensure emergency_contact is set to None if not present (for backward compatibility)
        user_data = response.data[0] if response.data else None
        if not user_data:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        if 'emergency_contact' not in user_data:
            user_data['emergency_contact'] = None
        
        # Convert the response to UserResponse model to ensure proper serialization
        return UserResponse(**user_data)
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "not found" in error_msg or "0 rows" in error_msg or "pgrst116" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user profile"""
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user data: user ID not found"
            )
        
        # Convert to string to ensure proper matching
        user_id_str = str(user_id)
        
        # First, check if user exists - try with regular supabase, fallback to admin
        try:
            check_response = supabase.table("users").select("id").eq("id", user_id_str).execute()
        except Exception as check_error:
            error_msg = str(check_error).lower()
            if "not found" in error_msg or "0 rows" in error_msg or "pgrst116" in error_msg:
                # Try with admin client
                try:
                    check_response = supabase_admin.table("users").select("id").eq("id", user_id_str).execute()
                except Exception:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User profile not found"
                    )
            else:
                raise
        
        if not check_response.data or len(check_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        update_data = user_update.model_dump(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Convert datetime objects to ISO strings for Supabase
        if 'date_of_birth' in update_data and update_data['date_of_birth']:
            if isinstance(update_data['date_of_birth'], datetime):
                update_data['date_of_birth'] = update_data['date_of_birth'].isoformat()
        
        # Try with regular supabase first, fallback to admin if RLS blocks it
        try:
            response = supabase.table("users").update(update_data).eq("id", user_id_str).execute()
        except Exception as update_error:
            # If RLS blocks the update, try with admin client
            response = supabase_admin.table("users").update(update_data).eq("id", user_id_str).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found or update failed"
            )
        
        # Convert the response to UserResponse model to ensure proper serialization
        return UserResponse(**response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Allowed image types for profile photo
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/profile/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload profile photo to cloud (Supabase Storage) and update user profile_photo_url."""
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user data: user ID not found",
            )
        user_id_str = str(user_id)

        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: JPEG, PNG, WebP, GIF. Got: {content_type or 'unknown'}",
            )

        body = await file.read()
        if len(body) > MAX_PROFILE_PHOTO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 5 MB.",
            )

        # Use a fixed path per user so uploading again overwrites (upsert)
        ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "png" if "png" in content_type else "webp" if "webp" in content_type else "gif"
        storage_path = f"{user_id_str}/avatar.{ext}"

        storage = supabase_admin.storage.from_(PROFILE_PHOTOS_BUCKET)
        storage.upload(
            path=storage_path,
            file=body,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public_url = storage.get_public_url(storage_path)

        # Update user profile with new photo URL
        supabase_admin.table("users").update({"profile_photo_url": public_url}).eq("id", user_id_str).execute()

        return {"profile_photo_url": public_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}",
        )


from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from app.validators import (
    validate_email,
    validate_phone,
    validate_password,
    validate_date_of_birth,
    validate_role,
    sanitize_string
)


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    role: str = Field(..., pattern="^(care_recipient|caregiver)$")
    address: Optional[Dict[str, Any]] = None
    profile_photo_url: Optional[str] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    
    @field_validator('email')
    @classmethod
    def validate_email_field(cls, v):
        return validate_email(v)
    
    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        v = sanitize_string(v, max_length=255)
        if not v or len(v) < 2:
            raise ValueError("Full name must be at least 2 characters long")
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone_field(cls, v):
        if v:
            return validate_phone(v)
        return v
    
    @field_validator('role')
    @classmethod
    def validate_role_field(cls, v):
        return validate_role(v)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    
    @field_validator('password')
    @classmethod
    def validate_password_field(cls, v):
        return validate_password(v, min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class PasswordChangeRequest(BaseModel):
    current_password: Optional[str] = Field(None, min_length=1)
    new_password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    address: Optional[Dict[str, Any]] = None
    profile_photo_url: Optional[str] = None
    emergency_contact: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    current_location: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Caregiver Profile Schemas
class CaregiverProfileBase(BaseModel):
    skills: Optional[List[str]] = None
    availability_status: str = Field(default="unavailable", pattern="^(available|unavailable|busy)$")
    availability_schedule: Optional[Dict[str, Any]] = None
    qualifications: Optional[List[str]] = None
    experience_years: Optional[int] = None
    bio: Optional[str] = None
    hourly_rate: Optional[float] = None

    @field_validator('bio')
    @classmethod
    def validate_bio_field(cls, v):
        if v:
            return sanitize_string(v, max_length=2000)
        return v


class CaregiverProfileCreate(CaregiverProfileBase):
    pass


class CaregiverProfileUpdate(CaregiverProfileBase):
    pass


class CaregiverProfileResponse(CaregiverProfileBase):
    id: UUID
    user_id: UUID
    avg_rating: float
    total_reviews: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Video Call Request Schemas
class VideoCallRequestCreate(BaseModel):
    caregiver_id: UUID
    scheduled_time: datetime
    duration_seconds: int = Field(default=15, le=60)


class VideoCallRequestResponse(BaseModel):
    id: UUID
    care_recipient_id: UUID
    caregiver_id: UUID
    scheduled_time: datetime
    duration_seconds: int
    status: str
    care_recipient_accepted: bool
    caregiver_accepted: bool
    video_call_url: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VideoCallAcceptRequest(BaseModel):
    accept: bool


# Chat Session Schemas
class ChatSessionResponse(BaseModel):
    id: UUID
    care_recipient_id: UUID
    caregiver_id: UUID
    video_call_request_id: Optional[UUID] = None
    is_enabled: bool
    care_recipient_accepted: bool
    caregiver_accepted: bool
    enabled_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatAcceptRequest(BaseModel):
    accept: bool


# Booking Schemas
class BookingBase(BaseModel):
    service_type: str = Field(..., pattern="^(exam_assistance|daily_care|one_time|recurring|video_call_session)$")
    scheduled_date: datetime
    duration_hours: float = Field(default=2.0, ge=0.5, le=24.0)
    location: Optional[Dict[str, Any]] = None
    specific_needs: Optional[str] = None
    is_recurring: bool = False
    recurring_pattern: Optional[Dict[str, Any]] = None
    urgency_level: str = Field(default="medium", pattern="^(low|medium|high|emergency)$")
    specific_requirements: Optional[str] = None
    
    @field_validator('specific_needs', 'specific_requirements')
    @classmethod
    def validate_text_fields(cls, v):
        if v:
            return sanitize_string(v, max_length=1000)
        return v


class BookingCreate(BookingBase):
    caregiver_id: Optional[UUID] = None
    status: str = Field(default="requested", pattern="^(draft|requested)$")


class BookingUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    duration_hours: Optional[float] = None
    location: Optional[Dict[str, Any]] = None
    specific_needs: Optional[str] = None
    urgency_level: Optional[str] = None
    specific_requirements: Optional[str] = None
    caregiver_notes: Optional[str] = None
    status: Optional[str] = None  # Restricted transitions handled in logic
    
    @field_validator('specific_needs', 'specific_requirements', 'caregiver_notes')
    @classmethod
    def validate_text_fields(cls, v):
        if v:
            return sanitize_string(v, max_length=1000)
        return v


class BookingResponse(BaseModel):
    id: UUID
    care_recipient_id: UUID
    caregiver_id: Optional[UUID] = None
    video_call_request_id: Optional[UUID] = None
    chat_session_id: Optional[UUID] = None
    service_type: str
    scheduled_date: datetime
    duration_hours: float
    location: Optional[Dict[str, Any]] = None
    specific_needs: Optional[str] = None
    recurring_pattern: Optional[Dict[str, Any]] = None
    is_recurring: bool
    status: str
    urgency_level: Optional[str] = "medium"
    specific_requirements: Optional[str] = None
    caregiver_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    cancellation_reason: Optional[str] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    caregiver: Optional[UserBase] = None
    care_recipient: Optional[UserBase] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BookingHistoryResponse(BaseModel):
    id: UUID
    booking_id: UUID
    previous_status: Optional[str]
    new_status: str
    changed_by: Optional[UUID]
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class BookingNoteCreate(BaseModel):
    note: str = Field(..., min_length=1)
    is_private: bool = False

    @field_validator('note')
    @classmethod
    def validate_note(cls, v):
        return sanitize_string(v, max_length=2000)


class BookingNoteResponse(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: Optional[UUID]
    note: str
    is_private: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BookingStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(accepted|rejected|confirmed|in_progress|completed|cancelled)$")
    reason: Optional[str] = None



# Location Schemas
class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    
    @field_validator('latitude', 'longitude')
    @classmethod
    def validate_coordinates_field(cls, v, info):
        # Additional validation beyond Field constraints
        if info.field_name == 'latitude' and not (-90 <= v <= 90):
            raise ValueError("Latitude must be between -90 and 90 degrees")
        if info.field_name == 'longitude' and not (-180 <= v <= 180):
            raise ValueError("Longitude must be between -180 and 180 degrees")
        return v
    
    @field_validator('address')
    @classmethod
    def validate_address_field(cls, v):
        if v:
            return sanitize_string(v, max_length=500)
        return v


class LocationResponse(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    timestamp: datetime


# Dashboard Schemas
class DashboardStats(BaseModel):
    upcoming_bookings: int
    active_bookings: int
    completed_bookings: int
    pending_video_calls: int
    active_chat_sessions: int
    total_earnings: float = 0.0
    avg_rating: float = 0.0


# Message Schemas
class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    message_type: str = Field(default="text", pattern="^(text|image|document)$")
    attachment_url: Optional[str] = None
    
    @field_validator('content')
    @classmethod
    def validate_content_field(cls, v):
        return sanitize_string(v, max_length=5000)


class MessageResponse(BaseModel):
    id: UUID
    chat_session_id: UUID
    sender_id: UUID
    recipient_id: UUID
    content: str
    message_type: str
    attachment_url: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Notification Schemas
class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceTokenCreate(BaseModel):
    device_token: str
    platform: str = Field(..., pattern="^(ios|android|web)$")
    device_info: Optional[Dict[str, Any]] = None


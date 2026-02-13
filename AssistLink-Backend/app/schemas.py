from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


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


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


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


class BookingCreate(BookingBase):
    caregiver_id: Optional[UUID] = None


class BookingUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    duration_hours: Optional[float] = None
    location: Optional[Dict[str, Any]] = None
    specific_needs: Optional[str] = None
    status: Optional[str] = None


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
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Location Schemas
class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None


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


# Message Schemas
class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    message_type: str = Field(default="text", pattern="^(text|image|document)$")
    attachment_url: Optional[str] = None


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


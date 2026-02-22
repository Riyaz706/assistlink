from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional
import os

# Always load .env from the directory this file lives in (backend/),
# regardless of where the Python process was started.
_ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")


class Settings(BaseSettings):
    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # Database Configuration (direct PostgreSQL connection)
    DATABASE_URL: Optional[str] = None  # Optional: full connection string
    SUPABASE_DB_PASSWORD: Optional[str] = None  # Required if DATABASE_URL not provided
    
    # Server Configuration
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    
    # CORS Configuration
    CORS_ORIGINS: str = "*"  # Changed to str to accept "*" or comma-separated values
    
    # Video Call Configuration
    VIDEO_CALL_DURATION_SECONDS: int = 15
    
    # Firebase Cloud Messaging (FCM) for Push Notifications
    FCM_SERVICE_ACCOUNT_PATH: Optional[str] = None  # Path to service account JSON file
    
    # Twilio Video Configuration
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_API_KEY: Optional[str] = None
    TWILIO_API_SECRET: Optional[str] = None
    
    # Razorpay Payment Configuration
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_BYPASS_MODE: bool = False

    @field_validator("RAZORPAY_BYPASS_MODE", mode="before")
    @classmethod
    def parse_bypass_mode(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return False
    
    # Video Call Configuration
    VIDEO_PROVIDER: str = "webrtc"  # Options: jitsi, webrtc
    
    # Google OAuth Configuration
    GOOGLE_WEB_CLIENT_ID: Optional[str] = None
    GOOGLE_IOS_CLIENT_ID: Optional[str] = None
    GOOGLE_ANDROID_CLIENT_ID: Optional[str] = None
    
    # Security Configuration
    SECRET_KEY: str = "default-secret-key-please-change"

    # Backend Feature Kill Switches
    ENABLE_TWILIO: bool = True
    ENABLE_RAZORPAY: bool = True
    ENABLE_PUSH_NOTIFICATIONS: bool = True
    
    class Config:
        env_file = _ENV_FILE
        case_sensitive = True
        extra = "ignore"  # Allow extra fields in .env file


settings = Settings()


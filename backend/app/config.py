from pydantic_settings import BaseSettings
from typing import List, Optional


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
    # Use Service Account JSON file path (recommended) or set GOOGLE_APPLICATION_CREDENTIALS env var
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
    
    # Video Call Configuration
    VIDEO_PROVIDER: str = "twilio" # Options: jitsi, twilio
    
    # Google OAuth Configuration
    GOOGLE_WEB_CLIENT_ID: Optional[str] = None
    GOOGLE_IOS_CLIENT_ID: Optional[str] = None
    GOOGLE_ANDROID_CLIENT_ID: Optional[str] = None
    
    # Security Configuration
    SECRET_KEY: str = "default-secret-key-please-change"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Allow extra fields in .env file


settings = Settings()


"""
Input validation utilities for AssistLink API
Provides validators for common data types and formats
"""
import re
from typing import Optional
from datetime import datetime, date
from pydantic import validator


# Regex patterns
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
PHONE_REGEX = re.compile(r'^\+?[1-9]\d{1,14}$')  # E.164 format
INDIAN_PHONE_REGEX = re.compile(r'^(\+91|91)?[6-9]\d{9}$')


def validate_email(email: str) -> str:
    """Validate email format"""
    if not email:
        raise ValueError("Email is required")
    
    email = email.strip().lower()
    
    if not EMAIL_REGEX.match(email):
        raise ValueError("Invalid email format")
    
    if len(email) > 255:
        raise ValueError("Email is too long (max 255 characters)")
    
    return email


def validate_phone(phone: str, country: str = "IN") -> str:
    """Validate phone number format"""
    if not phone:
        raise ValueError("Phone number is required")
    
    phone = phone.strip().replace(" ", "").replace("-", "")
    
    if country == "IN":
        if not INDIAN_PHONE_REGEX.match(phone):
            raise ValueError("Invalid Indian phone number format. Use format: +91XXXXXXXXXX or 10-digit number starting with 6-9")
        # Normalize to +91 format
        if not phone.startswith("+"):
            if phone.startswith("91") and len(phone) == 12:
                phone = phone[2:]
            phone = f"+91{phone}"
    else:
        # General E.164 format
        if not PHONE_REGEX.match(phone):
            raise ValueError("Invalid phone number format. Use E.164 format: +[country code][number]")
    
    return phone


def validate_password(password: str, min_length: int = 8) -> str:
    """Validate password strength"""
    if not password:
        raise ValueError("Password is required")
    
    if len(password) < min_length:
        raise ValueError(f"Password must be at least {min_length} characters long")
    
    if len(password) > 128:
        raise ValueError("Password is too long (max 128 characters)")
    
    # Check for at least one letter and one number
    has_letter = any(c.isalpha() for c in password)
    has_number = any(c.isdigit() for c in password)
    
    if not (has_letter and has_number):
        raise ValueError("Password must contain at least one letter and one number")
    
    return password


def validate_date_of_birth(dob: Optional[date]) -> Optional[date]:
    """Validate date of birth"""
    if not dob:
        return None
    
    today = date.today()
    
    if dob >= today:
        raise ValueError("Date of birth must be in the past")
    
    # Check minimum age (e.g., 18 years)
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 13:
        raise ValueError("User must be at least 13 years old")
    
    if age > 120:
        raise ValueError("Invalid date of birth")
    
    return dob


def validate_coordinates(latitude: float, longitude: float) -> tuple[float, float]:
    """Validate geographic coordinates"""
    if not (-90 <= latitude <= 90):
        raise ValueError("Latitude must be between -90 and 90 degrees")
    
    if not (-180 <= longitude <= 180):
        raise ValueError("Longitude must be between -180 and 180 degrees")
    
    return latitude, longitude


def validate_amount(amount: float, min_amount: float = 0.01, max_amount: float = 1000000) -> float:
    """Validate payment amount"""
    if amount < min_amount:
        raise ValueError(f"Amount must be at least {min_amount}")
    
    if amount > max_amount:
        raise ValueError(f"Amount cannot exceed {max_amount}")
    
    # Round to 2 decimal places
    return round(amount, 2)


def validate_currency(currency: str) -> str:
    """Validate currency code"""
    valid_currencies = ["INR", "USD", "EUR", "GBP"]
    
    currency = currency.upper().strip()
    
    if currency not in valid_currencies:
        raise ValueError(f"Invalid currency. Supported currencies: {', '.join(valid_currencies)}")
    
    return currency


def validate_future_datetime(dt: datetime, min_hours_ahead: int = 1) -> datetime:
    """Validate that datetime is in the future"""
    now = datetime.utcnow()
    
    if dt <= now:
        raise ValueError("Date and time must be in the future")
    
    # Check minimum time ahead
    time_diff = (dt - now).total_seconds() / 3600
    if time_diff < min_hours_ahead:
        raise ValueError(f"Booking must be at least {min_hours_ahead} hour(s) in advance")
    
    return dt


def validate_duration(duration_seconds: int, min_duration: int = 15, max_duration: int = 3600) -> int:
    """Validate duration in seconds"""
    if duration_seconds < min_duration:
        raise ValueError(f"Duration must be at least {min_duration} seconds")
    
    if duration_seconds > max_duration:
        raise ValueError(f"Duration cannot exceed {max_duration} seconds")
    
    return duration_seconds


def validate_role(role: str) -> str:
    """Validate user role"""
    valid_roles = ["care_recipient", "caregiver", "admin"]
    
    role = role.lower().strip()
    
    if role not in valid_roles:
        raise ValueError(f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    return role


def validate_booking_status(status: str) -> str:
    """Validate booking status"""
    valid_statuses = ["pending", "confirmed", "in_progress", "completed", "cancelled"]
    
    status = status.lower().strip()
    
    if status not in valid_statuses:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    return status


def validate_url(url: str, optional: bool = True) -> Optional[str]:
    """Validate URL format"""
    if not url:
        if optional:
            return None
        raise ValueError("URL is required")
    
    url = url.strip()
    
    # Basic URL validation
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE
    )
    
    if not url_pattern.match(url):
        raise ValueError("Invalid URL format")
    
    return url


def sanitize_string(text: str, max_length: Optional[int] = None) -> str:
    """Sanitize string input"""
    if not text:
        return ""
    
    # Strip whitespace
    text = text.strip()
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Limit length if specified
    if max_length and len(text) > max_length:
        raise ValueError(f"Text exceeds maximum length of {max_length} characters")
    
    return text


def validate_otp(otp: str) -> str:
    """Validate OTP format"""
    if not otp:
        raise ValueError("OTP is required")
    
    otp = otp.strip()
    
    if not otp.isdigit():
        raise ValueError("OTP must contain only digits")
    
    if len(otp) != 6:
        raise ValueError("OTP must be exactly 6 digits")
    
    return otp

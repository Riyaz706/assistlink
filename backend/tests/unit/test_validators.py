"""
Unit tests: backend validators (app/validators.py).
Purpose: Prevent invalid data reaching DB; ensure error messages are correct.
Run: pytest backend/tests/unit/test_validators.py -v
Failure: Validation logic bug; fix before release.
"""
import pytest
from datetime import date, datetime, timedelta, timezone
from app.validators import (
    validate_email,
    validate_phone,
    validate_password,
    validate_date_of_birth,
    validate_role,
    validate_booking_status,
    validate_coordinates,
    validate_future_datetime,
    validate_duration,
    sanitize_string,
    validate_otp,
)


class TestValidateEmail:
    def test_valid_email(self):
        assert validate_email("user@example.com") == "user@example.com"
        assert validate_email("  USER@DOMAIN.CO  ") == "user@domain.co"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="Email is required"):
            validate_email("")
        with pytest.raises(ValueError, match="Email is required"):
            validate_email("   ")

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError, match="Invalid email format"):
            validate_email("no-at-sign")
        with pytest.raises(ValueError, match="Invalid email format"):
            validate_email("@nodomain.com")

    def test_too_long_raises(self):
        with pytest.raises(ValueError, match="too long"):
            validate_email("a" * 256 + "@b.com")


class TestValidatePhone:
    def test_valid_indian_10_digit(self):
        assert validate_phone("9876543210", "IN") == "+919876543210"
        assert validate_phone("6123456789", "IN") == "+916123456789"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="Phone number is required"):
            validate_phone("", "IN")

    def test_invalid_indian_raises(self):
        with pytest.raises(ValueError, match="Invalid Indian"):
            validate_phone("5123456789", "IN")
        with pytest.raises(ValueError, match="Invalid Indian"):
            validate_phone("123", "IN")


class TestValidatePassword:
    def test_valid(self):
        assert validate_password("Pass1234") == "Pass1234"
        assert validate_password("MyP4ssw0rd") == "MyP4ssw0rd"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="Password is required"):
            validate_password("")

    def test_too_short_raises(self):
        with pytest.raises(ValueError, match="at least 8"):
            validate_password("Ab1")

    def test_no_letter_or_number_raises(self):
        with pytest.raises(ValueError, match="letter and one number"):
            validate_password("12345678")
        with pytest.raises(ValueError, match="letter and one number"):
            validate_password("abcdefgh")


class TestValidateDateOfBirth:
    def test_none_returns_none(self):
        assert validate_date_of_birth(None) is None

    def test_future_raises(self):
        tomorrow = date.today() + timedelta(days=1)
        with pytest.raises(ValueError, match="in the past"):
            validate_date_of_birth(tomorrow)

    def test_too_young_raises(self):
        # 12 years old
        young = date.today().replace(year=date.today().year - 12)
        with pytest.raises(ValueError, match="at least 13"):
            validate_date_of_birth(young)

    def test_valid_returns_same(self):
        d = date(1990, 6, 15)
        assert validate_date_of_birth(d) == d


class TestValidateRole:
    def test_valid_roles(self):
        assert validate_role("care_recipient") == "care_recipient"
        assert validate_role("caregiver") == "caregiver"
        assert validate_role("  CAREGIVER  ") == "caregiver"

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="Invalid role"):
            validate_role("unknown")


class TestValidateBookingStatus:
    def test_valid(self):
        assert validate_booking_status("pending") == "pending"
        assert validate_booking_status("completed") == "completed"

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="Invalid status"):
            validate_booking_status("invalid")


class TestValidateCoordinates:
    def test_valid(self):
        assert validate_coordinates(0, 0) == (0, 0)
        assert validate_coordinates(90, 180) == (90, 180)

    def test_lat_out_of_range_raises(self):
        with pytest.raises(ValueError, match="Latitude"):
            validate_coordinates(91, 0)
        with pytest.raises(ValueError, match="Latitude"):
            validate_coordinates(-91, 0)

    def test_lon_out_of_range_raises(self):
        with pytest.raises(ValueError, match="Longitude"):
            validate_coordinates(0, 181)


class TestValidateFutureDatetime:
    def test_past_raises(self):
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        with pytest.raises(ValueError, match="in the future"):
            validate_future_datetime(past)

    def test_too_soon_raises(self):
        soon = datetime.now(timezone.utc) + timedelta(minutes=30)
        with pytest.raises(ValueError, match="at least"):
            validate_future_datetime(soon, min_hours_ahead=1)


class TestValidateDuration:
    def test_valid(self):
        assert validate_duration(60) == 60
        assert validate_duration(15, min_duration=15) == 15

    def test_below_min_raises(self):
        with pytest.raises(ValueError, match="at least"):
            validate_duration(10, min_duration=15)

    def test_above_max_raises(self):
        with pytest.raises(ValueError, match="cannot exceed"):
            validate_duration(4000, max_duration=3600)


class TestSanitizeString:
    def test_strips_and_removes_null(self):
        assert sanitize_string("  a\x00b  ") == "ab"

    def test_max_length_raises(self):
        with pytest.raises(ValueError, match="maximum length"):
            sanitize_string("hello", max_length=3)


class TestValidateOtp:
    def test_valid_6_digits(self):
        assert validate_otp("123456") == "123456"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="OTP is required"):
            validate_otp("")

    def test_non_digit_raises(self):
        with pytest.raises(ValueError, match="only digits"):
            validate_otp("12a456")

    def test_wrong_length_raises(self):
        with pytest.raises(ValueError, match="exactly 6"):
            validate_otp("12345")

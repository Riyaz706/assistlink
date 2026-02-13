"""
Centralized error handling for AssistLink API
Provides custom exceptions, error responses, and logging utilities
"""
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from typing import Optional, Dict, Any
import traceback
import sys
from datetime import datetime
import uuid


class AppError(Exception):
    """Base exception for application errors"""
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or f"ERR_{status_code}"
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(AppError):
    """Authentication related errors"""
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTH_ERROR",
            details=details
        )


class AuthorizationError(AppError):
    """Authorization/Permission errors"""
    def __init__(self, message: str = "Permission denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="PERMISSION_DENIED",
            details=details
        )


class ValidationError(AppError):
    """Input validation errors"""
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            details=details
        )


class NotFoundError(AppError):
    """Resource not found errors"""
    def __init__(self, resource: str = "Resource", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=f"{resource} not found",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            details=details
        )


class DatabaseError(AppError):
    """Database operation errors"""
    def __init__(self, message: str = "Database operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            details=details
        )


class ExternalServiceError(AppError):
    """External service (Twilio, Razorpay, etc.) errors"""
    def __init__(self, service: str, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=f"{service} error: {message}",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code=f"{service.upper()}_ERROR",
            details=details
        )


class ConflictError(AppError):
    """Resource conflict errors (e.g., duplicate email)"""
    def __init__(self, message: str = "Resource conflict", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            details=details
        )


class RateLimitError(AppError):
    """Rate limiting errors"""
    def __init__(self, message: str = "Too many requests", retry_after: Optional[int] = None):
        details = {"retry_after": retry_after} if retry_after else {}
        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMIT_EXCEEDED",
            details=details
        )


def create_error_response(
    request_id: str,
    error: Exception,
    include_traceback: bool = False
) -> Dict[str, Any]:
    """Create standardized error response"""
    
    if isinstance(error, AppError):
        response = {
            "error": {
                "code": error.error_code,
                "message": error.message,
                "status": error.status_code,
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        if error.details:
            response["error"]["details"] = error.details
    elif isinstance(error, HTTPException):
        response = {
            "error": {
                "code": f"HTTP_{error.status_code}",
                "message": error.detail,
                "status": error.status_code,
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    else:
        response = {
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "status": 500,
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    
    if include_traceback:
        response["error"]["traceback"] = traceback.format_exc()
    
    return response


def log_error(
    request_id: str,
    error: Exception,
    request: Optional[Request] = None,
    user_id: Optional[str] = None
):
    """Log error with context"""
    error_info = {
        "request_id": request_id,
        "timestamp": datetime.utcnow().isoformat(),
        "error_type": type(error).__name__,
        "error_message": str(error),
        "user_id": user_id
    }
    
    if request:
        error_info.update({
            "method": request.method,
            "url": str(request.url),
            "client_host": request.client.host if request.client else None
        })
    
    # Log to stderr (can be replaced with proper logging framework)
    sys.stderr.write(f"[ERROR] {error_info}\n")
    
    # Include traceback for non-HTTP exceptions
    if not isinstance(error, (HTTPException, AppError)):
        sys.stderr.write(f"[TRACEBACK] {traceback.format_exc()}\n")
    
    sys.stderr.flush()


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handler for custom AppError exceptions"""
    request_id = str(uuid.uuid4())
    log_error(request_id, exc, request)
    
    response = create_error_response(request_id, exc)
    return JSONResponse(
        status_code=exc.status_code,
        content=response
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handler for FastAPI HTTPException"""
    request_id = str(uuid.uuid4())
    log_error(request_id, exc, request)
    
    response = create_error_response(request_id, exc)
    return JSONResponse(
        status_code=exc.status_code,
        content=response
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handler for request validation errors"""
    request_id = str(uuid.uuid4())
    
    # Extract validation errors
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    response = {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "status": 422,
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
            "details": {"validation_errors": errors}
        }
    }
    
    sys.stderr.write(f"[VALIDATION_ERROR] {request_id}: {errors}\n")
    sys.stderr.flush()
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handler for unhandled exceptions"""
    request_id = str(uuid.uuid4())
    log_error(request_id, exc, request)
    
    # Don't expose internal error details in production
    response = {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred. Please try again later.",
            "status": 500,
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response
    )

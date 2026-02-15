from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from app.routers import auth, users, caregivers, bookings, location, dashboard, chat, notifications, payments, google_auth, test, emergency
from app.config import settings
from src.config.db import get_db_connection, return_db_connection
from app.error_handler import (
    AppError,
    app_error_handler,
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler
)
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.limiter import limiter
import time
import traceback
import uuid
import sys

app = FastAPI(
    title="AssistLink Backend API",
    description="Backend API for AssistLink - Connecting care recipients with caregivers",
    version="1.0.0"
)

# Add request logging middleware with request ID tracking - MUST be before CORS middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Generate unique request ID for tracking
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    path_str = str(request.url.path)
    url_str = str(request.url)
    
    # Log ALL requests with request ID
    sys.stderr.write(f"[{request_id}] {request.method} {path_str}\n")
    sys.stderr.flush()
    
    # Log all requests to payment endpoints with more detail
    if "/api/payments" in path_str or "/api/payments" in url_str:
        sys.stderr.write(f"[{request_id}] ===== PAYMENT REQUEST =====\n")
        sys.stderr.write(f"[{request_id}] Method: {request.method}\n")
        sys.stderr.write(f"[{request_id}] Full URL: {url_str}\n")
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        sys.stderr.write(f"[{request_id}] Auth: {'Present' if auth_header else 'Missing'}\n")
        sys.stderr.flush()
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Add request ID to response headers for client-side debugging
        response.headers["X-Request-ID"] = request_id
        
        # Log completion with time for ALL requests
        sys.stderr.write(f"[{request_id}] DONE {response.status_code} in {process_time:.3f}s\n")
        sys.stderr.flush()
        
        return response
    except HTTPException as http_exc:
        process_time = time.time() - start_time
        sys.stderr.write(f"[{request_id}] HTTPException: {http_exc.status_code} - {http_exc.detail} after {process_time:.3f}s\n")
        sys.stderr.flush()
        raise
    except ResponseValidationError as validation_exc:
        process_time = time.time() - start_time
        sys.stderr.write(f"[{request_id}] Response Validation Error after {process_time:.3f}s\n")
        for error in validation_exc.errors():
            sys.stderr.write(f"[{request_id}] Validation error: {error}\n")
        sys.stderr.flush()
        # Return 500 Internal Server Error but don't expose strict schema details to client
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal Server Error: Response validation failed"}
        )
    except Exception as e:
        process_time = time.time() - start_time
        sys.stderr.write(f"[{request_id}] ERROR: {type(e).__name__}: {str(e)} after {process_time:.3f}s\n")
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        raise

# Register custom error handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ResponseValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Initialize limiter
app.state.limiter = limiter

# CORS middleware
# Handle CORS_ORIGINS as string ("*" or comma-separated)
cors_origins = settings.CORS_ORIGINS
if isinstance(cors_origins, str):
    if cors_origins == "*":
        cors_origins = ["*"]
    else:
        cors_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(google_auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(caregivers.router, prefix="/api/caregivers", tags=["Caregivers"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(location.router, prefix="/api/location", tags=["Location"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(emergency.router, prefix="/api/emergency", tags=["Emergency"])
app.include_router(test.router, tags=["Test"])


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "message": "AssistLink Backend API",
        "version": "1.0.0",
        "status": "running"
    }


@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "ok",
        "message": "AssistLink Backend API is running"
    }


@app.get("/health/db")
async def health_check_db():
    """
    Canary endpoint: Database health check.
    If this fails, the application should not be considered healthy.
    Returns 200 if DB connection works, 503 if it fails.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Simple query to test connection
        cur.execute("SELECT 1;")
        cur.fetchone()
        
        # Check if critical tables exist
        cur.execute("""
            SELECT COUNT(*) 
            FROM pg_tables 
            WHERE schemaname='public' 
            AND tablename IN ('users', 'bookings', 'chat_sessions');
        """)
        table_count = cur.fetchone()[0]
        
        cur.close()
        return_db_connection(conn)
        conn = None
        
        if table_count < 3:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database schema incomplete"
            )
        
        return {
            "db": "ok",
            "status": "healthy",
            "critical_tables": table_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            return_db_connection(conn)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up database connections on shutdown"""
    from src.config.db import close_all_connections
    close_all_connections()

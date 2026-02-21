from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from app.routers import auth, users, caregivers, bookings, location, dashboard, chat, notifications, payments, google_auth, emergency, communications, reviews
from app.config import settings
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
from src.config.db import DatabaseConnectionError
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
async def database_connection_error_handler(_request: Request, exc: DatabaseConnectionError) -> JSONResponse:
    """Return 503 with a short message so the app does not show the raw DB error."""
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": {
                "code": "DATABASE_UNAVAILABLE",
                "message": "Database is temporarily unavailable. Please try again in a moment.",
                "status": 503,
            }
        },
    )

app.add_exception_handler(DatabaseConnectionError, database_connection_error_handler)
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
app.include_router(communications.router, prefix="/api/communications", tags=["Communications"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])


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


@app.get("/health/db/env")
async def health_check_db_env():
    """Debug: is DATABASE_URL set and does it look like pooler (6543) or direct (5432)? No DB connection."""
    import os
    raw = os.getenv("DATABASE_URL") or ""
    url = raw.strip()
    if not url:
        return {"DATABASE_URL_set": False, "hint": "Set DATABASE_URL in Render to the pooler URI (port 6543)."}
    is_pooler = "6543" in url and "pooler" in url.lower()
    is_direct = "5432" in url or "db." in url.split("@")[-1].split("/")[0] if "@" in url else False
    return {
        "DATABASE_URL_set": True,
        "using_pooler": is_pooler,
        "avoid_direct": not ("5432" in url or "db." in (url.split("@")[-1].split("/")[0] if "@" in url else "")),
        "hint": "Use pooler (port 6543). Remove SUPABASE_DB_PASSWORD from Render." if not is_pooler else "OK",
    }


@app.get("/health/db")
async def health_check_db():
    """Test direct DB pool (Postgres). Returns error detail if pool fails (e.g. wrong DATABASE_URL)."""
    try:
        from src.config.db import get_db_pool, DatabaseConnectionError
        pool = get_db_pool()
        conn = pool.getconn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
        finally:
            pool.putconn(conn)
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {
            "status": "error",
            "database": "disconnected",
            "detail": str(e),
            "hint": "Set DATABASE_URL in Render to Supabase pooler URI (port 6543). See docs/RENDER_ENV_VARS.md",
        }


@app.on_event("shutdown")
async def shutdown_event():
    """Graceful shutdown — no DB pool to close (Supabase client only)."""
    pass

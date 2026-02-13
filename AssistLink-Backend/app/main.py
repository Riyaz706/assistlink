from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routers import auth, users, caregivers, bookings, location, dashboard, chat, notifications, payments, google_auth, test, emergency
from app.config import settings
from src.config.db import get_db_connection, return_db_connection
import time
import traceback

app = FastAPI(
    title="AssistLink Backend API",
    description="Backend API for AssistLink - Connecting care recipients with caregivers",
    version="1.0.0"
)

# Add request logging middleware - MUST be before CORS middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    import sys
    start_time = time.time()
    path_str = str(request.url.path)
    url_str = str(request.url)
    
    # Log ALL requests to see if middleware is working
    sys.stderr.write(f"[MIDDLEWARE] Request: {request.method} {path_str}\n")
    sys.stderr.flush()
    
    # Log all requests to payment endpoints
    if "/api/payments" in path_str or "/api/payments" in url_str:
        sys.stderr.write(f"[MIDDLEWARE] ===== PAYMENT REQUEST DETECTED =====\n")
        sys.stderr.write(f"[MIDDLEWARE] Method: {request.method}\n")
        sys.stderr.write(f"[MIDDLEWARE] Full URL: {url_str}\n")
        sys.stderr.write(f"[MIDDLEWARE] Path: {path_str}\n")
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        sys.stderr.write(f"[MIDDLEWARE] Authorization header: {'Present' if auth_header else 'Missing'}\n")
        if auth_header:
            token_preview = auth_header[:30] + "..." if len(auth_header) > 30 else auth_header
            sys.stderr.write(f"[MIDDLEWARE] Auth token preview: {token_preview}\n")
        sys.stderr.flush()
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        if "/api/payments" in path_str or "/api/payments" in url_str:
            sys.stderr.write(f"[MIDDLEWARE] Payment response: {response.status_code} in {process_time:.3f}s\n")
            sys.stderr.flush()
        return response
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions as-is (they should be handled by FastAPI)
        process_time = time.time() - start_time
        if "/api/payments" in path_str or "/api/payments" in url_str:
            sys.stderr.write(f"[MIDDLEWARE] Payment request HTTPException: {http_exc.status_code} - {http_exc.detail} after {process_time:.3f}s\n")
            sys.stderr.flush()
        raise
    except Exception as e:
        process_time = time.time() - start_time
        if "/api/payments" in path_str or "/api/payments" in url_str:
            sys.stderr.write(f"[MIDDLEWARE] Payment request ERROR: {type(e).__name__}: {str(e)} after {process_time:.3f}s\n")
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
        raise

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import sys
    if "/api/payments" in str(request.url):
        sys.stderr.write(f"[EXCEPTION HANDLER] Payment endpoint exception: {type(exc).__name__}: {str(exc)}\n")
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
    
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    
    sys.stderr.write(f"[EXCEPTION HANDLER] Unhandled exception: {type(exc).__name__}: {str(exc)}\n")
    traceback.print_exc(file=sys.stderr)
    sys.stderr.flush()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

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


@app.get("/")
async def root():
    return {
        "message": "AssistLink Backend API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
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


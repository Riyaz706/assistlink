"""
Direct PostgreSQL connection to Supabase database.
Single source of truth for database connections.

This module provides direct PostgreSQL access (not through Supabase REST API).
Treat the database as external infrastructure - the app only reads/writes.
No ORM auto-creation - schema is managed externally via database/schema.sql
"""
import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from typing import Optional

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from app.config import settings
except ImportError:
    # For scripts that run outside the app context
    settings = None

# Connection pool (single source of truth)
_connection_pool: Optional[psycopg2.pool.SimpleConnectionPool] = None


def get_db_pool() -> psycopg2.pool.SimpleConnectionPool:
    """Get or create database connection pool"""
    global _connection_pool
    
    if _connection_pool is None:
        # Try to get DATABASE_URL from settings first, then environment
        database_url = None
        if settings and hasattr(settings, 'DATABASE_URL'):
            database_url = settings.DATABASE_URL
        if not database_url:
            database_url = os.getenv("DATABASE_URL")
        
        try:
            if database_url:
                # Use DATABASE_URL if provided (full connection string)
                _connection_pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=5,
                    maxconn=20,
                    dsn=database_url
                )
            else:
                # Construct connection from individual components
                supabase_url = os.getenv("SUPABASE_URL") or (settings.SUPABASE_URL if settings else None)
                if not supabase_url:
                    raise ValueError(
                        "Missing configuration: Either DATABASE_URL or SUPABASE_URL "
                        "environment variable is required for direct DB access."
                    )
                
                # Extract project ref from SUPABASE_URL (e.g., https://xyz.supabase.co -> xyz)
                project_ref = supabase_url.replace("https://", "").replace("http://", "").split(".")[0]
                
                db_host = f"db.{project_ref}.supabase.co"
                db_password = os.getenv("SUPABASE_DB_PASSWORD")
                
                if not db_password:
                    raise ValueError(
                        "Missing configuration: SUPABASE_DB_PASSWORD environment variable "
                        "is required for direct DB access when DATABASE_URL is not provided."
                    )
                
                _connection_pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=5,
                    maxconn=20,
                    host=db_host,
                    database="postgres",
                    user="postgres",
                    password=db_password,
                    port=5432,
                    sslmode="require",
                    connect_timeout=10
                )
        except Exception as e:
            # Re-wrap as a more informative error
            error_details = f"Failed to initialize database pool: {str(e)}"
            if "translate host name" in str(e).lower():
                error_details += " (Possible DNS/IPv6 issue. Consider using DATABASE_URL with Transaction Pooler on port 6543)"
            raise DatabaseConnectionError(error_details) from e
    
    return _connection_pool


def get_db_connection():
    """Get a database connection from the pool"""
    pool = get_db_pool()
    return pool.getconn()


def return_db_connection(conn):
    """Return a database connection to the pool"""
    pool = get_db_pool()
    pool.putconn(conn)


def close_all_connections():
    """Close all connections in the pool (for shutdown)"""
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None


# Direct connection (for scripts/testing)
def get_connection():
    """
    Get a direct database connection (not from pool).
    For use in scripts and smoke tests.
    """
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        return psycopg2.connect(database_url)
    
    # Construct connection from components
    supabase_url = os.getenv("SUPABASE_URL") or (settings.SUPABASE_URL if settings else None)
    if not supabase_url:
        raise ValueError("SUPABASE_URL environment variable is required")
    
    project_ref = supabase_url.replace("https://", "").replace("http://", "").split(".")[0]
    
    db_host = f"db.{project_ref}.supabase.co"
    db_password = os.getenv("SUPABASE_DB_PASSWORD")
    
    if not db_password:
        raise ValueError("SUPABASE_DB_PASSWORD environment variable is required (or use DATABASE_URL)")
    
    return psycopg2.connect(
        host=db_host,
        database="postgres",
        user="postgres",
        password=db_password,
        port=5432,
        sslmode="require"
    )




class DatabaseConnectionError(Exception):
    """Specific error for database connection/DNS issues"""
    pass

# Convenience function for executing queries with connection handling
def execute_query(query: str, params: Optional[tuple] = None, fetch: bool = True):
    """
    Execute a query and return results.
    Uses connection pool for production use.
    Updated to be resilient to DNS/Connection issues.
    """
    return execute_resilient_query(query, params, fetch)

def execute_resilient_query(query: str, params: Optional[tuple] = None, fetch: bool = True):
    """
    Execute a query with resilience:
    1. Try direct PostgreSQL connection (fastest)
    2. If DNS/Connection fails, raise DatabaseConnectionError to allow fallback
    """
    import time
    import sys
    
    start_time = time.time()
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            if fetch:
                result = cur.fetchall()
            else:
                conn.commit()
                result = cur.rowcount
            
            elapsed = time.time() - start_time
            if elapsed > 0.1:
                sys.stderr.write(f"[DB] Slow query ({elapsed:.3f}s): {query[:100]}...\n")
                sys.stderr.flush()
            
            return result
            
    except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
        error_msg = str(e)
        sys.stderr.write(f"[DB] [CONNECTION ERROR] Direct SQL failed: {error_msg}\n")
        
        # Determine if it's likely a network/DNS issue
        is_dns_issue = "translate host name" in error_msg.lower() or "nodename" in error_msg.lower()
        if is_dns_issue:
            sys.stderr.write("[DB] [TIP] Your network might be IPv4-only while Supabase Direct SQL is IPv6-only.\n")
            sys.stderr.write("[DB] [TIP] Attempting HTTPS fallback via Supabase Client...\n")
        
        sys.stderr.flush()
        
        # Raise specific error to allow caller to fallback
        raise DatabaseConnectionError(
            f"Database connection failed: {error_msg}. "
            "Consider using the Supabase Transaction Pooler (port 6543) if on an IPv4-only network."
        ) from e
            
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            return_db_connection(conn)

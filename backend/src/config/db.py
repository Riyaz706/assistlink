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


_pool_error: Optional[str] = None  # Stores init error for deferred reporting


def get_db_pool() -> psycopg2.pool.SimpleConnectionPool:
    """Get or create database connection pool.

    GRACEFUL DEGRADATION: If pool init fails, the error is stored and only raised
    when a query is attempted. This lets the server start in degraded mode so that
    Auth endpoints (Supabase client) remain usable even when direct DB is unavailable.
    """
    global _connection_pool, _pool_error

    if _pool_error is not None:
        raise DatabaseConnectionError(f"Database connection failed: {_pool_error}")

    if _connection_pool is None:
        database_url = None
        if settings and hasattr(settings, 'DATABASE_URL'):
            database_url = settings.DATABASE_URL
        if not database_url:
            database_url = os.getenv("DATABASE_URL")

        try:
            if database_url:
                # Ensure SSL for Supabase pooler (required for port 6543)
                dsn = database_url.strip()
                if "sslmode=" not in dsn and "?" not in dsn:
                    dsn = f"{dsn}?sslmode=require"
                elif "sslmode=" not in dsn and "?" in dsn:
                    dsn = f"{dsn}&sslmode=require"
                _connection_pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=2, maxconn=10, dsn=dsn, connect_timeout=15
                )
            else:
                supabase_url = os.getenv("SUPABASE_URL") or (settings.SUPABASE_URL if settings else None)
                if not supabase_url:
                    raise ValueError("Missing config: DATABASE_URL or SUPABASE_URL required.")
                project_ref = supabase_url.replace("https://", "").replace("http://", "").split(".")[0]
                db_host = f"db.{project_ref}.supabase.co"
                db_password = os.getenv("SUPABASE_DB_PASSWORD")
                if not db_password:
                    raise ValueError("Missing config: SUPABASE_DB_PASSWORD required.")
                _connection_pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=2, maxconn=10,
                    host=db_host, database="postgres",
                    user="postgres", password=db_password,
                    port=5432, sslmode="require", connect_timeout=10
                )
        except Exception as e:
            import sys
            error_details = str(e)
            if "translate host name" in error_details.lower() or "nodename" in error_details.lower():
                error_details += " (DNS issue — set DATABASE_URL to Session Pooler URL from Supabase Dashboard)"
            _pool_error = f"Failed to initialize database pool: {error_details}"
            sys.stderr.write(f"[DB] WARNING: {_pool_error}\n")
            sys.stderr.write("[DB] Server starting in degraded mode — Auth/Supabase-client endpoints still functional.\n")
            sys.stderr.flush()
            raise DatabaseConnectionError(_pool_error) from e

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

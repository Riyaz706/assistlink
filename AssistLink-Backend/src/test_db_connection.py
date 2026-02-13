"""
Alternative test using direct IP connection (for DNS resolution issues)
"""
import os
import psycopg2
import socket
from dotenv import load_dotenv

load_dotenv()

def get_ip_address(hostname):
    """Get IPv4 address for hostname"""
    try:
        # Try IPv4 first
        addr_info = socket.getaddrinfo(hostname, 5432, socket.AF_INET, socket.SOCK_STREAM)
        if addr_info:
            return addr_info[0][4][0]
    except:
        pass
    
    # Try any address family
    try:
        addr_info = socket.getaddrinfo(hostname, 5432, socket.AF_UNSPEC, socket.SOCK_STREAM)
        if addr_info:
            return addr_info[0][4][0]
    except Exception as e:
        print(f"DNS resolution failed: {e}")
        return None
    
    return None

def test_connection():
    """Test database connection with alternative DNS resolution"""
    supabase_url = os.getenv("SUPABASE_URL")
    db_password = os.getenv("SUPABASE_DB_PASSWORD")
    
    if not supabase_url or not db_password:
        print("Error: SUPABASE_URL and SUPABASE_DB_PASSWORD must be set")
        return False
    
    # Extract project ref
    clean_url = supabase_url.replace("https://", "").replace("http://", "").strip()
    project_ref = clean_url.split(".")[0]
    db_host = f"db.{project_ref}.supabase.co"
    
    print(f"Testing connection to: {db_host}")
    print(f"Project ref: {project_ref}")
    
    # Try to resolve IP
    print("\nAttempting DNS resolution...")
    ip_address = get_ip_address(db_host)
    
    if ip_address:
        print(f"Resolved to IP: {ip_address}")
        try:
            # Try connecting via IP
            print("\nAttempting connection via IP address...")
            conn = psycopg2.connect(
                host=ip_address,
                database="postgres",
                user="postgres",
                password=db_password,
                port=5432,
                sslmode="require",
                connect_timeout=10
            )
            print("SUCCESS: Connected via IP address!")
            conn.close()
            return True
        except Exception as e:
            print(f"Connection via IP failed: {e}")
    else:
        print("WARNING: Could not resolve IP address")
    
    # Try hostname anyway
    print("\nAttempting connection via hostname...")
    try:
        conn = psycopg2.connect(
            host=db_host,
            database="postgres",
            user="postgres",
            password=db_password,
            port=5432,
            sslmode="require",
            connect_timeout=10
        )
        print("SUCCESS: Connected via hostname!")
        conn.close()
        return True
    except Exception as e:
        print(f"Connection via hostname failed: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    exit(0 if success else 1)



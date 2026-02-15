import requests
import uuid
import time
import sys
import json

# Configuration
BASE_URL = "http://localhost:8000"
timestamp = int(time.time())
EMAIL = f"test_user_{timestamp}@example.com"
PASSWORD = "TestPassword123!"
FULL_NAME = f"Test User {timestamp}"
import random
PHONE = f"9{random.randint(100000000, 999999999)}"

def log(message, type="INFO"):
    print(f"[{type}] {message}")

def check_response(response, expected_code=200, description="Request"):
    if response.status_code == expected_code:
        log(f"{description} success ({response.status_code})", "PASS")
        return True
    else:
        log(f"{description} failed. Expected {expected_code}, got {response.status_code}", "FAIL")
        try:
            log(f"Response: {json.dumps(response.json(), indent=2)}", "DEBUG")
        except:
            log(f"Response: {response.text}", "DEBUG")
        return False

def run_integration_tests():
    log("Starting Integration Tests...", "INFO")
    
    # 1. Registration
    log(f"1. Testing Registration for {EMAIL}...", "TEST")
    reg_payload = {
        "email": EMAIL,
        "password": PASSWORD,
        "full_name": FULL_NAME,
        "phone": PHONE,
        "role": "care_recipient"
    }
    try:
        res = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
        if not check_response(res, 201, "Registration"):
            if res.status_code == 400 and "already registered" in res.text:
                 log("User already exists, proceeding to login...", "WARN")
            else:
                 sys.exit(1)
    except Exception as e:
        log(f"Registration request failed: {e}", "CRITICAL")
        sys.exit(1)

    # 2. Login
    log(f"2. Testing Login...", "TEST")
    login_payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    try:
        res = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        if not check_response(res, 200, "Login"):
            sys.exit(1)
        
        data = res.json()
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        
        if not access_token or not refresh_token:
            log("Login successful but tokens missing!", "FAIL")
            sys.exit(1)
        
        log("Tokens received successfully.", "PASS")
    except Exception as e:
        log(f"Login request failed: {e}", "CRITICAL")
        sys.exit(1)

    # 3. Protected Endpoint (Get Profile)
    log(f"3. Testing Protected Endpoint (Get Profile)...", "TEST")
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        res = requests.get(f"{BASE_URL}/api/users/profile", headers=headers)
        if not check_response(res, 200, "Get Profile"):
            sys.exit(1)
        
        profile = res.json()
        if profile.get("email") == EMAIL:
             log("Profile email matches.", "PASS")
        else:
             log(f"Profile email mismatch. Got {profile.get('email')}, expected {EMAIL}", "FAIL")
    except Exception as e:
        log(f"Profile request failed: {e}", "CRITICAL")
        sys.exit(1)

    # 4. Token Refresh
    log(f"4. Testing Token Refresh...", "TEST")
    refresh_payload = {"refresh_token": refresh_token}
    try:
        res = requests.post(f"{BASE_URL}/api/auth/refresh", json=refresh_payload)
        # Note: Depending on implementation, refresh might return just access_token or both
        if not check_response(res, 200, "Token Refresh"):
             sys.exit(1)
             
        new_data = res.json()
        new_access_token = new_data.get("access_token")
        if new_access_token:
            log("New access token received.", "PASS")
        else:
            log("Refresh successful but no new access token returned.", "FAIL")
            sys.exit(1)
            
        # Verify new token works
        log("Verifying new access token...", "TEST")
        new_headers = {"Authorization": f"Bearer {new_access_token}"}
        res = requests.get(f"{BASE_URL}/api/users/profile", headers=new_headers)
        check_response(res, 200, "Get Profile with New Token")

    except Exception as e:
        log(f"Refresh request failed: {e}", "CRITICAL")
        sys.exit(1)

    log("Integration Tests Completed Successfully!", "SUCCESS")

if __name__ == "__main__":
    run_integration_tests()

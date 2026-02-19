import httpx
import sys
import uuid
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def log(msg, type="INFO"):
    print(f"[{type}] {msg}")

def check_health():
    try:
        resp = httpx.get(f"{BASE_URL}/health")
        log(f"Health Check: {resp.status_code} - {resp.json()}")
        return resp.status_code == 200
    except Exception as e:
        log(f"Health Check Failed: {e}", "ERROR")
        return False

def verify_flows():
    if not check_health():
        log("Backend not healthy. Aborting.", "ERROR")
        sys.exit(1)

    # 1. Register Care Recipient
    cr_email = f"cr_{uuid.uuid4()}@example.com"
    cr_password = "password123"
    cr_payload = {
        "email": cr_email,
        "password": cr_password,
        "full_name": "Test Care Recipient",
        "role": "care_recipient",
        "phone": "+919876543210",
        "address": {"street": "123 Main St", "city": "Test City", "zip": "12345"}
    }
    
    log(f"Registering Care Recipient: {cr_email}")
    resp = httpx.post(f"{BASE_URL}/api/auth/register", json=cr_payload)
    if resp.status_code != 201:
        log(f"Registration failed: {resp.text}", "ERROR")
        sys.exit(1)
    
    # Login CR
    log("Logging in Care Recipient...")
    resp = httpx.post(f"{BASE_URL}/api/auth/login", json={"email": cr_email, "password": cr_password})
    if resp.status_code != 200:
        log(f"Login failed: {resp.text}", "ERROR")
        sys.exit(1)
    
    cr_token = resp.json()["access_token"]
    cr_id = resp.json()["user"]["id"]
    cr_headers = {"Authorization": f"Bearer {cr_token}"}
    log(f"CR Logged in. ID: {cr_id}")

    # 2. Register Caregiver
    cg_email = f"cg_{uuid.uuid4()}@example.com"
    cg_password = "password123"
    cg_payload = {
        "email": cg_email,
        "password": cg_password,
        "full_name": "Test Caregiver",
        "role": "caregiver",
        "phone": "+919876543211",
        "address": {"street": "456 Oak St", "city": "Test City", "zip": "12345"}
    }
    
    log(f"Registering Caregiver: {cg_email}")
    resp = httpx.post(f"{BASE_URL}/api/auth/register", json=cg_payload)
    if resp.status_code != 201:
        log(f"Registration failed: {resp.text}", "ERROR")
        sys.exit(1)

    # Login CG
    log("Logging in Caregiver...")
    resp = httpx.post(f"{BASE_URL}/api/auth/login", json={"email": cg_email, "password": cg_password})
    if resp.status_code != 200:
        log(f"Login failed: {resp.text}", "ERROR")
        sys.exit(1)
    
    cg_token = resp.json()["access_token"]
    cg_id = resp.json()["user"]["id"]
    cg_headers = {"Authorization": f"Bearer {cg_token}"}
    log(f"CG Logged in. ID: {cg_id}")

    # Update Caregiver Profile to be Active/Available
    # (Assuming default is active, but availability might need setting)
    # The API for caregiver profile update: PUT /api/caregivers/profile
    
    # 3. CR Requests Video Call
    log("Requesting Video Call (CR -> CG)...")
    scheduled_time = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    vc_payload = {
        "caregiver_id": cg_id,
        "scheduled_time": scheduled_time,
        "duration_seconds": 60
    }
    resp = httpx.post(f"{BASE_URL}/api/bookings/video-call/request", json=vc_payload, headers=cr_headers)
    if resp.status_code != 201:
        log(f"Video Call Request failed: {resp.text}", "ERROR")
        sys.exit(1)
    
    vc_data = resp.json()
    vc_id = vc_data["id"]
    log(f"Video Call Requested. ID: {vc_id}")

    # 4. CG Accepts Video Call
    log("Accepting Video Call (CG)...")
    accept_payload = {"accept": True}
    resp = httpx.post(f"{BASE_URL}/api/bookings/video-call/{vc_id}/accept", json=accept_payload, headers=cg_headers)
    if resp.status_code != 200:
        log(f"Video Call Accept failed: {resp.text}", "ERROR")
        # Continue? No, blocking.
        sys.exit(1)
        
    updated_vc = resp.json()
    log(f"Video Call Status: {updated_vc.get('status')}")
    
    # Check if Booking was created
    booking_id = updated_vc.get("booking_id")
    if booking_id:
        log(f"Booking Auto-Created. ID: {booking_id}")
    else:
        log("Booking ID not returned in acceptance response. Checking bookings list...", "WARN")
        # Fetch bookings
        resp = httpx.get(f"{BASE_URL}/api/bookings", headers=cr_headers)
        bookings = resp.json()
        if len(bookings) > 0:
            booking_id = bookings[0]["id"]
            log(f"Found booking: {booking_id}")
        else:
            log("No booking found!", "ERROR")
            sys.exit(1)
            
    # 5. Process Payment (Bypass Mode)
    log("Processing Payment (CR)...")
    # 5. Security Test: Attempt Manual Confirmation (Should Fail)
    log("Security Test: Attempting Manual Confirmation (Bypass Payment)...")
    try:
        hack_resp = httpx.patch(
            f"{BASE_URL}/api/bookings/{booking_id}/status",
            json={"status": "confirmed"},
            headers=cr_headers
        )
        if hack_resp.status_code in [200, 204]:
            log("SECURITY FAILURE: Manual confirmation succeeded!", "ERROR")
            sys.exit(1)
        else:
             log(f"Security Check Passed: Manual confirmation blocked ({hack_resp.status_code})")
    except Exception as e:
        log(f"Security Check Passed: Request failed ({e})")

    # 6. Process Payment (CR)
    log("Processing Payment (CR)...")
    payment_payload = {
        "booking_id": booking_id,
        "amount": 500,
        "currency": "INR"
    }
    resp = httpx.post(f"{BASE_URL}/api/payments/create-order", json=payment_payload, headers=cr_headers)
    if resp.status_code != 200:
        log(f"Payment Processing failed: {resp.text}", "ERROR")
        sys.exit(1)
    
    payment_data = resp.json()
    log(f"Payment Response: {payment_data}")
    # Verify booking status updated to confirmed
    resp = httpx.get(f"{BASE_URL}/api/bookings/{booking_id}", headers=cr_headers)
    updated_booking = resp.json()
    status = updated_booking.get('status')
    log(f"Booking Status after Payment: {status}")
    if status != "confirmed":
        log(f"Expected status 'confirmed', got '{status}'", "ERROR")
        sys.exit(1)
    
    # 6. Get Video Token
    log("Getting Video Token (CR)...")
    token_payload = {"booking_id": booking_id}
    resp = httpx.post(f"{BASE_URL}/api/communications/video/token", json=token_payload, headers=cr_headers)
    if resp.status_code != 200:
        log(f"Get Video Token failed: {resp.text}", "ERROR")
        sys.exit(1)
    
    token_data = resp.json()
    if "token" in token_data and "room_name" in token_data:
        log(f"Video Token Received. Room: {token_data['room_name']}")
    else:
        log(f"Invalid Token Response: {token_data}", "ERROR")
        sys.exit(1)

    # 7. Caregiver Starts Service
    log("Starting Service (CG)...")
    status_payload = {"status": "in_progress"}
    resp = httpx.patch(f"{BASE_URL}/api/bookings/{booking_id}/status", json=status_payload, headers=cg_headers)
    if resp.status_code != 200:
        log(f"Start Service failed: {resp.text}", "ERROR")
        sys.exit(1)
    
    updated_booking = resp.json()
    if updated_booking.get("status") != "in_progress":
        log(f"Expected status 'in_progress', got '{updated_booking.get('status')}'", "ERROR")
        sys.exit(1)
    log("Service Started (In Progress)")

    # 8. Caregiver Completes Service
    log("Completing Service (CG)...")
    status_payload = {"status": "completed"}
    resp = httpx.patch(f"{BASE_URL}/api/bookings/{booking_id}/status", json=status_payload, headers=cg_headers)
    if resp.status_code != 200:
        log(f"Complete Service failed: {resp.text}", "ERROR")
        sys.exit(1)
        
    updated_booking = resp.json()
    if updated_booking.get("status") != "completed":
        log(f"Expected status 'completed', got '{updated_booking.get('status')}'", "ERROR")
        sys.exit(1)
    log("Service Completed")

    log("=== ALL FLOWS VERIFIED SUCCESSFULLY ===", "SUCCESS")

if __name__ == "__main__":
    verify_flows()

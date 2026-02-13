#!/usr/bin/env python3
"""
Test script for password change endpoint
Usage: ./test_password_change.py <email> <current_password> <new_password>
"""

import sys
import requests
import json

def test_password_change(email, current_password, new_password):
    # First, login to get a token
    print(f"1. Logging in as {email}...")
    login_response = requests.post(
        "http://localhost:8000/api/auth/login",
        json={"email": email, "password": current_password}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(login_response.text)
        return False
    
    login_data = login_response.json()
    token = login_data.get("access_token")
    print(f"✅ Login successful, got token")
    
    # Now try to change password
    print(f"\n2. Attempting to change password...")
    change_response = requests.post(
        "http://localhost:8000/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": current_password,
            "new_password": new_password
        }
    )
    
    print(f"Status Code: {change_response.status_code}")
    print(f"Response: {json.dumps(change_response.json(), indent=2)}")
    
    if change_response.status_code == 200:
        print(f"\n✅ Password changed successfully!")
        
        # Try logging in with new password
        print(f"\n3. Testing login with new password...")
        test_login = requests.post(
            "http://localhost:8000/api/auth/login",
            json={"email": email, "password": new_password}
        )
        
        if test_login.status_code == 200:
            print(f"✅ Login with new password successful!")
            
            # Change it back
            print(f"\n4. Changing password back to original...")
            token2 = test_login.json().get("access_token")
            revert_response = requests.post(
                "http://localhost:8000/api/auth/change-password",
                headers={"Authorization": f"Bearer {token2}"},
                json={
                    "current_password": new_password,
                    "new_password": current_password
                }
            )
            if revert_response.status_code == 200:
                print(f"✅ Password reverted successfully!")
            else:
                print(f"⚠️  Failed to revert password: {revert_response.text}")
        else:
            print(f"❌ Login with new password failed: {test_login.text}")
    else:
        print(f"\n❌ Password change failed!")
    
    return change_response.status_code == 200

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: ./test_password_change.py <email> <current_password> <new_password>")
        print("Example: ./test_password_change.py user@example.com oldpass123 newpass123")
        sys.exit(1)
    
    email = sys.argv[1]
    current_password = sys.argv[2]
    new_password = sys.argv[3]
    
    success = test_password_change(email, current_password, new_password)
    sys.exit(0 if success else 1)

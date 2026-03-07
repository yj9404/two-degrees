import urllib.request
import json
import os

BASE_URL = "http://localhost:8000"

def test_endpoint(path, header=None):
    print(f"Testing GET {path} {'with' if header else 'without'} header...")
    try:
        headers = {"X-Admin-Password": header} if header else {}
        req = urllib.request.Request(f"{BASE_URL}{path}", headers=headers)
        with urllib.request.urlopen(req) as response:
            print(f"Response status: {response.getcode()}")
            return response.getcode()
    except urllib.error.HTTPError as e:
        print(f"Response status: {e.code}")
        # print(f"Response body: {e.read().decode()}")
        return e.code
    except Exception as e:
        # print(f"Error: {e}")
        return None

if __name__ == "__main__":
    # This script is for documentation of the fix.
    # It will fail in this environment because the server is not running.
    print("Vulnerability Verification Script")
    test_endpoint("/api/users")

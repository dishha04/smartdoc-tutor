import requests

try:
    print("Sending POST request to /signup...")
    response = requests.post(
        "http://127.0.0.1:8000/signup", 
        json={"email": "hello@test.com", "password": "password123"},
        timeout=10
    )
    print("Status Code:", response.status_code)
    print("Response Text:", response.text)
except requests.exceptions.Timeout:
    print("Request TIMED OUT after 10 seconds. The server is hanging.")
except Exception as e:
    print("Request failed with error:", e)

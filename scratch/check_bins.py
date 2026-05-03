import requests
import json
import os

API_KEY = "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C"
BINS = [
    "661adbced0ea881f4082269a", # NEWS
    "69e2a081856a682189465e17", # BOC
    "69e26a2336566621a8c46192"  # NEWSLETTER
]

headers = {'X-Master-Key': API_KEY}

for bin_id in BINS:
    print(f"--- BIN {bin_id} ---")
    try:
        res = requests.get(f"https://api.jsonbin.io/v3/b/{bin_id}/latest", headers=headers)
        print(json.dumps(res.json().get('record', {}), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}")

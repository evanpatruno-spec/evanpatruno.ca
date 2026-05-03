import requests
import json

API_KEY = "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C"
BINS = ["661adbced0ea881f4082269a", "69e2a081856a682189465e17", "69e26a2336566621a8c46192", "694462e7d0ea881f4032d140"]

headers = {'X-Master-Key': API_KEY}
for b in BINS:
    res = requests.get(f"https://api.jsonbin.io/v3/b/{b}/latest", headers=headers).text
    if "Mai 2026" in res:
        print(f"FOUND IN BIN {b}")
    else:
        print(f"Not in {b}")

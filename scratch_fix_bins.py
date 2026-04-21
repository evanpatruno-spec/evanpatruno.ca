import requests
import os

API_KEY = "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C"
HEADERS = {
    "X-Master-Key": API_KEY,
    "Content-Type": "application/json"
}

def create_public_bin(name, initial_data):
    print(f"Creating public bin for {name}...")
    headers = HEADERS.copy()
    headers["X-Bin-Private"] = "false"
    headers["X-Bin-Name"] = name
    res = requests.post("https://api.jsonbin.io/v3/b", json=initial_data, headers=headers)
    if res.status_code == 200:
        bin_id = res.json()["metadata"]["id"]
        print(f"SUCCESS: {name} Bin ID: {bin_id}")
        return bin_id
    else:
        print(f"FAILED to create {name} bin: {res.text}")
        return None

if __name__ == "__main__":
    # 1. New News Bin
    news_id = create_public_bin("Market_News_Public", {"news": [], "market_stats": {}})
    # 2. New BOC Bin
    boc_id = create_public_bin("BOC_Rates_Public", {"rate": 2.25, "status": "stable"})
    
    print("\nIMPORTANT: Update the following files with these IDs:")
    print(f"NEWS_BIN_ID: {news_id}")
    print(f"BOC_BIN_ID: {boc_id}")

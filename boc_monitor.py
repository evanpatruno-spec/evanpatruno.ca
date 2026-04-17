import requests
import json
import os
from datetime import datetime

# Configuration JSONBin
BIN_ID = "694462e7d0ea881f4032d140" # We can use the same bin under a different key or a dedicated one. 
# Let's use a dedicated key 'boc_data' inside the same bin to keep it simple, 
# or a separate Bin. For safety, let's use a separate Bin for the info hub.
BOC_BIN_ID = "69db9753856a682189265c0b"
MASTER_KEY = "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C"

def get_boc_rates():
    """Fetches the latest overnight rate from Bank of Canada Valet API."""
    print("Interrogation de l'API Valet (Banque du Canada)...")
    try:
        # V39079 = Target for the overnight rate
        url = "https://www.bankofcanada.ca/valet/observations/V39079/json?recent=5"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        observations = data.get('observations', [])
        if not observations:
            return None
            
        latest = observations[-1]
        previous = observations[-2] if len(observations) > 1 else latest
        
        rate = float(latest['V39079']['v'])
        prev_rate = float(previous['V39079']['v'])
        date_str = latest['d']
        
        status = "a maintenu"
        if rate > prev_rate: status = "a augmenté"
        elif rate < prev_rate: status = "a diminué"
        
        # Format date for French
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        fr_date = date_obj.strftime('%d %B %Y').replace('January', 'janvier').replace('February', 'février').replace('March', 'mars').replace('April', 'avril').replace('May', 'mai').replace('June', 'juin').replace('July', 'juillet').replace('August', 'août').replace('September', 'septembre').replace('October', 'octobre').replace('November', 'novembre').replace('December', 'décembre')

        # CALENDRIER OFFICIEL 2026 - Banque du Canada
        announcements_2026 = [
            "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-10",
            "2026-07-15", "2026-09-02", "2026-10-28", "2026-12-09"
        ]
        
        def get_schedule_info(dates_list):
            now = datetime.now()
            next_iso = ""
            last_iso = "2025-12-03" # Fallback pour le début d'année
            
            for i, d_str in enumerate(dates_list):
                d_obj = datetime.strptime(d_str, '%Y-%m-%d')
                if d_obj > now:
                    next_iso = d_str
                    if i > 0:
                        last_iso = dates_list[i-1]
                    break
            
            if not next_iso:
                return "À déterminer", "", ""

            # Convert to French format
            d_obj = datetime.strptime(next_iso, '%Y-%m-%d')
            months_fr = {
                "01": "janvier", "02": "février", "03": "mars", "04": "avril",
                "05": "mai", "06": "juin", "07": "juillet", "08": "août",
                "09": "septembre", "10": "octobre", "11": "novembre", "12": "décembre"
            }
            day = d_obj.strftime('%d').lstrip('0')
            month = months_fr[d_obj.strftime('%m')]
            year = d_obj.strftime('%Y')
            fr_text = f"{day} {month} {year}"
            return fr_text, next_iso, last_iso

        next_announcement, next_iso, last_iso = get_schedule_info(announcements_2026)

        return {
            "rate": rate,
            "date": fr_date,
            "status": status,
            "last_check": datetime.now().strftime('%Y-%m-%d %H:%M'),
            "next_announcement": next_announcement,
            "next_date_iso": next_iso,
            "last_date_iso": last_iso
        }
    except Exception as e:
        print(f"Erreur BOC: {e}")
        return None

def save_to_cloud(data):
    """Updates the BOC Bin with the latest rate data."""
    url = f"https://api.jsonbin.io/v3/b/{BOC_BIN_ID}"
    headers = {
        "Content-Type": "application/json",
        "X-Master-Key": MASTER_KEY
    }
    try:
        response = requests.put(url, json=data, headers=headers)
        response.raise_for_status()
        print(f"BOC Hub mis à jour avec succès : {BOC_BIN_ID}")
    except Exception as e:
        print(f"Erreur d'upload BOC: {e}")

if __name__ == "__main__":
    boc_data = get_boc_rates()
    if boc_data:
        print(f"Taux Actuel : {boc_data['rate']}% ({boc_data['status']})")
        save_to_cloud(boc_data)

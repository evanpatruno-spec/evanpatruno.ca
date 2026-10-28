import requests
import json
import os
from datetime import datetime

# Configuration JSONBin
BIN_ID = "694462e7d0ea881f4032d140"
BOC_BIN_ID = "69e6d40f856a6821895644ed"
MASTER_KEY = os.getenv("JSONBIN_API_KEY", "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C")

MONTHS_FR = {
    "01": "janvier", "02": "février", "03": "mars", "04": "avril",
    "05": "mai", "06": "juin", "07": "juillet", "08": "août",
    "09": "septembre", "10": "octobre", "11": "novembre", "12": "décembre"
}


def format_iso_fr(iso_str):
    if not iso_str:
        return "À déterminer"
    d_obj = datetime.strptime(iso_str, '%Y-%m-%d')
    day = d_obj.strftime('%d').lstrip('0')
    month = MONTHS_FR[d_obj.strftime('%m')]
    year = d_obj.strftime('%Y')
    return f"{day} {month} {year}"


def get_boc_rates():
    """Fetches the latest overnight rate from Bank of Canada Valet API."""
    print("Interrogation de l'API Valet (Banque du Canada)...")
    try:
        url = "https://www.bankofcanada.ca/valet/observations/V39079/json?recent=60"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()

        observations = data.get('observations', [])
        if not observations:
            return None

        latest = observations[-1]
        rate = float(latest['V39079']['v'])

        # CALENDRIER OFFICIEL 2026-2027 - Banque du Canada
        announcements = [
            "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-10",
            "2026-07-15", "2026-09-02", "2026-10-28", "2026-12-09",
            "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09",
            "2027-07-21", "2027-09-08", "2027-10-27", "2027-12-08"
        ]

        now_str = datetime.now().strftime('%Y-%m-%d')
        next_iso = ""
        last_iso = "2025-12-03"

        for i, d_str in enumerate(announcements):
            if d_str > now_str:
                next_iso = d_str
                if i > 0:
                    last_iso = announcements[i - 1]
                break
        if not next_iso:
            last_iso = announcements[-1]

        # Compare rate at last announcement vs prior observations to determine status
        prev_rate = rate
        for obs in reversed(observations):
            if obs.get('d', '') < last_iso:
                prev_rate = float(obs['V39079']['v'])
                break

        status = "a maintenu"
        if rate > prev_rate:
            status = "a augmenté"
        elif rate < prev_rate:
            status = "a diminué"

        fr_last_date = format_iso_fr(last_iso)
        next_announcement = format_iso_fr(next_iso)

        return {
            "rate": rate,
            "date": fr_last_date,
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
        "X-Master-Key": MASTER_KEY,
        "X-Bin-Private": "false"
    }
    try:
        response = requests.put(url, json=data, headers=headers, timeout=15)
        response.raise_for_status()
        print(f"BOC Hub mis à jour avec succès : {BOC_BIN_ID}")
    except Exception as e:
        print(f"Erreur d'upload BOC: {e}")


if __name__ == "__main__":
    boc_data = get_boc_rates()
    if boc_data:
        print(f"Taux Actuel : {boc_data['rate']}% ({boc_data['status']} le {boc_data['date']})")
        save_to_cloud(boc_data)

        with open("boc_rates.json", "w", encoding="utf-8") as f:
            json.dump(boc_data, f, indent=4, ensure_ascii=False)
        print("Fichier local boc_rates.json mis à jour.")

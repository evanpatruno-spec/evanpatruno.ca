import requests
import json

MASTER_KEY = "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C"

def create_boc_bin():
    print("Création du Bin pour le Hub d'Information...")
    url = "https://api.jsonbin.io/v3/b"
    headers = {
        "Content-Type": "application/json",
        "X-Master-Key": MASTER_KEY,
        "X-Bin-Name": "BOC_Hub"
    }
    data = {
        "rate": 2.25,
        "date": "18 mars 2026",
        "status": "Maintenu",
        "next_announcement": "2 juin 2026"
    }
    
    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 200:
        bin_id = response.json()['metadata']['id']
        print(f"SUCCÈS ! Nouveau Bin ID : {bin_id}")
        return bin_id
    else:
        print(f"ERREUR : {response.text}")
        return None

if __name__ == "__main__":
    create_boc_bin()

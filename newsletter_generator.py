import requests
import json
import os
from datetime import datetime

# CONFIGURATION
API_KEY = "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C"
NEWS_BIN_ID = "661adbced0ea881f4082269a"
BOC_BIN_ID = "69db9753856a682189265c0b"
BIN_ID_FILE = "newsletter_bin_id.txt"
HARDCODED_NEWSLETTER_BIN_ID = "" # Sera créé au premier lancement

EXPERT_FALLBACKS = [
    {
        "title": "5 astuces pour augmenter la valeur de votre maison",
        "summary": "Petites rénovations, grand impact. Découvrez comment maximiser votre prix de vente avec des changements mineurs mais stratégiques.",
        "link": "https://www.evanpatruno.ca/blogue/immobilier/augmenter-valeur-maison",
        "source": "Conseil d'expert"
    },
    {
        "title": "Acheter ou Louer en 2026 : Le match comparatif",
        "summary": "Avec l'évolution des taux, est-il toujours avantageux d'acheter ? Nous décortiquons les chiffres pour vous aider à décider.",
        "link": "https://www.evanpatruno.ca/blogue/finances/acheter-vs-louer",
        "source": "Conseil d'expert"
    },
    {
        "title": "Comprendre la taxe de bienvenue (Droits de mutation)",
        "summary": "Saviez-vous que le calcul change selon la ville ? Évitez les surprises lors de votre passage chez le notaire.",
        "link": "https://www.evanpatruno.ca/tools-hub",
        "source": "Outils Pratiques"
    }
]

def fetch_latest_news():
    print("Récupération des dernières nouvelles...")
    headers = {'X-Master-Key': API_KEY}
    try:
        url = f"https://api.jsonbin.io/v3/b/{NEWS_BIN_ID}/latest"
        res = requests.get(url, headers=headers)
        return res.json().get('record', [])
    except Exception as e:
        print(f"Erreur News: {e}")
        return []

def fetch_boc_data():
    print("Récupération des données BOC...")
    headers = {'X-Master-Key': API_KEY}
    try:
        url = f"https://api.jsonbin.io/v3/b/{BOC_BIN_ID}/latest"
        res = requests.get(url, headers=headers)
        return res.json().get('record', {})
    except Exception as e:
        print(f"Erreur BOC: {e}")
        return {}

def select_top_news(news_list, count=3):
    """Sélectionne les 3 articles les plus pertinents, prioritisant le local."""
    keywords = ["taux", "hypothèque", "prix", "médian", "prévision", "marché", "inflation", "cmhc", "schl", "banque"]
    
    scored_news = []
    for item in news_list:
        score = 0
        text = (item.get('title', '') + " " + item.get('description', '')).lower()
        for kw in keywords:
            if kw in text:
                score += 1
        
        # Priorité aux nouvelles locales
        if item.get('category') == 'local':
            score += 2
            
        scored_news.append((score, item))
    
    # Trier par score décroissant
    scored_news.sort(key=lambda x: x[0], reverse=True)
    selected = [x[1] for x in scored_news[:count]]
    
    # COMPLÉTER AVEC LES FALLBACKS SI BESOIN
    if len(selected) < count:
        needed = count - len(selected)
        selected.extend(EXPERT_FALLBACKS[:needed])
        
    return selected

def generate_newsletter_json():
    all_news = fetch_latest_news()
    boc = fetch_boc_data()
    top_news = select_top_news(all_news)
    
    # Date du mois (ex: Avril 2026)
    months_fr = {
        "1": "Janvier", "2": "Février", "3": "Mars", "4": "Avril",
        "5": "Mai", "6": "Juin", "7": "Juillet", "8": "Août",
        "9": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre"
    }
    now = datetime.now()
    month_name = months_fr[str(now.month)]
    year = now.year

    newsletter_data = {
        "campaign_id": f"NL-{now.month}-{year}",
        "month": month_name,
        "year": year,
        "boc_rate": f"{boc.get('rate', '--')}%",
        "boc_status": boc.get('status', 'maintenu'),
        "boc_next": boc.get('next_announcement', 'À venir'),
        "top_articles": [
            {
                "title": item.get('title', 'Titre non disponible'),
                "summary": item.get('description', item.get('summary', ''))[:250] + "...",
                "link": item.get('link', '#'),
                "source": item.get('source', 'Source inconnue')
            } for item in top_news
        ],
        "expert_note": "Le marché s'équilibre. C'est le moment idéal pour réévaluer vos capacités de financement avant la prochaine vague immobilière.",
        "footer_msg": "Besoin d'une évaluation précise de votre propriété ? Répondez simplement à ce courriel.",
        "quick_links": [
            {"label": "Calculatrice Hypothécaire", "url": "https://www.evanpatruno.ca/tools-hub#mortgage"},
            {"label": "Taxe de Bienvenue", "url": "https://www.evanpatruno.ca/tools-hub#welcome-tax"},
            {"label": "Capacité d'Achat", "url": "https://www.evanpatruno.ca/tools-hub#affordability"}
        ]
    }
    
    # Sauvegarde locale
    with open('newsletter_ready.json', 'w', encoding='utf-8') as f:
        json.dump(newsletter_data, f, indent=2, ensure_ascii=False)
    
    # Upload au cloud pour accès par Zoho
    bin_id = update_jsonbin(newsletter_data)
    
    print(f"Newsletter JSON générée et poussée sur le Cloud ! Bin ID: {bin_id}")
    return newsletter_data

def update_jsonbin(data):
    headers = {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Private': 'false'
    }
    
    bin_id = HARDCODED_NEWSLETTER_BIN_ID
    if os.path.exists(BIN_ID_FILE):
        with open(BIN_ID_FILE, 'r') as f:
            bin_id = f.read().strip()

    if bin_id:
        url = f"https://api.jsonbin.io/v3/b/{bin_id}"
        requests.put(url, json=data, headers=headers)
    else:
        # CRÉATION DU BIN S'IL N'EXISTE PAS
        url = "https://api.jsonbin.io/v3/b"
        res = requests.post(url, json=data, headers=headers)
        if res.status_code == 200:
            bin_id = res.json()['metadata']['id']
            with open(BIN_ID_FILE, 'w') as f:
                f.write(bin_id)
    
    return bin_id

if __name__ == "__main__":
    generate_newsletter_json()

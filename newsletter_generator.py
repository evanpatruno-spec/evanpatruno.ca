import requests
import json
import os
from datetime import datetime

# CONFIGURATION
API_KEY = os.getenv("JSONBIN_API_KEY", "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C")
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

CITATIONS = [
    "L'immobilier ne peut pas être perdu ou volé, ni emporté. Géré avec soin, il s'agit de l'investissement le plus sûr au monde. – Franklin Roosevelt",
    "L'investissement dans la connaissance paye le plus gros intérêt. Investissez sur vous-même ! – Benjamin Franklin",
    "Quelqu'un est assis à l'ombre aujourd'hui parce que quelqu'un a planté un arbre il y a longtemps. – Warren Buffett",
    "90% des millionnaires le sont devenus grâce à l'investissement immobilier. – Andrew Carnegie",
    "Achetez des terres. Ils n'en fabriquent plus. – Mark Twain",
    "Le succès ne s'offre qu'à ceux qui osent essayer. – Charlie Chaplin",
    "Les intérêts composés sont la 8e merveille du monde. Celui qui les comprend les gagne. – Albert Einstein"
]

PRO_TIPS = [
    "Vérifiez votre certificat de localisation : un certificat de plus de 10 ans est souvent refusé par les notaires lors d'une vente.",
    "RAP : Vous pouvez utiliser vos REER jusqu'à 60 000 $ pour l'achat de votre première propriété, sans impôt.",
    "Taux fixe vs variable : Le taux variable offre souvent une pénalité de sortie plus basse (3 mois d'intérêts) en cas de vente imprévue.",
    "Inspection : Une inspection pré-achat n'est pas une dépense, c'est une protection contre les vices cachés majeurs.",
    "Préchauffage : Faites toujours pré-approuver votre hypothèque avant de visiter pour renforcer votre pouvoir de négociation.",
    "Améliorations : La cuisine et la salle de bain restent les pièces offrant le meilleur retour sur investissement lors d'une vente."
]

def fetch_latest_news():
    print("Récupération des dernières nouvelles...")
    headers = {'X-Master-Key': API_KEY}
    try:
        # TEST LOCAL FIRST FOR SPEED/DEBUG
        if os.path.exists('news.json'):
            with open('news.json', 'r', encoding='utf-8') as f:
                return json.load(f)
                
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
    """Sélectionne les 3 articles les plus pertinents et tente de trouver une astuce."""
    keywords = ["taux", "hypothèque", "prix", "médian", "prévision", "marché", "inflation", "cmhc", "schl", "banque", "immobilier", "maison", "condo", "vendre", "achat"]
    tip_keywords = ["astuce", "conseil", "comment", "guide", "truc", "étape"]
    
    scored_news = []
    found_tip = None
    
    for item in news_list:
        score = 0
        text = (item.get('title', '') + " " + item.get('description', '')).lower()
        
        # Scoring général
        for kw in keywords:
            if kw in text:
                score += 1
        
        # Détection d'astuce (Seulement si l'article est pertinent à l'immobilier / hypothèque)
        if score > 0:
            for tkw in tip_keywords:
                if tkw in text and not found_tip:
                    # On garde l'astuce complète (sans coupure) pour que ce soit lisible
                    found_tip = f"{item.get('title')} : {item.get('description')}"
        
        # Priorité aux nouvelles locales
        if item.get('category') == 'local':
            score += 2
            
        scored_news.append((score, item))
    
    # Trier par score décroissant et garantir 3 articles
    scored_news.sort(key=lambda x: x[0], reverse=True)
    selected = [x[1] for x in scored_news[:count]]
    
    # COMPLÉTER AVEC LES FALLBACKS SI BESOIN
    if len(selected) < count:
        needed = count - len(selected)
        selected.extend(EXPERT_FALLBACKS[:needed])
        
    return selected, found_tip

def generate_newsletter_json(force_zoho=False):
    import random
    all_news = fetch_latest_news()
    boc = fetch_boc_data()
    top_news, detected_tip = select_top_news(all_news)
    
    # Liens personnalisés
    booking_url = "https://calendar.app.google/a37T5exmNpFfBZ6SA" 
    facebook_url = "https://www.facebook.com/evanpatrunocourtier/"
    instagram_url = "https://www.instagram.com/evanpatruno.immo/?hl=fr"
    linkedin_url = "https://www.linkedin.com/in/evan-patruno/"

    # Sélection Citation & Astuce
    daily_quote = random.choice(CITATIONS)
    pro_tip = detected_tip if detected_tip else random.choice(PRO_TIPS)
    
    # Date du mois
    months_fr = {
        "1": "Janvier", "2": "Février", "3": "Mars", "4": "Avril",
        "5": "Mai", "6": "Juin", "7": "Juillet", "8": "Août",
        "9": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre"
    }
    now = datetime.now()
    month_name = months_fr[str(now.month)]
    year = now.year

    # Logique du Thermomètre de Marché
    boc_status = boc.get('status', 'maintenu').lower()
    if "baiss" in boc_status:
        market_temp = "Marché Actif 📈"
    elif "augment" in boc_status:
        market_temp = "Marché Calme ❄️"
    else:
        market_temp = "Marché Équilibré ⚖️"

    newsletter_data = {
        "campaign_id": f"NL-{now.month}-{year}",
        "month": month_name,
        "year": year,
        "boc_rate": f"{boc.get('rate', '--')}%",
        "boc_status": boc.get('status', 'maintenu'),
        "boc_next": boc.get('next_announcement', 'À venir'),
        "market_temp": market_temp,
        "booking_url": booking_url,
        "facebook_url": facebook_url,
        "instagram_url": instagram_url,
        "linkedin_url": linkedin_url,
        "top_articles": [
            {
                "title": item.get('title', 'Titre non disponible'),
                "summary": (item.get('description', item.get('summary', ''))[:500].rsplit('.', 1)[0] + ".") if '.' in item.get('description', '')[:500] else item.get('description', '')[:500] + "...",
                "link": item.get('link', '#'),
                "source": item.get('source', 'Source inconnue')
            } for item in top_news
        ],
        "daily_quote": daily_quote,
        "pro_tip": pro_tip,
        "expert_note": "Le marché s'équilibre. C'est le moment idéal pour réévaluer vos capacités de financement avant la prochaine vague immobilière.",
        "footer_msg": "Besoin d'une évaluation précise de votre propriété ?",
        "quick_links": [
            {"label": "Calculatrice Hypothécaire", "url": "https://www.evanpatruno.ca/outils"},
            {"label": "Évaluation Gratuite", "url": "https://www.evanpatruno.ca/vendre"}
        ]
    }
    
    # Sauvegarde locale
    with open('newsletter_ready.json', 'w', encoding='utf-8') as f:
        json.dump(newsletter_data, f, indent=2, ensure_ascii=False)
    
    # Upload au cloud
    bin_id = update_jsonbin(newsletter_data)
    print(f"Newsletter JSON générée sur le Cloud ! Bin ID: {bin_id}")

    # TRIGGER ZOHO (Seulement le 1er du mois ou si forcé)
    if now.day == 1 or force_zoho:
        trigger_zoho_webhook(newsletter_data)
        
    return newsletter_data

def trigger_zoho_webhook(data):
    webhook_url = os.getenv("ZOHO_WEBHOOK_URL")
    if not webhook_url:
        print("[Attention] ZOHO_WEBHOOK_URL non configuré. Notification Zoho annulée.")
        return
        
    print("Envoi du signal de validation au Zoho CRM...")
    try:
        # On envoie le JSON brut dans le corps de la requête (méthode la plus robuste)
        requests.post(webhook_url, json=data)
        print("Signal envoyé ! Vérifiez vos brouillons dans Zoho.")
    except Exception as e:
        print(f"Erreur Webhook Zoho: {e}")

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

# -*- coding: utf-8 -*-
import requests
import json
import os
import re
import html
from datetime import datetime

# CONFIGURATION
API_KEY = os.getenv("JSONBIN_API_KEY", "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C")
NEWS_BIN_ID = "661adbced0ea881f4082269a"
BOC_BIN_ID = "69e2a081856a682189465e17"
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

def clean_pro_tip(title, description):
    # Supprimer les mentions RSS communes
    garbage = ["est apparu en premier sur", "Lire la suite", "Mon Immeuble", "Centris", "APCIQ", "Le Devoir", "La Presse"]
    text = description
    
    # Supprimer la répétition du titre au début si présent
    if text.startswith(title):
        text = text[len(title):].lstrip(" :")
    
    # Nettoyage par phrases
    sentences = re.split(r'(?<=[.!?]) +', text)
    clean_sentences = []
    for s in sentences:
        if not any(g in s for g in garbage) and len(s) > 10:
            clean_sentences.append(s)
            
    # On ne garde que les 2 premières phrases du conseil
    result = " ".join(clean_sentences[:2]).strip()
    return result if len(result) > 40 else ""

# BANQUE DES 12 ASTUCES D'OR (Une par mois / Haute Qualité)
PRO_TIPS = [
    "Optimisation Fiscale : Les intérêts sur un prêt pour investissement locatif sont généralement déductibles d'impôts. Consultez votre comptable pour maximiser ce levier.",
    "Taux Fixe vs Variable : Dans un marché instable, le taux variable offre souvent plus de flexibilité pour refinancer sans pénalités majeures si les taux chutent.",
    "Inspection Préachat : Ne négligez jamais l'état de la fondation. Une fissure mineure peut cacher un problème structurel coûteux. Soyez vigilant !",
    "Capacité d'Achat : Le stress test est votre meilleur ami. Calculez votre budget avec un taux majoré de 2% pour assurer votre sécurité financière à long terme.",
    "Rénovations Payantes : La cuisine et la salle de bain offrent le meilleur retour sur investissement lors de la revente. Priorisez ces pièces.",
    "Copropriété : Lisez les procès-verbaux des 3 dernières années pour repérer d'éventuelles cotisations spéciales ou travaux majeurs à venir.",
    "Assurance Hypothécaire : Comparez l'assurance de la banque avec une assurance vie individuelle. Vous pourriez économiser des milliers de dollars.",
    "Mise de Fond : Le RAP (Régime d'accession à la propriété) permet d'utiliser vos REER sans impôt pour votre premier achat. Un levier puissant.",
    "Multi-Logements : Le ratio de couverture de la dette est la clé. Assurez-vous que les revenus couvrent au moins 1.2x les dépenses et l'hypothèque.",
    "Négociation : Le prix n'est pas tout. Les conditions de clôture ou l'inclusion de certains électroménagers peuvent peser lourd dans la balance.",
    "Évaluation Foncière : Elle diffère souvent du prix du marché. Ne l'utilisez pas comme seule base pour fixer votre prix de vente ou d'achat.",
    "Crédit d'Impôt : N'oubliez pas le crédit d'impôt pour l'achat d'une première habitation (CIAPH) qui peut vous redonner jusqu'à 1500$ au fédéral et provincial."
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
                    cleaned = clean_pro_tip(item.get('title', ''), item.get('description', ''))
                    if cleaned:
                        found_tip = f"{item.get('title')} : {cleaned}"
        
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

def fetch_unified_data():
    """Récupère les nouvelles et le taux BOC depuis la même boîte Cloud ou locale."""
    headers = {'X-Master-Key': API_KEY}
    try:
        # TEST LOCAL PRIORITAIRE
        if os.path.exists('news.json'):
            with open('news.json', 'r', encoding='utf-8') as f:
                record = json.load(f)
                if isinstance(record, list): # Ancien format (News uniquement)
                    return {"news": record, "boc_rate": "2.25%"}
                return record # Nouveau format (Dictionnaire complet)
                
        # FALLBACK CLOUD
        url = f"https://api.jsonbin.io/v3/b/{NEWS_BIN_ID}/latest"
        res = requests.get(url, headers=headers)
        record = res.json().get('record', {})
        if isinstance(record, list):
            return {"news": record, "boc_rate": "2.25%"}
        return record
    except Exception as e:
        print(f"Erreur Lecture Données : {e}")
        return {"news": [], "boc_rate": "2.25%"}

def generate_newsletter_json(force_zoho=False):
    import random
    now = datetime.now()
    data = fetch_unified_data()
    all_news = data.get('news', [])
    boc_rate = data.get('boc_rate', '2.25%')
    
    top_news, detected_tip = select_top_news(all_news)
    
    # Calcul du Thermomètre (Basé sur le taux)
    rate_val = float(boc_rate.replace('%', ''))
    if rate_val < 3.0:
        market_temp = "Marché Actif (Acheteur)"
    elif rate_val < 5.0:
        market_temp = "Marché Équilibré"
    else:
        market_temp = "Marché Calme (Vendeur)"
    
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
    month_name = months_fr[str(now.month)]
    year = now.year

    newsletter_data = {
        "campaign_id": f"NL-{now.month}-{year}",
        "month": month_name,
        "year": year,
        "boc_rate": boc_rate,
        "market_temp": market_temp,
        "market_status": market_temp, # Sécurité double clé
        "booking_url": booking_url,
        "facebook_url": facebook_url,
        "instagram_url": instagram_url,
        "linkedin_url": linkedin_url,
        "top_articles": [
            {
                "title": item.get('title', 'Titre non disponible'),
                "summary": item.get('description', item.get('summary', ''))[:500],
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
    
    # Sécurité ultime : On injecte les alias pour les articles
    newsletter_data["articles"] = newsletter_data["top_articles"]
    newsletter_data["news_list"] = newsletter_data["top_articles"]
    
    # Sauvegarde locale
    with open('newsletter_ready.json', 'w', encoding='utf-8') as f:
        json.dump(newsletter_data, f, indent=2, ensure_ascii=False)
    
    # Upload au cloud
    bin_id = update_jsonbin(newsletter_data)
    print(f"Newsletter JSON générée sur le Cloud ! Bin ID: {bin_id}")

    # Nettoyage final de sécurité (Aseptisation pour Zoho)
    def deep_clean(obj):
        if isinstance(obj, str):
            # Suppression des caractères invisibles ou corrompus
            s = html.unescape(obj).strip()
            # On s'assure que c'est de l'ASCII/UTF-8 propre
            return s.encode('utf-8', 'ignore').decode('utf-8')
        elif isinstance(obj, dict):
            return {k: deep_clean(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [deep_clean(i) for i in obj]
        return obj

    final_data = deep_clean(newsletter_data)
    
    # Sécurité : On double les clés pour être sûr que Zoho trouve son bonheur
    final_data["market_status"] = market_temp
    final_data["boc_rate_val"] = rate_val
    
    # TRIGGER ZOHO (Seulement le 1er du mois ou si forcé)
    if now.day == 1 or force_zoho:
        trigger_zoho_webhook(final_data)
        
    return final_data

def trigger_zoho_webhook(data):
    webhook_url = os.getenv("ZOHO_WEBHOOK_URL")
    if not webhook_url:
        print("[Attention] ZOHO_WEBHOOK_URL non configuré. Notification Zoho annulée.")
        return
        
    print("Envoi du signal de validation au Zoho CRM...")
    try:
        # On envoie le JSON brut dans le corps de la requête
        response = requests.post(webhook_url, json=data, timeout=25)
        
        print(f"Statut Zoho : {response.status_code}")
        if response.status_code == 200:
            print("Signal envoyé avec succès !")
        else:
            print(f"Erreur de Zoho : {response.status_code}")
            print(f"Détail : {response.text}")
            
    except Exception as e:
        print(f"Erreur Webhook Zoho : {e}")

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

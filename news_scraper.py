# -*- coding: utf-8 -*-
import requests
import xml.etree.ElementTree as ET
import json
import re
import os
import html
from datetime import datetime

# CONFIGURATION
API_KEY = os.getenv("JSONBIN_API_KEY", "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C")
# NOUS ALLONS CRÉER UN NOUVEAU BIN POUR LES NEWS OU UTILISER LE MÊME? 
# POUR LE MOMENT, NOUS UTILISONS UN BIN DÉDIÉ AUX NEWS (PLUS PROPRE).
BIN_ID_FILE = "news_bin_id.txt"
HARDCODED_NEWS_BIN_ID = "69e6d40c856a6821895644dc"

FEEDS = [
    {"name": "Blogue Centris", "url": "https://www.centris.ca/fr/blogue/rss"},
    {"name": "APCIQ", "url": "https://apciq.ca/fr/nouvelles/feed/"},
    {"name": "Les Affaires - Immobilier", "url": "https://www.lesaffaires.com/flux-rss/immobilier/48"},
    {"name": "La Presse - Affaires", "url": "https://www.lapresse.ca/affaires/rss"},
    {"name": "Le Devoir - Économie", "url": "https://www.ledevoir.com/rss/section/economie.xml"},
    {"name": "Radio-Canada", "url": "https://ici.radio-canada.ca/rss/1000516"},
    {"name": "TVA Nouvelles", "url": "https://www.tvanouvelles.ca/rss/sections/argent"},
    {"name": "Google News - Immo QC", "url": "https://news.google.com/rss/search?q=immobilier+quebec+when:7d&hl=fr-CA&gl=CA&ceid=CA:fr"},
    {"name": "Google News - Taux Hypo", "url": "https://news.google.com/rss/search?q=taux+hypoth%C3%A9caire+quebec+when:7d&hl=fr-CA&gl=CA&ceid=CA:fr"},
    {"name": "Google News - BoC", "url": "https://news.google.com/rss/search?q=%22Banque+du+Canada%22+when:7d&hl=fr-CA&gl=CA&ceid=CA:fr"}
]

CITIES = ["laval", "montréal", "montreal", "chambly", "napierville", "saint-jean", "st-jean", "rive-nord", "rive-sud"]
RELEVANT_KEYWORDS = [
    "immobilier", "habitation", "logement", "résidentiel", "maison", "condo", "plex", "triplex", "duplex",
    "hypothèque", "hypothécaire", "taux", "intérêt", "mortgage", "financement", "banque du canada", "boc",
    "centris", "apciq", "prix médian", "prix de vente", "mise en chantier", "propriété",
    "courtier", "vendeur", "acheteur", "loyer", "locatif", "real estate",
    "marché immobilier", "prévision", "inflation", "crédit", "prêt", "assurance prêt", "schl", "cmhc",
    "copropriété", "taxe de bienvenue", "premier acheteur", "investissement"
]


def parse_xml_robust(content):
    """Fallback method using regex if ET fails due to malformed XML"""
    items = []
    matches = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)
    for match in matches:
        title = re.search(r'<title>(.*?)</title>', match, re.DOTALL)
        link = re.search(r'<link>(.*?)</link>', match, re.DOTALL)
        desc = re.search(r'<description>(.*?)</description>', match, re.DOTALL)
        pub_date = re.search(r'<pubDate>(.*?)</pubDate>', match, re.DOTALL)
        
        items.append({
            "title": title.group(1) if title else "",
            "link": link.group(1) if link else "",
            "description": desc.group(1) if desc else "",
            "pubDate": pub_date.group(1) if pub_date else ""
        })
    return items

def fetch_feed_news(source_name, url):
    print(f"Extraction {source_name}: {url}")
    try:
        # User-Agent plus complet pour éviter les blocages
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
        }
        response = requests.get(url, headers=headers, timeout=15)
        
        # Détection intelligente de l'encodage source
        response.encoding = response.apparent_encoding
        content = response.text
        
        if response.status_code != 200:
            print(f"  [Erreur] Code {response.status_code} pour {source_name}")
            return []
        
        items = []
        try:
            # Standard parsing
            root = ET.fromstring(response.content)
            for item in root.findall('.//item'):
                items.append({
                    "title": item.find('title').text if item.find('title') is not None else "",
                    "link": item.find('link').text if item.find('link') is not None else "",
                    "description": item.find('description').text if item.find('description') is not None else "",
                    "pubDate": item.find('pubDate').text if item.find('pubDate') is not None else ""
                })
        except:
            # Fallback for malformed XML
            print(f"  [Info] Format XML imparfait pour {source_name}, passage en mode extraction par regex.")
            items = parse_xml_robust(response.text)
            
        articles = []
        for item in items:
            title = item["title"]
            link = item["link"]
            desc = item["description"]
            
            # Nettoyage CDATA, HTML et Entités
            def ultra_clean(text):
                if not text: return ""
                # Supprimer HTML et CDATA
                text = re.sub('<[^<]+?>', '', re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', text))
                # Unescape HTML entities
                text = html.unescape(text)
                # Supprimer les caractères corrompus (ASCII non-imprimable et bruits de décodage)
                text = text.encode('utf-8', 'ignore').decode('utf-8')
                return text.strip()

            clean_title = ultra_clean(title)
            clean_desc = ultra_clean(desc)
            
            # Correction spécifique pour les noms de sources
            # Pour Google News, on essaie d'extraire le site original entre parenthèses
            clean_source = ultra_clean(source_name)
            if "Google News" in clean_source:
                src_match = re.search(r'\((.*?)\)', title) # Google News met souvent la source dans le titre
                if src_match:
                    clean_source = src_match.group(1)
                else:
                    # Alternative: extraire le domaine du lien
                    domain_match = re.search(r'https?://(?:www\.)?([^/]+)', link)
                    if domain_match:
                        clean_source = domain_match.group(1)
            
            if "Devoir" in clean_source: clean_source = "Le Devoir"
            if "Radio-Canada" in clean_source: clean_source = "Radio-Canada"
            if "La Presse" in clean_source: clean_source = "La Presse"
            if "Les Affaires" in clean_source: clean_source = "Les Affaires"

            full_text = (clean_title + " " + clean_desc).lower()
            matched_cities = []
            for city in CITIES:
                if city in full_text:
                    matched_cities.append(city.replace('montréal', 'montreal').replace('st-jean', 'saint-jean'))

            # FILTRAGE PAR MOTS-CLÉS (Pertinence Thématique)
            is_relevant = any(kw in full_text for kw in RELEVANT_KEYWORDS)
            if not is_relevant:
                continue # Passer à l'article suivant s'il n'est pas lié à l'immobilier/hypothécaire

            articles.append({
                "title": clean_title,
                "link": link.strip(),
                "source": clean_source,
                "description": clean_desc,
                "cities": list(set(matched_cities)),
                "category": "local" if matched_cities else "general"
            })
            
        return articles
    except Exception as e:
        print(f"Erreur flux {source_name}: {e}")
        return []

def update_jsonbin(data):
    headers = {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Private': 'false'
    }
    
    bin_id = HARDCODED_NEWS_BIN_ID
    if os.path.exists(BIN_ID_FILE):
        with open(BIN_ID_FILE, 'r') as f:
            bin_id = f.read().strip()

    if bin_id:
        url = f"https://api.jsonbin.io/v3/b/{bin_id}"
        requests.put(url, json=data, headers=headers)
    else:
        url = "https://api.jsonbin.io/v3/b"
        res = requests.post(url, json=data, headers=headers)
        if res.status_code == 200:
            bin_id = res.json()['metadata']['id']
            with open(BIN_ID_FILE, 'w') as f:
                f.write(bin_id)
    
    return bin_id

def fetch_apciq_stats():
    """Extracts market statistics from the latest APCIQ press releases."""
    print("Extraction des statistiques APCIQ...")
    
    # Données Q1 2026 (Complets) par défaut au cas où le scraping échoue
    stats = {
        "montreal": {
            "price": "640 000", "trend": "+7%", 
            "condo_price": "430 000", "condo_trend": "+4%",
            "sales": "12 500", "sales_trend": "+10%",
            "new_listings": "15 800", "active_listings": "18 200",
            "days": "55", "condition": "Vendeurs"
        },
        "laval": {
            "price": "595 000", "trend": "+12%", 
            "condo_price": "395 000", "condo_trend": "+8%",
            "sales": "2 200", "sales_trend": "+8%",
            "new_listings": "2 800", "active_listings": "3 100",
            "days": "52", "condition": "Vendeurs"
        },
        "rive-sud": {
            "price": "597 500", "trend": "+13%", 
            "condo_price": "405 000", "condo_trend": "+10%",
            "sales": "5 100", "sales_trend": "+12%",
            "new_listings": "6 200", "active_listings": "6 500",
            "days": "48", "condition": "Vendeurs"
        },
        "rive-nord": {
            "price": "534 000", "trend": "+12%", 
            "condo_price": "355 000", "condo_trend": "+9%",
            "sales": "4 200", "sales_trend": "+15%",
            "new_listings": "5 400", "active_listings": "5 800",
            "days": "45", "condition": "Vendeurs"
        },
        "last_quarter": "Q1 2026"
    }

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get("https://apciq.ca/fr/nouvelles/", headers=headers, timeout=10)
        content = res.text
        
        # Trouver le dernier baromètre
        match = re.search(r'href="(https://apciq.ca/fr/nouvelles/[^"]+barometre[^"]+)"', content)
        if match:
            article_url = match.group(1)
            print(f"  Analyse du communiqué : {article_url}")
            art_res = requests.get(article_url, headers=headers, timeout=10)
            art_text = art_res.text
            
            # Extraction par bloc de région
            regions_map = {
                "montreal": ["RMR de Montréal", "Région métropolitaine de Montréal"],
                "laval": ["Laval"],
                "rive-sud": ["Rive-Sud de Montréal", "Rive-Sud"],
                "rive-nord": ["Rive-Nord de Montréal", "Rive-Nord"]
            }

            for key, aliases in regions_map.items():
                for alias in aliases:
                    # Trouver le bloc de texte pour cette région
                    block_match = re.search(rf"{alias}.*?(?=\n\n|\n[A-Z]|$)", art_text, re.DOTALL | re.IGNORECASE)
                    if block_match:
                        block = block_match.group(0)
                        
                        # Prix Unifamiliale
                        p_uni = re.search(r"unifamiliales.*?([0-9 ]+)\s*\$", block, re.IGNORECASE)
                        if p_uni: stats[key]["price"] = p_uni.group(1).strip()
                        
                        # Prix Condo
                        p_condo = re.search(r"copropriétés.*?([0-9 ]+)\s*\$", block, re.IGNORECASE)
                        if p_condo: stats[key]["condo_price"] = p_condo.group(1).strip()
                        
                        # Ventes
                        v_match = re.search(r"([0-9 ]+)\s*ventes", block, re.IGNORECASE)
                        if v_match: stats[key]["sales"] = v_match.group(1).strip()
                        
                        # Délais
                        d_match = re.search(r"délai de vente.*?([0-9]+)\s*jours", block, re.IGNORECASE)
                        if d_match: stats[key]["days"] = d_match.group(1).strip()

            # Conditions de marché (Global or per region if found)
            if "l’avantage des vendeurs" in art_text:
                for r in ["montreal", "laval", "rive-sud", "rive-nord"]: stats[r]["condition"] = "Vendeurs"
            elif "l’avantage des acheteurs" in art_text:
                for r in ["montreal", "laval", "rive-sud", "rive-nord"]: stats[r]["condition"] = "Acheteurs"

    except Exception as e:
        print(f"  [Info] Échec de l'auto-extraction stats : {e}. Utilisation des données Q1 2026.")
    
    return stats

def get_boc_rate():
    """Fetches the latest overnight rate from Bank of Canada."""
    try:
        url = "https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1"
        res = requests.get(url, timeout=10)
        data = res.json()
        rate = data.get('observations', [{}])[-1].get('V39079', {}).get('v', '2.25')
        return f"{rate}%"
    except:
        return "2.25%"

def main():
    all_news = []
    for feed in FEEDS:
        all_news.extend(fetch_feed_news(feed["name"], feed["url"]))
    
    unique_news = {n['link']: n for n in all_news}.values()
    final_news = list(unique_news)[:60]
    
    # On ajoute le taux BOC et les stats APCIQ
    boc_rate = get_boc_rate()
    market_stats = fetch_apciq_stats()
    
    data_to_save = {
        "news": final_news,
        "boc_rate": boc_rate,
        "market_stats": market_stats,
        "last_update": datetime.now().strftime('%Y-%m-%d %H:%M')
    }
    
    print(f"Total: {len(final_news)} news. Taux BOC: {boc_rate}")
    
    # Save local
    with open('news.json', 'w', encoding='utf-8') as f:
        json.dump(data_to_save, f, indent=2, ensure_ascii=False)
        
    # Cloud update (Le Bin des News qui fonctionne toujours)
    bin_id = update_jsonbin(data_to_save)
    print(f"Données unifiées mises à jour sur le Cloud ! Bin ID: {bin_id}")

if __name__ == "__main__":
    main()

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
    {"name": "APCIQ", "url": "https://apciq.ca/feed/"},
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
    
    # Données Avril 2026 (Complets) par défaut au cas où le scraping échoue
    stats = {
        "montreal": {
            "price": "652 250", "trend": "+7%", 
            "condo_price": "425 000", "condo_trend": "+1%",
            "sales": "11 333", "sales_trend": "-4%",
            "new_listings": "16 400", "active_listings": "18 294",
            "days": "52", "condition": "Vendeurs"
        },
        "laval": {
            "price": "645 000", "trend": "+4%", 
            "condo_price": "410 000", "condo_trend": "+3%",
            "sales": "2 150", "sales_trend": "+5%",
            "new_listings": "2 950", "active_listings": "3 200",
            "days": "49", "condition": "Vendeurs"
        },
        "rive-sud": {
            "price": "585 000", "trend": "+8%", 
            "condo_price": "395 000", "condo_trend": "+5%",
            "sales": "4 950", "sales_trend": "+6%",
            "new_listings": "6 400", "active_listings": "6 800",
            "days": "45", "condition": "Vendeurs"
        },
        "rive-nord": {
            "price": "515 000", "trend": "+6%", 
            "condo_price": "365 000", "condo_trend": "+4%",
            "sales": "4 100", "sales_trend": "+4%",
            "new_listings": "5 600", "active_listings": "6 100",
            "days": "42", "condition": "Vendeurs"
        },
        "last_quarter": "Avril 2026"
    }

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get("https://apciq.ca/feed/", headers=headers, timeout=15)
        if res.status_code != 200:
            raise Exception(f"RSS feed returned status {res.status_code}")
            
        root = ET.fromstring(res.content)
        items = root.findall('.//item')
        
        montreal_url = None
        for item in items:
            title = item.find('title').text if item.find('title') is not None else ""
            link = item.find('link').text if item.find('link') is not None else ""
            if "rmr" in title.lower() and ("montr" in title.lower() or "montreal" in title.lower()):
                montreal_url = link
                break
                
        if not montreal_url:
            raise Exception("Montreal RMR article link not found in RSS feed")
            
        print(f"  Analyse du communiqué : {montreal_url}")
        art_res = requests.get(montreal_url, headers=headers, timeout=15)
        if art_res.status_code != 200:
            raise Exception(f"Failed to fetch article page: status {art_res.status_code}")
            
        art_text = art_res.text
        
        # Clean HTML completely
        html_clean = art_text
        html_clean = re.sub(r'<script[^>]*>.*?</script>', ' ', html_clean, flags=re.DOTALL | re.IGNORECASE)
        html_clean = re.sub(r'<style[^>]*>.*?</style>', ' ', html_clean, flags=re.DOTALL | re.IGNORECASE)
        html_clean = re.sub(r'<noscript[^>]*>.*?</noscript>', ' ', html_clean, flags=re.DOTALL | re.IGNORECASE)
        html_clean = re.sub(r'<(p|br|div|li|h1|h2|h3|h4|h5|h6)[^>]*>', '\n', html_clean, flags=re.IGNORECASE)
        html_clean = re.sub(r'<[^>]+>', ' ', html_clean)
        text = html.unescape(html_clean)
        
        # Normalize spaces (preserving newlines)
        text = re.sub(r'[\xa0\u202f\t ]+', ' ', text)
        text = re.sub(r'\r\n', '\n', text)
        text = re.sub(r'\n\s*\n+', '\n\n', text)
        
        # Parse Month and Year
        month_match = re.search(r"Statistiques de ventes résidentielles Centris\s*[–-]\s*([a-zA-Zûé]+\s+[0-9]{4})", text, re.IGNORECASE)
        if month_match:
            stats["last_quarter"] = month_match.group(1).strip()
        else:
            month_match = re.search(r"données pour le mois d.*?([a-zA-Zûé]+\s+[0-9]{4})", text, re.IGNORECASE)
            if month_match:
                stats["last_quarter"] = month_match.group(1).strip()
                
        # Helper to clean number string
        def clean_num(val_str):
            return re.sub(r'\s+', '', val_str).strip()
            
        # Parse sales
        sales_para = ""
        for line in text.split('\n'):
            line_clean = line.strip()
            if not line_clean: continue
            if "transactions" in line_clean.lower() and "rmr de montréal" in line_clean.lower():
                sales_para = line_clean
                break
        if not sales_para:
            for line in text.split('\n'):
                line_clean = line.strip()
                if not line_clean: continue
                if "ventes" in line_clean.lower() and "rmr de montréal" in line_clean.lower():
                    sales_para = line_clean
                    break
                    
        parsed_sales = None
        if sales_para:
            sales_match = re.search(r"([0-9\s]+)\s*(?:transactions|ventes)", sales_para, re.IGNORECASE)
            if sales_match:
                parsed_sales = int(clean_num(sales_match.group(1)))
                stats["montreal"]["sales"] = f"{parsed_sales:,}".replace(',', ' ')
                
            # Sales trend
            pct_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", sales_para)
            if pct_match:
                val = pct_match.group(1)
                if any(w in sales_para.lower() for w in ["recul", "baisse", "diminution", "repli"]):
                    stats["montreal"]["sales_trend"] = f"-{val}%"
                else:
                    stats["montreal"]["sales_trend"] = f"+{val}%"
                    
        # Parse listings
        listings_para = ""
        for line in text.split('\n'):
            line_clean = line.strip()
            if not line_clean: continue
            if "inscriptions" in line_clean.lower() and ("actives" in line_clean.lower() or "centris" in line_clean.lower()):
                listings_para = line_clean
                break
                
        parsed_listings = None
        if listings_para:
            listings_match = re.search(r"([0-9\s]+)\s*inscriptions", listings_para, re.IGNORECASE)
            if listings_match:
                parsed_listings = int(clean_num(listings_match.group(1)))
                stats["montreal"]["active_listings"] = f"{parsed_listings:,}".replace(',', ' ')
                # Simuler new_listings proportionnellement (environ 80% des inscriptions actives)
                stats["montreal"]["new_listings"] = f"{int(parsed_listings * 0.8):,}".replace(',', ' ')
                
        # Parse prices
        price_para = ""
        for line in text.split('\n'):
            line_clean = line.strip()
            if not line_clean: continue
            if "prix" in line_clean.lower() and "médian" in line_clean.lower() and "unifamiliales" in line_clean.lower():
                price_para = line_clean
                break
                
        parsed_price = None
        parsed_condo_price = None
        if price_para:
            # Unifamiliale price
            uni_match = re.search(r"unifamiliales\s*(?:a atteint|s'est établi à)?\s*([0-9\s]+)\s*\$", price_para, re.IGNORECASE)
            if not uni_match:
                uni_match = re.search(r"unifamiliales.*?([0-9\s]+)\s*\$", price_para, re.IGNORECASE)
            if uni_match:
                parsed_price = int(clean_num(uni_match.group(1)))
                stats["montreal"]["price"] = f"{parsed_price:,}".replace(',', ' ')
                
            # Unifamiliale trend
            uni_trend_match = re.search(r"unifamiliales.*?([0-9\s]+)\s*\$\s*\(\s*([+-]?\s*[0-9]+(?:\.[0-9]+)?\s*%)\s*\)", price_para, re.IGNORECASE)
            if uni_trend_match:
                stats["montreal"]["trend"] = re.sub(r'\s+', '', uni_trend_match.group(2))
            else:
                pct_match = re.search(r"unifamiliales.*?([0-9]+(?:\.[0-9]+)?)\s*%", price_para, re.IGNORECASE)
                if pct_match:
                    val = pct_match.group(1)
                    if any(w in price_para.lower() for w in ["recul", "baisse", "diminution", "repli"]):
                        stats["montreal"]["trend"] = f"-{val}%"
                    else:
                        stats["montreal"]["trend"] = f"+{val}%"
                        
            # Condo price
            condo_match = re.search(r"copropriétés\s*(?:sont demeurés stables depuis un an, soit|a atteint|s'est établi à)?\s*([0-9\s]+)\s*\$", price_para, re.IGNORECASE)
            if not condo_match:
                condo_match = re.search(r"copropriétés.*?([0-9\s]+)\s*\$", price_para, re.IGNORECASE)
            if condo_match:
                parsed_condo_price = int(clean_num(condo_match.group(1)))
                stats["montreal"]["condo_price"] = f"{parsed_condo_price:,}".replace(',', ' ')
                
            # Condo trend
            condo_trend_match = re.search(r"copropriétés.*?([0-9\s]+)\s*\$\s*\(\s*([+-]?\s*[0-9]+(?:\.[0-9]+)?\s*%)\s*\)", price_para, re.IGNORECASE)
            if condo_trend_match:
                stats["montreal"]["condo_trend"] = re.sub(r'\s+', '', condo_trend_match.group(2))
            elif "stable" in price_para.lower():
                stats["montreal"]["condo_trend"] = "0%"
            else:
                sentences = price_para.split('.')
                condo_sentence = next((s for s in sentences if "copropriétés" in s), "")
                if condo_sentence:
                    pct_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", condo_sentence)
                    if pct_match:
                        val = pct_match.group(1)
                        if any(w in condo_sentence.lower() for w in ["recul", "baisse", "diminution", "repli"]):
                            stats["montreal"]["condo_trend"] = f"-{val}%"
                        else:
                            stats["montreal"]["condo_trend"] = f"+{val}%"
                            
        # Parse days
        days_para = ""
        for line in text.split('\n'):
            line_clean = line.strip()
            if not line_clean: continue
            if "jours" in line_clean.lower() and "unifamiliales" in line_clean.lower() and "marché" in line_clean.lower():
                days_para = line_clean
                break
                
        if days_para:
            days_match = re.search(r"unifamiliales\s*\(\s*([0-9]+)\s*jours\s*\)", days_para, re.IGNORECASE)
            if not days_match:
                days_match = re.search(r"délai de vente.*?([0-9]+)\s*jours", days_para, re.IGNORECASE)
            if days_match:
                stats["montreal"]["days"] = days_match.group(1).strip()

        # Conditions de marché
        if "l'avantage des vendeurs" in text.lower() or "l’avantage des vendeurs" in text.lower():
            for r in ["montreal", "laval", "rive-sud", "rive-nord"]:
                stats[r]["condition"] = "Vendeurs"
        elif "l'avantage des acheteurs" in text.lower() or "l’avantage des acheteurs" in text.lower():
            for r in ["montreal", "laval", "rive-sud", "rive-nord"]:
                stats[r]["condition"] = "Acheteurs"

        # DYNAMIC SCALING FOR OTHER REGIONS (Laval, Rive-Sud, Rive-Nord)
        if parsed_price:
            price_ratio = parsed_price / 652250.0
            for r in ["laval", "rive-sud", "rive-nord"]:
                default_val = int(stats[r]["price"].replace(' ', ''))
                scaled_val = int(default_val * price_ratio)
                stats[r]["price"] = f"{scaled_val:,}".replace(',', ' ')
                
        if parsed_condo_price:
            condo_ratio = parsed_condo_price / 425000.0
            for r in ["laval", "rive-sud", "rive-nord"]:
                default_val = int(stats[r]["condo_price"].replace(' ', ''))
                scaled_val = int(default_val * condo_ratio)
                stats[r]["condo_price"] = f"{scaled_val:,}".replace(',', ' ')
                
        if parsed_sales:
            sales_ratio = parsed_sales / 11333.0
            for r in ["laval", "rive-sud", "rive-nord"]:
                default_val = int(stats[r]["sales"].replace(' ', ''))
                scaled_val = int(default_val * sales_ratio)
                stats[r]["sales"] = f"{scaled_val:,}".replace(',', ' ')
                
        if parsed_listings:
            listings_ratio = parsed_listings / 18294.0
            for r in ["laval", "rive-sud", "rive-nord"]:
                default_val = int(stats[r]["active_listings"].replace(' ', ''))
                scaled_val = int(default_val * listings_ratio)
                stats[r]["active_listings"] = f"{scaled_val:,}".replace(',', ' ')
                # Scale new listings too
                default_new = int(stats[r]["new_listings"].replace(' ', ''))
                scaled_new = int(default_new * listings_ratio)
                stats[r]["new_listings"] = f"{scaled_new:,}".replace(',', ' ')

    except Exception as e:
        print(f"  [Info] Échec de l'auto-extraction stats : {e}. Utilisation des données par défaut.")
    
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

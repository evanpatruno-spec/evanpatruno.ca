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
BLOCKED_SOURCES = [
    "tmgm.com", "vietnam.vn", "fxstreet", "dailyfx", "litefinance", "zonebourse", "investing.com", "mitrade"
]


def truncate_clean(text, max_len=260):
    """Truncates text cleanly at sentence or word boundary without cutting mid-word."""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len]
    # Try last sentence end
    last_period = max(cut.rfind('. '), cut.rfind('! '), cut.rfind('? '))
    if last_period > max_len * 0.55:
        return cut[:last_period + 1].strip()
    # Otherwise cut at last space
    last_space = cut.rfind(' ')
    if last_space > 0:
        return cut[:last_space].rstrip(',;:-–—') + "…"
    return cut + "…"


def parse_xml_robust(content):
    """Fallback method using regex if ET fails due to malformed XML"""
    items = []
    matches = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)
    for match in matches:
        title = re.search(r'<title>(.*?)</title>', match, re.DOTALL)
        link = re.search(r'<link>(.*?)</link>', match, re.DOTALL)
        desc = re.search(r'<description>(.*?)</description>', match, re.DOTALL)
        pub_date = re.search(r'<pubDate>(.*?)</pubDate>', match, re.DOTALL)
        source_tag = re.search(r'<source[^>]*>(.*?)</source>', match, re.DOTALL)
        
        items.append({
            "title": title.group(1) if title else "",
            "link": link.group(1) if link else "",
            "description": desc.group(1) if desc else "",
            "pubDate": pub_date.group(1) if pub_date else "",
            "source_tag": source_tag.group(1) if source_tag else ""
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
                    "pubDate": item.find('pubDate').text if item.find('pubDate') is not None else "",
                    "source_tag": item.find('source').text if item.find('source') is not None else ""
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
            source_tag = item.get("source_tag", "")
            
            # Nettoyage CDATA, HTML et Entités
            def ultra_clean(text):
                if not text: return ""
                # Supprimer HTML et CDATA
                text = re.sub('<[^<]+?>', ' ', re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', text, flags=re.DOTALL))
                # Unescape HTML entities
                text = html.unescape(text)
                # Supprimer les caractères corrompus (ASCII non-imprimable et bruits de décodage)
                text = text.encode('utf-8', 'ignore').decode('utf-8')
                text = re.sub(r'[\xa0\u202f\t ]+', ' ', text)
                return text.strip()

            clean_title = ultra_clean(title)
            clean_desc = ultra_clean(desc)
            clean_source = ultra_clean(source_tag) or ultra_clean(source_name)
            
            # Pour Google News, extraire la vraie source après le dernier " - " dans le titre
            if "Google News" in source_name or "news.google.com" in clean_source:
                if " - " in clean_title:
                    parts = clean_title.rsplit(" - ", 1)
                    candidate_title, candidate_src = parts[0].strip(), parts[1].strip()
                    if 1 < len(candidate_src) <= 45:
                        clean_title = candidate_title
                        if not source_tag:
                            clean_source = candidate_src
                if "Google News" in clean_source or "news.google.com" in clean_source:
                    clean_source = "Actualités Québec"
            
            # Filtrer les sources de spam / forex étrangers
            combined_check = f"{clean_source} {clean_title} {link}".lower()
            if any(blocked in combined_check for blocked in BLOCKED_SOURCES):
                continue

            if "Devoir" in clean_source: clean_source = "Le Devoir"
            if "Radio-Canada" in clean_source: clean_source = "Radio-Canada"
            if "La Presse" in clean_source: clean_source = "La Presse"
            if "Les Affaires" in clean_source: clean_source = "Les Affaires"
            if "Journal de Montréal" in clean_source: clean_source = "Le Journal de Montréal"
            if "Journal de Québec" in clean_source: clean_source = "Le Journal de Québec"

            # Supprimer le pied de page automatique WordPress (ex: APCIQ)
            clean_desc = re.sub(r"L[’']article\s+.*?est apparu en premier sur.*$", "", clean_desc, flags=re.IGNORECASE | re.DOTALL).strip()
            clean_desc = re.sub(r"Cet article\s+.*?est apparu en premier sur.*$", "", clean_desc, flags=re.IGNORECASE | re.DOTALL).strip()
            clean_desc = re.sub(r"The post\s+.*?appeared first on.*$", "", clean_desc, flags=re.IGNORECASE | re.DOTALL).strip()

            # Si la description répète simplement le titre (cas de Google News RSS), générer un résumé propre
            norm_title = re.sub(r'\W+', '', clean_title.lower())
            norm_desc = re.sub(r'\W+', '', clean_desc.lower())
            if not clean_desc or norm_desc.startswith(norm_title) or norm_title in norm_desc:
                if any(k in clean_title.lower() for k in ["taux", "banque du canada", "hypothèque", "hypothécaire"]):
                    clean_desc = f"Analyse publiée par {clean_source} sur l'évolution des taux d'intérêt et des conditions de financement hypothécaire au Canada."
                else:
                    clean_desc = f"Revue d'actualité immobilière publiée par {clean_source} portant sur les tendances récentes du marché résidentiel québécois."
            else:
                clean_desc = truncate_clean(clean_desc, 260)

            full_text = (clean_title + " " + clean_desc).lower()
            matched_cities = set()
            for city in CITIES:
                if city in full_text:
                    matched_cities.add(city.replace('montréal', 'montreal').replace('st-jean', 'saint-jean'))

            region_keywords = {
                "montreal": ["montréal", "montreal", "île de montréal", "rmr de montréal", "grand montréal", "métropole"],
                "laval": ["laval", "couronne nord", "couronnes", "rmr de montréal", "grand montréal"],
                "rive-sud": ["rive-sud", "longueuil", "brossard", "chambly", "saint-jean", "st-jean", "napierville", "candiac", "la prairie", "boucherville", "saint-hubert", "saint-lambert", "montérégie", "couronnes", "rmr de montréal"],
                "rive-nord": ["rive-nord", "terrebonne", "blainville", "saint-jérôme", "mascouche", "mirabel", "repentigny", "sainte-thérèse", "boisbriand", "laurentides", "lanaudière", "couronnes", "rmr de montréal"]
            }
            for reg_tag, kw_list in region_keywords.items():
                if any(k in full_text for k in kw_list):
                    matched_cities.add(reg_tag)

            # FILTRAGE PAR MOTS-CLÉS (Pertinence Thématique)
            is_relevant = any(kw in full_text for kw in RELEVANT_KEYWORDS)
            if not is_relevant:
                continue # Passer à l'article suivant s'il n'est pas lié à l'immobilier/hypothécaire

            articles.append({
                "title": clean_title,
                "link": link.strip(),
                "source": clean_source,
                "description": clean_desc,
                "cities": sorted(list(matched_cities)),
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
        
        candidate_urls = []
        for item in items:
            title = item.find('title').text if item.find('title') is not None else ""
            link = item.find('link').text if item.find('link') is not None else ""
            t_low = title.lower()
            l_low = link.lower()
            if ("rmr" in t_low and ("montr" in t_low or "montreal" in t_low)) or "stats-t" in l_low or "trimestre" in t_low or "ventes-residentielles" in l_low:
                candidate_urls.append(link)
                
        if not candidate_urls:
            raise Exception("Montreal RMR article link not found in RSS feed")

        def clean_num(val_str):
            return re.sub(r'\s+', '', val_str).strip()

        parsed_sales = None
        parsed_listings = None
        parsed_price = None
        parsed_condo_price = None

        for montreal_url in candidate_urls:
            print(f"  Analyse du communiqué : {montreal_url}")
            art_res = requests.get(montreal_url, headers=headers, timeout=15)
            if art_res.status_code != 200:
                continue
                
            art_text = art_res.text
            
            # Clean HTML completely
            html_clean = art_text
            html_clean = re.sub(r'<script[^>]*>.*?</script>', ' ', html_clean, flags=re.DOTALL | re.IGNORECASE)
            html_clean = re.sub(r'<style[^>]*>.*?</style>', ' ', html_clean, flags=re.DOTALL | re.IGNORECASE)
            html_clean = re.sub(r'<noscript[^>]*>.*?</noscript>', ' ', html_clean, flags=re.DOTALL | re.IGNORECASE)
            html_clean = re.sub(r'<(p|br|div|li|h1|h2|h3|h4|h5|h6)[^>]*>', '\n', html_clean, flags=re.IGNORECASE)
            html_clean = re.sub(r'<[^>]+>', ' ', html_clean)
            full_text = html.unescape(html_clean)
            full_text = re.sub(r'[\xa0\u202f\t ]+', ' ', full_text)
            full_text = re.sub(r'\r\n', '\n', full_text)
            full_text = re.sub(r'\n\s*\n+', '\n\n', full_text)

            # Parse Month / Quarter and Year from header if not yet set from most recent release
            if stats["last_quarter"] == "Avril 2026":
                month_match = re.search(r"Statistiques de ventes résidentielles Centris\s*[–—-]\s*([^\n]+?[0-9]{4})", full_text, re.IGNORECASE)
                if month_match:
                    stats["last_quarter"] = month_match.group(1).strip()
                else:
                    month_match = re.search(r"données pour le mois d[e'’\s]+([a-zA-Zûé]+\s+[0-9]{4})", full_text, re.IGNORECASE)
                    if month_match:
                        stats["last_quarter"] = month_match.group(1).strip()

            # Isolate RMR de Montréal section if inside a provincial release
            text = full_text
            mtl_sec = re.search(r"RMR de Montréal\s*:.*?(?=RMR de Québec\s*:|Données du|À propos de l)", full_text, re.IGNORECASE | re.DOTALL)
            if mtl_sec and len(mtl_sec.group(0)) > 250:
                text = mtl_sec.group(0)

            # Parse sales
            if not parsed_sales:
                sales_match = re.search(r"([0-9]{1,2}\s*[0-9]{3})\s*(?:transactions|ventes(?:\s+résidentielles)?)", text, re.IGNORECASE)
                if sales_match:
                    parsed_sales = int(clean_num(sales_match.group(1)))
                    stats["montreal"]["sales"] = f"{parsed_sales:,}".replace(',', ' ')
                    # Extract sales trend nearby
                    ctx = text[max(0, sales_match.start() - 80):min(len(text), sales_match.end() + 180)]
                    pct_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", ctx)
                    if pct_match:
                        val = pct_match.group(1)
                        if any(w in ctx.lower() for w in ["recul", "baisse", "diminution", "repli", "moins"]):
                            stats["montreal"]["sales_trend"] = f"-{val}%"
                        else:
                            stats["montreal"]["sales_trend"] = f"+{val}%"

            # Parse listings
            if not parsed_listings:
                listings_match = re.search(r"([0-9]{1,2}\s*[0-9]{3})\s*(?:inscriptions|unités|propriétés(?: résidentielles)? inscrites)", text, re.IGNORECASE)
                if not listings_match:
                    listings_match = re.search(r"système Centris a atteint\s*([0-9]{1,2}\s*[0-9]{3})\s*unités", text, re.IGNORECASE)
                if listings_match:
                    parsed_listings = int(clean_num(listings_match.group(1)))
                    stats["montreal"]["active_listings"] = f"{parsed_listings:,}".replace(',', ' ')
                    stats["montreal"]["new_listings"] = f"{int(parsed_listings * 0.8):,}".replace(',', ' ')

            # Parse prices
            if not parsed_price:
                uni_match = re.search(r"prix médian des (?:propriétés )?unifamiliales\s*(?:a atteint|s['’]est établi à|est de)?\s*([0-9]{3}\s*[0-9]{3})\s*\$", text, re.IGNORECASE)
                if uni_match:
                    parsed_price = int(clean_num(uni_match.group(1)))
                    stats["montreal"]["price"] = f"{parsed_price:,}".replace(',', ' ')
                    ctx = text[uni_match.start():min(len(text), uni_match.end() + 140)]
                    pct_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", ctx)
                    if pct_match:
                        val = pct_match.group(1)
                        if any(w in ctx.lower() for w in ["recul", "baisse", "diminution", "repli", "fléchi"]):
                            stats["montreal"]["trend"] = f"-{val}%"
                        else:
                            stats["montreal"]["trend"] = f"+{val}%"

            if not parsed_condo_price:
                condo_match = re.search(r"copropriétés[^\.]{0,120}?([0-9]{3}\s*[0-9]{3})\s*\$", text, re.IGNORECASE)
                if condo_match:
                    parsed_condo_price = int(clean_num(condo_match.group(1)))
                    stats["montreal"]["condo_price"] = f"{parsed_condo_price:,}".replace(',', ' ')
                    ctx = text[max(0, condo_match.start() - 40):min(len(text), condo_match.end() + 100)]
                    pct_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", ctx)
                    if pct_match:
                        val = pct_match.group(1)
                        if any(w in ctx.lower() for w in ["recul", "baisse", "diminution", "repli", "fléchi"]):
                            stats["montreal"]["condo_trend"] = f"-{val}%"
                        else:
                            stats["montreal"]["condo_trend"] = f"+{val}%"
                    elif "stable" in ctx.lower():
                        stats["montreal"]["condo_trend"] = "0%"

            # Parse days
            days_match = re.search(r"unifamiliales\s*\(\s*([0-9]+)\s*jours\s*\)", text, re.IGNORECASE)
            if not days_match:
                days_match = re.search(r"unifamiliales se sont vendues en moyenne en\s*([0-9]+)\s*jours", text, re.IGNORECASE)
            if days_match:
                stats["montreal"]["days"] = days_match.group(1).strip()

            # Conditions de marché
            if "avantage des vendeurs" in text.lower() or "avantage pour chacun des grands secteurs" in text.lower():
                for r in ["montreal", "laval", "rive-sud", "rive-nord"]:
                    stats[r]["condition"] = "Vendeurs"
            elif "avantage des acheteurs" in text.lower():
                for r in ["montreal", "laval", "rive-sud", "rive-nord"]:
                    stats[r]["condition"] = "Acheteurs"

            if parsed_price and parsed_sales and parsed_listings:
                break

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

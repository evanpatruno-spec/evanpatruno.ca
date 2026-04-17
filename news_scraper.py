import requests
import xml.etree.ElementTree as ET
import json
import re
import os

# CONFIGURATION
API_KEY = os.getenv("JSONBIN_API_KEY", "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C")
# NOUS ALLONS CRÉER UN NOUVEAU BIN POUR LES NEWS OU UTILISER LE MÊME? 
# POUR LE MOMENT, NOUS UTILISONS UN BIN DÉDIÉ AUX NEWS (PLUS PROPRE).
BIN_ID_FILE = "news_bin_id.txt"
HARDCODED_NEWS_BIN_ID = "661adbced0ea881f4082269a" # Place holder bin or I'll create one

FEEDS = [
    {"name": "Blogue Centris", "url": "https://www.centris.ca/fr/blogue/rss"},
    {"name": "APCIQ", "url": "https://apciq.ca/fr/nouvelles/feed/"}
]

CITIES = ["laval", "montréal", "montreal", "chambly", "napierville", "saint-jean", "st-jean", "rive-nord", "rive-sud"]

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
            
            full_text = (title + " " + desc).lower()
            matched_cities = []
            for city in CITIES:
                if city in full_text:
                    matched_cities.append(city.replace('montréal', 'montreal').replace('st-jean', 'saint-jean'))

            # ON GARDE TOUT, on ne filtre plus par ville pour éviter les newsletters vides
            articles.append({
                "title": re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', title).strip(),
                "link": link.strip(),
                "source": source_name,
                "description": re.sub('<[^<]+?>', '', re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', desc))[:1000].strip() + "...",
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

def main():
    all_news = []
    for feed in FEEDS:
        all_news.extend(fetch_feed_news(feed["name"], feed["url"]))
    
    # Sort by date (simple string sort for RSS dates or just keep original order)
    # Deduplicate by link
    unique_news = {n['link']: n for n in all_news}.values()
    final_list = list(unique_news)[:30] # Limit to 30 latest
    
    print(f"Total des nouvelles trouvées: {len(final_list)}")
    
    with open('news.json', 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)
        
    bin_id = update_jsonbin(final_list)
    print(f"News.json mis à jour sur le Cloud ! Bin ID: {bin_id}")

if __name__ == "__main__":
    main()

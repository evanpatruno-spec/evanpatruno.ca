import urllib.request
import re
import json
import os
import sys
import unicodedata
import time

def strip_accents(s):
   return ''.join(c for c in unicodedata.normalize('NFD', s)
                  if unicodedata.category(c) != 'Mn')

# Try to import requests, if not available, use standard library instructions
try:
    import requests
except ImportError:
    print("Module 'requests' not found. Installing...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests

# LIST OF PROTECTED BROKERS
TARGET_BROKERS = ["Evan Patruno", "Roger Rhéaume", "Mike Ainajian", "Sylvie Castonguay"]
MATCH_NAMES = ["evan", "patruno", "roger", "rheaume", "mike", "ainajian", "sylvie", "castonguay"]

URLS = [
    "https://www.himalayacorp.com/fr/proprietes.html"
]

API_KEY = "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C"
HARDCODED_BIN_ID = "694462e7d0ea881f4032d140"
BIN_ID_FILE = "bin_id.txt"

def update_jsonbin(data):
    """Creates or updates a bin on JSONBin.io"""
    headers = {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY
    }
    
    bin_id = HARDCODED_BIN_ID
    if not bin_id and os.path.exists(BIN_ID_FILE):
        with open(BIN_ID_FILE, 'r') as f:
            bin_id = f.read().strip()
            
    if bin_id:
        print(f"Updating existing Bin ({bin_id})...")
        url = f"https://api.jsonbin.io/v3/b/{bin_id}"
        response = requests.put(url, json=data, headers=headers)
    else:
        print("Creating new Bin...")
        url = "https://api.jsonbin.io/v3/b"
        headers['X-Bin-Private'] = 'false' 
        response = requests.post(url, json=data, headers=headers)

    if response.status_code == 200:
        result = response.json()
        if 'id' in result.get('metadata', {}):
            bin_id = result['metadata']['id']
        
        with open(BIN_ID_FILE, 'w') as f:
            f.write(bin_id)
        print(f"Success! Data uploaded to Cloud. Bin ID: {bin_id}")
        return bin_id
    else:
        print(f"Error uploading to JSONBin: {response.status_code} - {response.text}")
        return None

def fetch_html(url):
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def extract_properties(html):
    properties = []
    list_match = re.search(r'<ul class="listeProp clearfix">(.*?)</ul>', html, re.DOTALL)
    if not list_match:
        return []
    
    list_content = list_match.group(1)
    items = list_content.split('<li>')
    
    for item in items:
        if 'class="over"' not in item and 'class="vendu"' not in item:
            continue
            
        prop = {}
        
        # 1. Extract MLS Number first (it's our key)
        mls_match = re.search(r'no\.\s*([a-zA-Z0-9]+)', item, re.IGNORECASE)
        if not mls_match:
            continue
        prop['mls'] = mls_match.group(1)

        # 2. Extract Link URL (Prioritize the one mapping the image or containing 'fr/proprietes')
        # We look for ANY href that leads to a property
        links = re.findall(r'href="([^"]+)"', item)
        best_link = ""
        for link in links:
            if "fr/proprietes/" in link:
                best_link = link
                break
        
        if not best_link and links:
            best_link = links[0]
            
        if best_link:
            # Universal Minimal format confirmed by research: 'vendre-.html?NoMLS=[MLS]'
            # This format is bulletproof and prevents 404s even without a slug.
            prop['url'] = f"https://www.himalayacorp.com/fr/proprietes/vendre-.html?NoMLS={prop['mls']}"
        else:
            # Fallback (same format)
            prop['url'] = f"https://www.himalayacorp.com/fr/proprietes/vendre-.html?NoMLS={prop['mls']}"

        city_match = re.search(r'class="mun">([^<]+)</a>', item)
        prop['city'] = city_match.group(1).strip() if city_match else "N/A"
        
        price_match = re.search(r'<div class="prix">(.*?)</div>', item, re.DOTALL)
        if price_match:
            raw_price = price_match.group(1)
            clean_price = re.sub(r'<[^>]+>', '', raw_price)
            prop['price'] = ' '.join(clean_price.split())
        else:
            prop['price'] = "Contactez-nous"

        img_match = re.search(r'<img src="([^"]+)"', item)
        if img_match:
            img_url = img_match.group(1)
            if img_url.startswith('/'):
                img_url = "https://www.himalayacorp.com" + img_url
            prop['image'] = img_url
        else:
            prop['image'] = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=400"
        
        properties.append(prop)
        
    return properties

def fetch_property_details(base_url, mls):
    if 'NoMLS' in base_url:
        url = base_url
    else:
        separator = '&' if '?' in base_url else '?'
        url = f"{base_url}{separator}NoMLS={mls}"
        
    html = fetch_html(url)
    if not html:
        return {}

    details = {
        'description': '',
        'photos': [],
        'specs': {},
        'brokers': '',
        'isSold': False
    }

    if 'Vendu' in html or 'Sold' in html:
        if re.search(r'<span class="prix">.*?Vendu.*?</span>', html, re.IGNORECASE | re.DOTALL) or \
           re.search(r'<div id="infoProp">.*?Vendu.*?</div>', html, re.IGNORECASE | re.DOTALL):
            details['isSold'] = True

    desc_match = re.search(r'<div id="descriptionProp".*?<div class="slideTexte">\s*(.*?)\s*</div>', html, re.DOTALL)
    if desc_match:
        raw_desc = desc_match.group(1)
        clean_desc = re.sub(r'<br\s*/?>', '\n', raw_desc)
        clean_desc = re.sub(r'<[^>]+>', '', clean_desc)
        details['description'] = clean_desc.strip()

    photo_matches = re.finditer(r'<a href="([^"]+)" [^>]*class="fancybox"', html)
    for match in photo_matches:
        img_url = match.group(1)
        if img_url.startswith('/'):
            img_url = "https://www.himalayacorp.com" + img_url
        elif not img_url.startswith('http'):
            img_url = "https://www.himalayacorp.com/" + img_url.lstrip('/')
        
        if img_url not in details['photos']:
            details['photos'].append(img_url)

    brokers = []
    broker_matches = re.finditer(r'<h6><a [^>]+>([^<]+)</a></h6>', html)
    for match in broker_matches:
        name = match.group(1).strip()
        if name and name not in brokers:
            brokers.append(name)
    details['brokers'] = ", ".join(brokers)

    try:
        spec_matches = re.finditer(r'<tr><th>(.*?)</th><td class="droite">(.*?)</td></tr>', html, re.DOTALL)
        for match in spec_matches:
            key = re.sub(r'<[^>]+>', '', match.group(1)).strip()
            val = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', match.group(2).replace('&nbsp;', ' '))).strip()
            if key and val and key not in ['DIMENSIONS', 'COÛTS/REVENUS ET ÉVALUATION', 'CARACTÉRISTIQUES', 'DÉTAILS', 'INCLUSIONS', 'EXCLUSIONS']:
                details['specs'][key] = val
    except:
        pass

    return details

def main():
    all_props_candidates = []
    print("--- Lancement de la Recuperation INTEGRALE ---")
    
    # 1. Direct fetch from Broker Page 1
    BROKER_IDS = ["58156", "54103", "57869", "57868"]
    for bid in BROKER_IDS:
        print(f"  Extraction directe courtier {bid} (Page 1)...")
        url = f"https://www.himalayacorp.com/fr/proprietes.html?courtier_USERID={bid}"
        html = fetch_html(url)
        if html:
            all_props_candidates.extend(extract_properties(html))
        time.sleep(1)

    # 2. Extended Global Scan (100 pages)
    page_num = 1
    max_pages = 100
    print(f"\n  Balayage Global Massif (100 pages)...")
    while page_num <= max_pages:
        url = f"https://www.himalayacorp.com/fr/proprietes.html?Page={page_num}"
        print(f"  Global Page {page_num}...", end='\r')
        html = fetch_html(url)
        if not html: break
        all_props_candidates.extend(extract_properties(html))
        page_num += 1
        if page_num % 10 == 0: time.sleep(1)

    # 3. Deduplication and Team Filter
    unique_candidates = {p['mls']: p for p in all_props_candidates}
    print(f"\n\n--- Analyse de {len(unique_candidates)} maisons trouvees ---")
    
    final_team_list = []
    for i, p in enumerate(unique_candidates.values()):
        print(f"  Vérification {i+1}/{len(unique_candidates)} (MLS {p['mls']})...", end='\r')
        
        # Use the original extracted URL if available, otherwise construct it
        current_url = p.get('url', f"https://www.himalayacorp.com/fr/proprietes/vendre.html?NoMLS={p['mls']}")
        details = fetch_property_details(current_url, p['mls'])
        brokers_text = strip_accents(details.get('brokers', '').lower())
        
        if any(name in brokers_text for name in MATCH_NAMES):
            p.update(details)
            p['url'] = current_url # Ensure we keep the functional URL
            final_team_list.append(p)
            print(f"  [EQUIPE] {p['city']} - {p['mls']} ({p['price']})")
        time.sleep(0.15)

    print(f"\n--- SUCCESS ---")
    print(f"Total Final : {len(final_team_list)} proprietes identifiees.")

    with open('properties.json', 'w', encoding='utf-8') as f:
        json.dump(final_team_list, f, indent=2, ensure_ascii=False)
    
    bin_id = update_jsonbin(final_team_list)
    if bin_id:
        generate_zoho_snippet(bin_id)

def generate_zoho_snippet(bin_id):
    """Generates a complete HTML/JS/CSS snippet for Zoho Sites."""
    cloud_url = f"https://api.jsonbin.io/v3/b/{bin_id}/latest"
    api_key = API_KEY
    
    html_content = f"""
<!-- DEBUT DU SNIPPET PROPRIETES PREMIUM -->
<style>
    #evan-prop-container {{
        --primary: #873276;
        --bg-dark: #0f172a;
        --card-bg: #1e293b;
        --text-main: #f8fafc;
        --text-muted: #94a3b8;
        font-family: 'Outfit', sans-serif;
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
    }}

    .prop-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 2rem;
        padding: 1rem;
    }}

    .prop-card {{
        background: var(--card-bg);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        overflow: hidden;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        display: flex;
        flex-direction: column;
        color: white;
        position: relative;
    }}

    .prop-card:hover {{
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }}

    .sold-badge {{
        position: absolute;
        top: 15px;
        right: 15px;
        background: #ef4444;
        color: white;
        padding: 5px 15px;
        border-radius: 20px;
        font-weight: 700;
        z-index: 10;
        text-transform: uppercase;
        font-size: 0.8rem;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }}

    .prop-img-container {{ height: 220px; width: 100%; overflow: hidden; }}
    .prop-img-container img {{ width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }}
    .prop-card:hover .prop-img-container img {{ transform: scale(1.05); }}

    .prop-content {{ padding: 1.2rem; flex-grow: 1; display: flex; flex-direction: column; }}
    .prop-price {{ font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; color: #fff; }}
    .prop-city {{ font-size: 1rem; color: var(--text-muted); margin-bottom: 1rem; }}
    .prop-footer {{ margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }}
    .prop-mls {{ font-size: 0.8rem; color: var(--text-muted); }}

    .prop-btn {{ background: var(--primary); color: white !important; padding: 0.6rem 1.2rem; border-radius: 8px; text-decoration: none; font-size: 0.9rem; font-weight: 600; cursor: pointer; border: none; }}
    
    /* MODAL STYLES */
    .prop-modal {{ display: none; position: fixed; z-index: 99999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); }}
    .prop-modal-content {{ background: #1e293b; margin: 3% auto; width: 90%; max-width: 900px; border-radius: 15px; color: white; position: relative; overflow: hidden; animation: slideIn 0.3s ease; }}
    @keyframes slideIn {{ from {{ transform: translateY(-30px); opacity: 0; }} to {{ transform: translateY(0); opacity: 1; }} }}
    .close-modal {{ position: absolute; right: 20px; top: 15px; font-size: 30px; color: #fff; cursor: pointer; z-index: 100; }}
    .modal-gallery {{ height: 450px; background: #000; position: relative; display: flex; align-items: center; justify-content: center; }}
    .modal-gallery img {{ max-height: 100%; max-width: 100%; object-fit: contain; }}
    .modal-details {{ padding: 2.5rem; }}
    .modal-price {{ font-size: 2rem; color: var(--primary); font-weight: 800; margin-bottom: 1rem; }}
    .modal-specs {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 10px; margin: 1.5rem 0; }}
    .spec-label {{ font-size: 0.8rem; color: var(--text-muted); display: block; }}
    .spec-value {{ font-weight: 600; font-size: 1rem; }}
    .gallery-btn {{ position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; padding: 1.5rem 1rem; cursor: pointer; font-size: 2rem; }}
    .prev-btn {{ left: 0; }} .next-btn {{ right: 0; }}

    @media (max-width: 768px) {{ .modal-gallery {{ height: 250px; }} .prop-grid {{ grid-template-columns: 1fr; }} }}
</style>

<div id="evan-prop-container">
    <div class="prop-grid" id="prop-grid-target">
        <div style="color:white;text-align:center;padding:50px;">Chargement des propriétés...</div>
    </div>

    <div id="prop-modal" class="prop-modal">
        <div class="prop-modal-content">
            <span class="close-modal" id="closeModal">&times;</span>
            <div class="modal-gallery">
                <button class="gallery-btn prev-btn" id="prevBtn">&#10094;</button>
                <img id="modal-img" src="">
                <button class="gallery-btn next-btn" id="nextBtn">&#10095;</button>
            </div>
            <div class="modal-details">
                <div id="modal-title" style="font-size:1.8rem; font-weight:700; margin-bottom: 0.5rem;"></div>
                <div id="modal-price" class="modal-price"></div>
                <div id="modal-brokers" style="font-style:italic; color:var(--text-muted); margin-bottom: 1.5rem;"></div>
                <div id="modal-specs" class="modal-specs"></div>
                <div id="modal-desc" style="line-height:1.6; color:#cbd5e1; white-space:pre-wrap; margin-bottom: 2rem;"></div>
                <a href="#" id="modal-link" target="_blank" class="prop-btn">Voir sur le site officiel</a>
            </div>
        </div>
    </div>
</div>

<script>
(function() {{
    const CLOUD_URL = "{cloud_url}";
    const API_KEY = "{api_key}";
    let props = [];
    let currentPhotos = [];
    let photoIdx = 0;

    async function init() {{
        try {{
            const res = await fetch(CLOUD_URL, {{ headers: {{ 'X-Master-Key': API_KEY }} }});
            const data = await res.json();
            props = data.record;
            
            // Sort: Actives first, Sold last
            props.sort((a, b) => (a.isSold === b.isSold) ? 0 : a.isSold ? 1 : -1);
            
            render(props);
        }} catch (e) {{ console.error(e); document.getElementById('prop-grid-target').innerHTML = "Erreur."; }}
    }}

    function render(list) {{
        const grid = document.getElementById('prop-grid-target');
        grid.innerHTML = list.map((p, i) => `
            <div class="prop-card">
                ${{p.isSold ? '<div class="sold-badge">Vendu</div>' : ''}}
                <div class="prop-img-container"><img src="${{p.image}}" loading="lazy"></div>
                <div class="prop-content">
                    <div class="prop-price">${{p.price}}</div>
                    <div class="prop-city">${{p.city}}</div>
                    <div class="prop-footer">
                        <span class="prop-mls">MLS ${{p.mls}}</span>
                        <button class="prop-btn" onclick="window.openPropModal(${{i}})">Détails</button>
                    </div>
                </div>
            </div>
        `).join('');
    }}

    window.openPropModal = (idx) => {{
        const p = props[idx];
        const modal = document.getElementById('prop-modal');
        document.getElementById('modal-title').textContent = p.city;
        document.getElementById('modal-price').textContent = p.price;
        document.getElementById('modal-brokers').textContent = "Par : " + (p.brokers || "Evan Patruno");
        document.getElementById('modal-desc').textContent = p.description;
        document.getElementById('modal-link').href = p.url;
        
        const specs = document.getElementById('modal-specs');
        specs.innerHTML = Object.entries(p.specs || {{}}).map(([k,v]) => `<div><span class="spec-label">${{k}}</span><span class="spec-value">${{v}}</span></div>`).join('');
        
        currentPhotos = p.photos && p.photos.length ? p.photos : [p.image];
        photoIdx = 0;
        document.getElementById('modal-img').src = currentPhotos[0];
        
        modal.style.display = "block";
    }};

    document.getElementById('closeModal').onclick = () => {{ document.getElementById('prop-modal').style.display = 'none'; }};
    document.getElementById('prevBtn').onclick = () => {{ photoIdx = (photoIdx > 0) ? photoIdx - 1 : currentPhotos.length - 1; document.getElementById('modal-img').src = currentPhotos[photoIdx]; }};
    document.getElementById('nextBtn').onclick = () => {{ photoIdx = (photoIdx < currentPhotos.length - 1) ? photoIdx + 1 : 0; document.getElementById('modal-img').src = currentPhotos[photoIdx]; }};

    init();
}})();
</script>
    """
    with open('zoho_snippet.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("Snippet 'zoho_snippet.html' mis à jour.")

if __name__ == "__main__":
    main()

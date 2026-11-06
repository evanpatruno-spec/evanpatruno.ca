import urllib.request
import re
import json
import os
import sys
import unicodedata
import time
import requests

TARGET_BROKERS_MAP = {
    "58156": "Evan Patruno",
    "54103": "Roger Rhéaume",
    "57869": "Mike Ainajian",
    "57868": "Sylvie Castonguay"
}

API_KEY = os.getenv("JSONBIN_API_KEY", "").strip()
HARDCODED_BIN_ID = "694462e7d0ea881f4032d140"
BIN_ID_FILE = "bin_id.txt"

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def update_jsonbin(data):
    if not API_KEY:
        print("[Info] JSONBIN_API_KEY non défini — mise à jour cloud ignorée (fichier local mis à jour).")
        return HARDCODED_BIN_ID
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
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        return None

def extract_property_brokers_strict(html, default_broker=""):
    if not html:
        return default_broker

    courtier_match = re.search(r'<div id="courtierProp"[^>]*>([\s\S]*?)</div>\s*</div>', html)
    if not courtier_match:
        return default_broker

    courtier_html = courtier_match.group(1)
    items = re.findall(r'<li[^>]*>([\s\S]*?)</li>', courtier_html)
    raw_brokers = []
    for item in items:
        name_match = re.search(r'<h6><a [^>]+>([^<]+)</a></h6>', item)
        if name_match:
            name = name_match.group(1).strip()
            if name and name not in raw_brokers:
                raw_brokers.append(name)

    if not raw_brokers:
        return default_broker

    # If full agency dump (>= 4 brokers)
    if len(raw_brokers) >= 4:
        if default_broker:
            return default_broker
        return raw_brokers[0]

    return ", ".join(raw_brokers)

def extract_specs_from_html(html):
    if not html: return {}
    specs = {}
    spec_matches = re.finditer(r'<tr>\s*<th>(.*?)</th>\s*<td class="droite">(.*?)</td>\s*</tr>', html, re.DOTALL)
    for match in spec_matches:
        key = re.sub(r'<[^>]+>', '', match.group(1)).strip()
        val = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', match.group(2).replace('&nbsp;', ' '))).strip()
        if key and val and key not in ['DIMENSIONS', 'COÛTS/REVENUS ET ÉVALUATION', 'CARACTÉRISTIQUES', 'DÉTAILS', 'INCLUSIONS', 'EXCLUSIONS']:
            specs[key] = val
    return specs

def extract_properties_from_list_page(html, assigned_broker=""):
    properties = []
    list_match = re.search(r'<ul class="listeProp clearfix">(.*?)</ul>', html, re.DOTALL)
    if not list_match:
        return []
    
    items = list_match.group(1).split('<li>')
    for item in items:
        if 'class="over"' not in item and 'class="vendu"' not in item:
            continue
            
        mls_match = re.search(r'no\.\s*([a-zA-Z0-9]+)', item, re.IGNORECASE)
        if not mls_match:
            continue
        mls = mls_match.group(1)
        if mls.lower() == 'html':
            continue

        prop = {'mls': mls}
        
        links = re.findall(r'href="([^"]+)"', item)
        best_link = ""
        for link in links:
            if "fr/proprietes/" in link or "proprietes/" in link:
                best_link = link
                break
        if not best_link and links:
            best_link = links[0]
            
        if best_link:
            if not best_link.startswith('http'):
                prop['url'] = "https://www.himalayacorp.com/" + best_link.lstrip('/')
            else:
                prop['url'] = best_link
        else:
            prop['url'] = f"https://www.himalayacorp.com/fr/proprietes/vendre-.html?NoMLS={mls}"

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
            elif not img_url.startswith('http'):
                img_url = "https://www.himalayacorp.com/" + img_url.lstrip('/')
            prop['image'] = img_url
        else:
            prop['image'] = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=400"
        
        prop['default_broker'] = assigned_broker
        properties.append(prop)
        
    return properties

def main():
    print("--- Lancement de la Récupération INTÉGRALE ---")
    all_props = {}
    
    # 1. Fetch properties by broker
    for bid, bname in TARGET_BROKERS_MAP.items():
        print(f"  Extraction directe courtier {bname} ({bid})...")
        url = f"https://www.himalayacorp.com/fr/proprietes.html?courtier_USERID={bid}"
        html = fetch_html(url)
        if html:
            props = extract_properties_from_list_page(html, assigned_broker=bname)
            print(f"    -> {len(props)} trouvées pour {bname}")
            for p in props:
                all_props[p['mls']] = p
        time.sleep(0.5)

    # 2. Preserve archived/sold properties if present
    if os.path.exists('properties.json'):
        with open('properties.json', 'r', encoding='utf-8') as f:
            old_props = json.load(f)
        for op in old_props:
            if op.get('isSold') and op['mls'] not in all_props:
                if op['mls'] in ['10414317', '21926457']:
                    op['brokers'] = 'Evan Patruno'
                all_props[op['mls']] = op

    # 3. Enrich details
    final_list = []
    for mls, p in all_props.items():
        d_url = p.get('url', '')
        html = fetch_html(d_url) if d_url else None
        
        if html:
            desc_match = re.search(r'<div id="descriptionProp".*?<div class="slideTexte">\s*(.*?)\s*</div>', html, re.DOTALL)
            if desc_match:
                clean_desc = re.sub(r'<br\s*/?>', '\n', desc_match.group(1))
                clean_desc = re.sub(r'<[^>]+>', '', clean_desc)
                p['description'] = clean_desc.strip()

            photos = []
            photo_matches = re.finditer(r'<a href="([^"]+)" [^>]*class="fancybox"', html)
            for match in photo_matches:
                img_url = match.group(1)
                if img_url.startswith('/'):
                    img_url = "https://www.himalayacorp.com" + img_url
                elif not img_url.startswith('http'):
                    img_url = "https://www.himalayacorp.com/" + img_url.lstrip('/')
                if img_url not in photos:
                    photos.append(img_url)
            if photos:
                p['photos'] = photos
                p['image'] = photos[0]
            elif not p.get('photos'):
                p['photos'] = [p['image']]

            p['specs'] = extract_specs_from_html(html)
            default_b = p.get('default_broker') or p.get('brokers') or 'Evan Patruno'
            p['brokers'] = extract_property_brokers_strict(html, default_broker=default_b)

            if 'Vendu' in html or 'Sold' in html:
                if re.search(r'<span class="prix">.*?Vendu.*?</span>', html, re.IGNORECASE | re.DOTALL) or \
                   re.search(r'<div id="infoProp">.*?Vendu.*?</div>', html, re.IGNORECASE | re.DOTALL):
                    p['isSold'] = True
        else:
            if not p.get('brokers'):
                p['brokers'] = p.get('default_broker', 'Evan Patruno')
            if not p.get('photos'):
                p['photos'] = [p.get('image', '')]

        p.pop('default_broker', None)
        final_list.append(p)
        time.sleep(0.1)

    final_list.sort(key=lambda x: 1 if x.get('isSold') else 0)

    print(f"\nTotal Final : {len(final_list)} propriétés identifiées.")

    with open('properties.json', 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)
    
    bin_id = update_jsonbin(final_list)
    if bin_id:
        generate_zoho_snippet(bin_id)

def generate_zoho_snippet(bin_id):
    cloud_url = f"https://api.jsonbin.io/v3/b/{bin_id}/latest"
    api_key = API_KEY
    
    html_content = f"""<!-- DEBUT DU SNIPPET PROPRIETES PREMIUM -->
<style>
    #evan-prop-container {{
        --primary: #873276;
        --accent: #ff007f;
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
        border-radius: 16px;
        overflow: hidden;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        display: flex;
        flex-direction: column;
        color: white;
        position: relative;
    }}

    .prop-card:hover {{
        transform: translateY(-5px);
        box-shadow: 0 15px 30px rgba(0,0,0,0.4);
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

    .prop-img-container {{ height: 230px; width: 100%; overflow: hidden; position: relative; }}
    .prop-img-container img {{ width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }}
    .prop-card:hover .prop-img-container img {{ transform: scale(1.06); }}

    .prop-content {{ padding: 1.4rem; flex-grow: 1; display: flex; flex-direction: column; }}
    .prop-price {{ font-size: 1.4rem; font-weight: 800; margin-bottom: 0.4rem; color: #fff; }}
    .prop-city {{ font-size: 1.05rem; color: var(--text-muted); margin-bottom: 1rem; font-weight: 500; }}
    .prop-footer {{ margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }}
    .prop-mls {{ font-size: 0.82rem; color: var(--text-muted); font-weight: 600; }}

    .prop-btn {{ background: linear-gradient(135deg, #873276, #ff007f); color: white !important; padding: 0.65rem 1.3rem; border-radius: 10px; text-decoration: none; font-size: 0.9rem; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; }}
    .prop-btn:hover {{ opacity: 0.92; transform: scale(1.02); }}

    /* MODAL STYLES */
    .prop-modal {{ display: none; position: fixed; z-index: 99999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(10,10,25,0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); overflow-y: auto; }}
    .prop-modal-content {{ background: #130a1b; margin: 30px auto; width: 92%; max-width: 950px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.12); color: white; position: relative; overflow: hidden; animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 40px 80px rgba(0,0,0,0.6); }}
    @keyframes slideIn {{ from {{ transform: translateY(30px) scale(0.97); opacity: 0; }} to {{ transform: translateY(0) scale(1); opacity: 1; }} }}
    .close-modal {{ position: absolute; right: 20px; top: 15px; font-size: 32px; color: #fff; cursor: pointer; z-index: 100; opacity: 0.8; transition: opacity 0.2s; }}
    .close-modal:hover {{ opacity: 1; }}
    
    .modal-gallery {{ height: 460px; background: #000; position: relative; display: flex; align-items: center; justify-content: center; }}
    .modal-gallery img {{ max-height: 100%; max-width: 100%; object-fit: contain; }}
    .gallery-btn {{ position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; padding: 1.2rem 1rem; cursor: pointer; font-size: 1.8rem; border-radius: 8px; transition: background 0.2s; }}
    .gallery-btn:hover {{ background: rgba(0,0,0,0.8); }}
    .prev-btn {{ left: 15px; }} .next-btn {{ right: 15px; }}

    .modal-details {{ padding: 2.2rem; }}
    .modal-header-row {{ display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; margin-bottom: 8px; }}
    .modal-title-text {{ font-size: 2.2rem; font-weight: 800; font-family: 'Outfit', sans-serif; }}
    .modal-price-text {{ font-size: 2rem; color: #ff80bf; font-weight: 800; font-family: 'Outfit', sans-serif; }}
    .modal-broker-pill {{ display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.06); padding: 8px 16px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; font-size: 0.9rem; }}

    /* SPECS & FINANCIAL LUXURY ARCHITECTURE */
    .specs-hero-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-bottom: 22px;
    }}

    .spec-hero-card {{
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.2s ease;
    }}
    .spec-hero-card:hover {{ background: rgba(255, 255, 255, 0.07); border-color: rgba(255, 0, 127, 0.3); transform: translateY(-2px); }}

    .hero-card-icon {{
        font-size: 1.4rem;
        background: rgba(135, 50, 118, 0.25);
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        flex-shrink: 0;
    }}

    .hero-card-info {{ display: flex; flex-direction: column; overflow: hidden; }}
    .hero-card-label {{ font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 2px; }}
    .hero-card-val {{ font-size: 0.95rem; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}

    /* FINANCIAL BLOCK */
    .specs-financial-block {{
        background: linear-gradient(135deg, rgba(135, 50, 118, 0.18) 0%, rgba(20, 10, 30, 0.6) 100%);
        border: 1px solid rgba(255, 0, 127, 0.25);
        border-radius: 20px;
        padding: 22px;
        margin-bottom: 22px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }}

    .financial-header {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }}

    .fin-title {{ font-size: 1.05rem; font-weight: 800; color: #ffffff; font-family: 'Outfit', sans-serif; letter-spacing: 0.3px; }}
    .fin-year-badge {{ background: rgba(255, 255, 255, 0.1); color: #ffb8e6; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }}
    .financial-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}

    @media (max-width: 600px) {{ .financial-grid {{ grid-template-columns: 1fr; gap: 15px; }} }}

    .fin-col {{ background: rgba(0, 0, 0, 0.25); padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.05); }}
    .fin-subhead {{ font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #ff80bf; font-weight: 700; margin-bottom: 10px; }}
    .fin-row {{ display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.88rem; color: rgba(255, 255, 255, 0.8); border-bottom: 1px dashed rgba(255, 255, 255, 0.07); }}
    .fin-row:last-child {{ border-bottom: none; }}
    .fin-row.fin-total {{ margin-top: 6px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.15); font-weight: 700; color: #ffffff; }}
    .tax-total-badge {{ color: #4ade80; font-size: 1rem; font-weight: 800; }}
    .eval-total-badge {{ color: #38bdf8; font-size: 1rem; font-weight: 800; }}

    /* TAGS & PILLS */
    .specs-tags-block {{ background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px; margin-bottom: 20px; }}
    .tags-title, .box-title, .infra-title, .others-title {{ font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.9px; color: var(--text-muted); font-weight: 700; margin-bottom: 12px; }}
    .tags-list {{ display: flex; flex-wrap: wrap; gap: 8px; }}

    .spec-tag {{ display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 30px; font-size: 0.82rem; font-weight: 600; line-height: 1.2; }}
    .commerce-tag {{ background: rgba(135, 50, 118, 0.25); color: #ffb8e6; border: 1px solid rgba(255, 0, 127, 0.3); }}
    .feature-tag {{ background: rgba(56, 189, 248, 0.15); color: #bae6fd; border: 1px solid rgba(56, 189, 248, 0.3); }}
    .location-tag {{ background: rgba(74, 222, 128, 0.15); color: #bbf7d0; border: 1px solid rgba(74, 222, 128, 0.3); }}

    .specs-highlights-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-bottom: 20px; }}
    .highlight-box {{ background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 16px; }}

    .specs-infra-block {{ background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px; margin-bottom: 20px; }}
    .infra-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }}
    .infra-item {{ display: flex; flex-direction: column; padding: 8px 12px; background: rgba(0, 0, 0, 0.2); border-radius: 10px; }}
    .infra-k {{ font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px; }}
    .infra-v {{ font-size: 0.88rem; color: #ffffff; font-weight: 600; }}

    .specs-others-block {{ background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 16px; padding: 18px; margin-bottom: 25px; }}
    .others-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }}
    .other-item {{ display: flex; flex-direction: column; padding: 8px 10px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; }}
    .other-k {{ font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; }}
    .other-v {{ font-size: 0.85rem; color: #ffffff; font-weight: 600; }}

    @media (max-width: 768px) {{
        .modal-gallery {{ height: 260px; }}
        .modal-details {{ padding: 1.5rem; }}
        .modal-title-text {{ font-size: 1.6rem; }}
        .modal-price-text {{ font-size: 1.5rem; }}
    }}
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
                <div class="modal-header-row">
                    <div id="modal-title" class="modal-title-text"></div>
                    <div id="modal-price" class="modal-price-text"></div>
                </div>
                <div id="modal-brokers" class="modal-broker-pill"></div>
                <div id="modal-specs"></div>
                <div id="modal-desc" style="line-height:1.7; color:#cbd5e1; white-space:pre-wrap; margin-bottom: 2rem; font-size:0.95rem;"></div>
                <div style="display:flex; gap:15px; flex-wrap:wrap;">
                    <a href="#" id="modal-link" target="_blank" class="prop-btn" style="flex:1; min-width:180px;">Voir fiche officielle →</a>
                    <a href="mailto:info@evanpatruno.ca" id="modal-contact" class="prop-btn" style="background:#d4af37; color:#000 !important; flex:1; min-width:180px;">Planifier une visite</a>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
(function() {{
    const CLOUD_URL = "{cloud_url}";
    // Bin public JSONBin (aucune clé exposée côté client)
    let props = [];
    let currentPhotos = [];
    let photoIdx = 0;

    function formatMoney(val) {{
        if (!val) return '';
        const cleaned = String(val).replace(/[^0-9]/g, '');
        if (!cleaned) return String(val);
        const num = parseInt(cleaned, 10);
        return num.toLocaleString('fr-CA') + ' $';
    }}

    function parseMoney(val) {{
        if (!val) return 0;
        const cleaned = String(val).replace(/[^0-9]/g, '');
        return cleaned ? parseInt(cleaned, 10) : 0;
    }}

    function renderModalSpecs(specs) {{
        if (!specs || Object.keys(specs).length === 0) {{
            return '<div style="opacity:0.5;font-style:italic;padding:15px 0;">Aucune caractéristique technique enregistrée.</div>';
        }}

        const bldType = specs["Type de bâtiment"] || specs["Genre de propriété"] || "";
        const units = specs["Nombre d'unités au total"] ? specs["Nombre d'unités au total"] + " unité(s)" : (specs["Nombre de chambres"] ? specs["Nombre de chambres"] + " ch." : "");
        const year = specs["Année de construction"] || "";
        const landSize = specs["Superficie du terrain"] || specs["Aire au sol"] || specs["Superficie habitable"] || "";
        const zoning = specs["Zonage"] || specs["Type de commerce/Industrie"] || "";

        const taxMuniRaw = specs["Taxes municipales"] || "";
        const taxScolRaw = specs["Taxes scolaires"] || "";
        const evalTerrainRaw = specs["Évaluation municipale du terrain"] || "";
        const evalBatimentRaw = specs["Évaluation municipale du bâtiment"] || "";
        const evalYear = specs["Année d'évaluation"] || "";

        const taxMuniNum = parseMoney(taxMuniRaw);
        const taxScolNum = parseMoney(taxScolRaw);
        const totalTaxNum = taxMuniNum + taxScolNum;

        const evalTerrainNum = parseMoney(evalTerrainRaw);
        const evalBatimentNum = parseMoney(evalBatimentRaw);
        const totalEvalNum = evalTerrainNum + evalBatimentNum;

        const hasFinancials = taxMuniNum > 0 || taxScolNum > 0 || totalEvalNum > 0;

        const rawCommerce = specs["Genre de commerce"] || "";
        const commerceTags = rawCommerce ? rawCommerce.split(',').map(s => s.trim()).filter(Boolean) : [];

        const rawParticularites = specs["Particularités"] || "";
        const particulariteTags = rawParticularites ? rawParticularites.split(',').map(s => s.trim()).filter(Boolean) : [];

        const rawProximite = specs["Proximité"] || "";
        const proximiteTags = rawProximite ? rawProximite.split(',').map(s => s.trim()).filter(Boolean) : [];

        const eau = specs["Approvisionnement en eau"] || "";
        const egouts = specs["Système d'égouts"] || "";
        const chauffage = specs["Énergie pour le chauffage"] || specs["Mode de chauffage"] || "";
        const stationnement = specs["Stationnement (total)"] || specs["Garage"] || "";

        const handledKeys = [
            "Type de bâtiment", "Genre de propriété", "Nombre d'unités au total", "Nombre d'étages",
            "Année de construction", "Superficie du terrain", "Aire au sol", "Superficie habitable", "Zonage", "Type de commerce/Industrie",
            "Taxes municipales", "Taxes scolaires", "Évaluation municipale du terrain", "Évaluation municipale du bâtiment", "Année d'évaluation", "Reprise de finance",
            "Genre de commerce", "Particularités", "Proximité", "Approvisionnement en eau", "Système d'égouts", "Énergie pour le chauffage", "Mode de chauffage",
            "Stationnement (total)", "Garage", "Nombre de chambres", "Nombre de pièces", "Nombre de salles de bain"
        ];

        const otherSpecs = Object.entries(specs).filter(([k, v]) => !handledKeys.includes(k) && !k.includes('Pièces') && !k.includes('Dimensions'));

        let html = '';

        html += '<div class="specs-hero-grid">';
        if (bldType || units) {{
            html += `<div class="spec-hero-card">
                <span class="hero-card-icon">🏢</span>
                <div class="hero-card-info">
                    <span class="hero-card-label">Bâtiment / Unités</span>
                    <strong class="hero-card-val">${{bldType}}${{units ? ' • ' + units : ''}}</strong>
                </div>
            </div>`;
        }}
        if (year) {{
            html += `<div class="spec-hero-card">
                <span class="hero-card-icon">📅</span>
                <div class="hero-card-info">
                    <span class="hero-card-label">Année de construction</span>
                    <strong class="hero-card-val">${{year}}</strong>
                </div>
            </div>`;
        }}
        if (landSize) {{
            html += `<div class="spec-hero-card">
                <span class="hero-card-icon">📐</span>
                <div class="hero-card-info">
                    <span class="hero-card-label">Superficie du terrain</span>
                    <strong class="hero-card-val">${{landSize}}</strong>
                </div>
            </div>`;
        }}
        if (zoning) {{
            html += `<div class="spec-hero-card">
                <span class="hero-card-icon">🏷️</span>
                <div class="hero-card-info">
                    <span class="hero-card-label">Zonage & Usage</span>
                    <strong class="hero-card-val">${{zoning}}</strong>
                </div>
            </div>`;
        }}
        html += '</div>';

        if (hasFinancials) {{
            html += `
            <div class="specs-financial-block">
                <div class="financial-header">
                    <span class="fin-title">📊 Sommaire Financier & Évaluation</span>
                    ${{evalYear ? `<span class="fin-year-badge">Rôle ${{evalYear}}</span>` : ''}}
                </div>
                <div class="financial-grid">
                    <div class="fin-col">
                        <div class="fin-subhead">Taxes Annuelles</div>
                        ${{taxMuniNum ? `<div class="fin-row"><span>Taxes municipales :</span><strong>${{formatMoney(taxMuniNum)}}</strong></div>` : ''}}
                        ${{taxScolNum ? `<div class="fin-row"><span>Taxe scolaire :</span><strong>${{formatMoney(taxScolNum)}}</strong></div>` : ''}}
                        ${{totalTaxNum ? `<div class="fin-row fin-total"><span>Total taxes :</span><strong class="tax-total-badge">${{formatMoney(totalTaxNum)}} / an</strong></div>` : ''}}
                    </div>
                    <div class="fin-col">
                        <div class="fin-subhead">Évaluation Municipale</div>
                        ${{evalTerrainNum ? `<div class="fin-row"><span>Terrain :</span><strong>${{formatMoney(evalTerrainNum)}}</strong></div>` : ''}}
                        ${{evalBatimentNum ? `<div class="fin-row"><span>Bâtiment :</span><strong>${{formatMoney(evalBatimentNum)}}</strong></div>` : ''}}
                        ${{totalEvalNum ? `<div class="fin-row fin-total"><span>Évaluation totale :</span><strong class="eval-total-badge">${{formatMoney(totalEvalNum)}}</strong></div>` : ''}}
                    </div>
                </div>
            </div>`;
        }}

        if (commerceTags.length > 0) {{
            html += `
            <div class="specs-tags-block">
                <div class="tags-title">💼 Activités & Vocation Commerciale</div>
                <div class="tags-list">
                    ${{commerceTags.map(t => `<span class="spec-tag commerce-tag">${{t}}</span>`).join('')}}
                </div>
            </div>`;
        }}

        if (particulariteTags.length > 0 || proximiteTags.length > 0) {{
            html += `<div class="specs-highlights-grid">`;
            if (particulariteTags.length > 0) {{
                html += `
                <div class="highlight-box">
                    <div class="box-title">🌊 Atouts & Particularités</div>
                    <div class="tags-list">
                        ${{particulariteTags.map(t => `<span class="spec-tag feature-tag">${{t}}</span>`).join('')}}
                    </div>
                </div>`;
            }}
            if (proximiteTags.length > 0) {{
                html += `
                <div class="highlight-box">
                    <div class="box-title">📍 Proximité & Loisirs</div>
                    <div class="tags-list">
                        ${{proximiteTags.map(t => `<span class="spec-tag location-tag">${{t}}</span>`).join('')}}
                    </div>
                </div>`;
            }}
            html += `</div>`;
        }}

        if (eau || egouts || chauffage || stationnement) {{
            html += `
            <div class="specs-infra-block">
                <div class="infra-title">🛠️ Services & Infrastructures</div>
                <div class="infra-grid">
                    ${{eau ? `<div class="infra-item"><span class="infra-k">Approvisionnement en eau :</span><strong class="infra-v">${{eau}}</strong></div>` : ''}}
                    ${{egouts ? `<div class="infra-item"><span class="infra-k">Système d'égouts :</span><strong class="infra-v">${{egouts}}</strong></div>` : ''}}
                    ${{chauffage ? `<div class="infra-item"><span class="infra-k">Chauffage & Énergie :</span><strong class="infra-v">${{chauffage}}</strong></div>` : ''}}
                    ${{stationnement ? `<div class="infra-item"><span class="infra-k">Stationnement / Garage :</span><strong class="infra-v">${{stationnement}}</strong></div>` : ''}}
                </div>
            </div>`;
        }}

        if (otherSpecs.length > 0) {{
            html += `
            <div class="specs-others-block">
                <div class="others-title">📋 Autres Caractéristiques</div>
                <div class="others-grid">
                    ${{otherSpecs.map(([k, v]) => `
                        <div class="other-item">
                            <span class="other-k">${{k}}</span>
                            <strong class="other-v">${{v}}</strong>
                        </div>
                    `).join('')}}
                </div>
            </div>`;
        }}

        return html;
    }}

    async function init() {{
        try {{
            const res = await fetch(CLOUD_URL);
            const data = await res.json();
            props = data.record;
            props.sort((a, b) => (a.isSold === b.isSold) ? 0 : a.isSold ? 1 : -1);
            render(props);
        }} catch (e) {{ console.error(e); document.getElementById('prop-grid-target').innerHTML = "Erreur de chargement."; }}
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
        let bNames = p.brokers || "Evan Patruno";
        if (bNames.split(',').length > 3) {{
            bNames = bNames.split(',')[0].trim();
        }}
        document.getElementById('modal-brokers').innerHTML = `<span style="opacity:0.6;font-size:0.8rem;text-transform:uppercase;">Courtier(s) Inscription :</span><strong style="color:#fff;margin-left:6px;">${{bNames}}</strong>`;
        document.getElementById('modal-desc').textContent = p.description;
        document.getElementById('modal-link').href = p.url;
        
        const contactBtn = document.getElementById('modal-contact');
        if (contactBtn) {{
            const subject = encodeURIComponent(`Demande de visite : ${{p.city}} (MLS #${{p.mls}})`);
            const body = encodeURIComponent(`Bonjour Evan,\n\nJe suis intéressé par la propriété située à ${{p.city}} (MLS #${{p.mls}}).\n\nPourriez-vous me recontacter pour planifier une visite ou me donner plus d'informations ?\n\nMerci !`);
            contactBtn.href = `mailto:info@evanpatruno.ca?subject=${{subject}}&body=${{body}}`;
        }}

        document.getElementById('modal-specs').innerHTML = renderModalSpecs(p.specs);
        
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

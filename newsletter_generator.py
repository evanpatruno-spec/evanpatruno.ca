# -*- coding: utf-8 -*-
import requests
import json
import os
import re
import html
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

# CONFIGURATION
API_KEY = os.getenv("JSONBIN_API_KEY", "$2a$10$qH2mqKg0/uXrs6l8qpQZRO/9kH1FUMjgmAiElTwDvlE..n3DhG08C")
NEWS_BIN_ID = "69e6d40c856a6821895644dc"
BOC_BIN_ID = "69e6d40f856a6821895644ed"
BIN_ID_FILE = "newsletter_bin_id.txt"
HARDCODED_NEWSLETTER_BIN_ID = ""  # Sera lu depuis newsletter_bin_id.txt

EXPERT_FALLBACKS = [
    {
        "title": "5 astuces pour augmenter la valeur de votre maison",
        "summary": "Petites rénovations, grand impact. Découvrez comment maximiser votre prix de vente avec des changements mineurs mais stratégiques.",
        "description": "Petites rénovations, grand impact. Découvrez comment maximiser votre prix de vente avec des changements mineurs mais stratégiques.",
        "link": "https://www.evanpatruno.ca/vendre",
        "source": "Conseil d'expert"
    },
    {
        "title": "Acheter ou Louer en 2026 : Le match comparatif",
        "summary": "Avec l'évolution des taux, est-il toujours avantageux d'acheter ? Nous décortiquons les chiffres pour vous aider à décider.",
        "description": "Avec l'évolution des taux, est-il toujours avantageux d'acheter ? Nous décortiquons les chiffres pour vous aider à décider.",
        "link": "https://www.evanpatruno.ca/acheter",
        "source": "Conseil d'expert"
    },
    {
        "title": "Comprendre la taxe de bienvenue (Droits de mutation)",
        "summary": "Saviez-vous que le calcul change selon la ville ? Évitez les surprises lors de votre passage chez le notaire.",
        "description": "Saviez-vous que le calcul change selon la ville ? Évitez les surprises lors de votre passage chez le notaire.",
        "link": "https://www.evanpatruno.ca/outils",
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

# BANQUE DES 12 ASTUCES D'OR (Une par mois / Haute Qualité)
PRO_TIPS = [
    "Optimisation Fiscale : Les intérêts sur un prêt pour investissement locatif sont généralement déductibles d'impôts. Consultez votre comptable pour maximiser ce levier.",
    "Taux Fixe vs Variable : Dans un marché en évolution, le taux variable offre souvent plus de flexibilité pour refinancer avec une pénalité réduite si les taux baissent.",
    "Inspection Préachat : Ne négligez jamais l'état de la fondation et du drain français. Une fissure mineure peut cacher un problème coûteux : soyez vigilant !",
    "Capacité d'Achat : Le test de résistance (stress test) protège votre budget. Calculez vos versements avec une marge de sécurité pour préserver votre tranquillité d'esprit.",
    "Rénovations Payantes : La cuisine, la salle de bain et la luminosité offrent le meilleur retour sur investissement lors de la revente. Priorisez ces éléments.",
    "Copropriété : Examinez attentivement le carnet d'entretien, l'étude du fonds de prévoyance (Loi 16) et les procès-verbaux des 3 dernières années avant d'acheter.",
    "Assurance Hypothécaire : Comparez toujours l'assurance prêt de l'institution prêteuse avec une assurance vie et invalidité individuelle : vous pourriez économiser gros.",
    "Mise de Fonds : Combinez le CELIAPP et le RAP (Régime d'accession à la propriété) pour maximiser votre mise de fonds libre d'impôt lors d'un premier achat.",
    "Multi-Logements : Le ratio de couverture de la dette est déterminant. Visez des revenus locatifs qui soutiennent solidement les charges d'exploitation et le financement.",
    "Stratégie d'Offre : Le prix n'est pas le seul levier. La date d'occupation, les inclusions et la solidité de votre préqualification hypothécaire font souvent la différence.",
    "Évaluation Municipale : L'évaluation foncière reflète le marché d'il y a 18 à 24 mois. Fiez-vous toujours à une analyse comparative de marché (ACM) récente sur Centris.",
    "Crédit d'Impôt : N'oubliez pas le crédit d'impôt pour l'achat d'une première habitation (CIAPH), qui permet de récupérer jusqu'à 3 000 $ combinés (fédéral et Québec)."
]


def truncate_clean(text, max_len=240):
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len]
    last_period = max(cut.rfind('. '), cut.rfind('! '), cut.rfind('? '))
    if last_period > max_len * 0.55:
        return cut[:last_period + 1].strip()
    last_space = cut.rfind(' ')
    if last_space > 0:
        return cut[:last_space].rstrip(',;:-–—') + "…"
    return cut + "…"


def sanitize_article(item):
    """Nettoie le titre, la source et le résumé d'un article."""
    title = html.unescape(item.get('title', 'Titre non disponible')).strip()
    source = html.unescape(item.get('source', 'Actualités Immobilier')).strip()
    desc = html.unescape(item.get('description', item.get('summary', ''))).strip()

    # Si Google News a laissé " - Source" à la fin du titre
    if " - " in title:
        parts = title.rsplit(" - ", 1)
        if 1 < len(parts[1].strip()) <= 40:
            if source in ("news.google.com", "Google News", "Source inconnue") or re.match(r'^\d+\s+\w+$', source):
                source = parts[1].strip()
            title = parts[0].strip()

    if source in ("news.google.com", "Google News"):
        source = "Actualités Québec"

    # Retirer les pieds de page WordPress (ex: APCIQ)
    desc = re.sub(r"L[’']article\s+.*?est apparu en premier sur.*$", "", desc, flags=re.IGNORECASE | re.DOTALL).strip()
    desc = re.sub(r"Cet article\s+.*?est apparu en premier sur.*$", "", desc, flags=re.IGNORECASE | re.DOTALL).strip()
    desc = re.sub(r"The post\s+.*?appeared first on.*$", "", desc, flags=re.IGNORECASE | re.DOTALL).strip()

    # Si le résumé répète simplement le titre, créer un résumé propre
    norm_t = re.sub(r'\W+', '', title.lower())
    norm_d = re.sub(r'\W+', '', desc.lower())
    if not desc or norm_d.startswith(norm_t) or norm_t in norm_d:
        if any(k in title.lower() for k in ["taux", "banque du canada", "hypothèque", "hypothécaire"]):
            desc = f"Analyse publiée par {source} sur l'évolution des taux d'intérêt et des conditions de financement hypothécaire au Canada."
        else:
            desc = f"Revue d'actualité immobilière publiée par {source} portant sur les tendances récentes du marché résidentiel québécois."
    else:
        desc = truncate_clean(desc, 260)

    return {
        "title": title,
        "summary": desc,
        "description": desc,
        "link": item.get('link', 'https://www.evanpatruno.ca/rapports'),
        "source": source,
        "category": item.get('category', 'general')
    }


def select_top_news(news_list, count=3):
    """Sélectionne les 3 articles les plus pertinents et variés."""
    high_priority = ["immobilier", "hypothèque", "hypothécaire", "centris", "apciq", "rmr de montréal", "propriété"]
    standard_priority = ["taux", "prix", "médian", "marché", "schl", "banque du canada", "maison", "condo", "acheteur", "vendeur"]
    trusted_sources = ["APCIQ", "Blogue Centris", "La Presse", "Les Affaires", "Le Devoir", "Radio-Canada", "Protégez-Vous", "TVA Nouvelles"]
    blocked_domains = ["tmgm.com", "vietnam.vn", "fxstreet", "dailyfx", "litefinance", "zonebourse"]

    scored_news = []
    seen_titles = set()

    for raw_item in news_list:
        raw_check = f"{raw_item.get('title', '')} {raw_item.get('source', '')} {raw_item.get('link', '')}".lower()
        if any(b in raw_check for b in blocked_domains):
            continue

        item = sanitize_article(raw_item)
        norm_title = re.sub(r'\W+', '', item['title'].lower())[:50]
        if norm_title in seen_titles:
            continue
        seen_titles.add(norm_title)

        score = 0
        text = (item['title'] + " " + item['summary']).lower()

        for kw in high_priority:
            if kw in text:
                score += 5
        for kw in standard_priority:
            if kw in text:
                score += 2
        if any(ts.lower() in item['source'].lower() for ts in trusted_sources):
            score += 4
        if item.get('category') == 'local':
            score += 3

        scored_news.append((score, item))

    scored_news.sort(key=lambda x: x[0], reverse=True)

    # Éviter d'avoir 3 articles provenant exactement de la même source si possible
    selected = []
    source_counts = {}
    for score, item in scored_news:
        src = item['source']
        if source_counts.get(src, 0) >= 2 and len(scored_news) > count:
            continue
        selected.append(item)
        source_counts[src] = source_counts.get(src, 0) + 1
        if len(selected) >= count:
            break

    if len(selected) < count:
        for fallback in EXPERT_FALLBACKS:
            if len(selected) >= count:
                break
            selected.append(fallback)

    return selected


def fetch_unified_data():
    """Récupère les nouvelles et le taux BOC depuis le fichier local ou JSONBin."""
    headers = {'X-Master-Key': API_KEY}
    try:
        if os.path.exists('news.json'):
            with open('news.json', 'r', encoding='utf-8') as f:
                record = json.load(f)
                if isinstance(record, list):
                    return {"news": record, "boc_rate": "2.25%"}
                return record

        url = f"https://api.jsonbin.io/v3/b/{NEWS_BIN_ID}/latest"
        res = requests.get(url, headers=headers, timeout=15)
        record = res.json().get('record', {})
        if isinstance(record, list):
            return {"news": record, "boc_rate": "2.25%"}
        return record
    except Exception as e:
        print(f"Erreur Lecture Données : {e}")
        return {"news": [], "boc_rate": "2.25%"}


def resolve_latest_report_period(now):
    """
    Détermine le mois et l'année du rapport mensuel.
    Le rapport mensuel porte toujours sur le dernier mois complet écoulé (M-1).
    Si ce PDF n'existe pas localement mais que rapports/index.json existe,
    utilise le rapport le plus récent présent dans index.json pour éviter tout 404.
    """
    report_month = now.month - 1
    report_year = now.year
    if report_month == 0:
        report_month = 12
        report_year -= 1

    target_id = f"{report_year}-{report_month:02d}"
    target_pdf_path = os.path.join("rapports", f"{target_id}.pdf")

    if not os.path.exists(target_pdf_path) and os.path.exists(os.path.join("rapports", "index.json")):
        try:
            with open(os.path.join("rapports", "index.json"), "r", encoding="utf-8") as f:
                idx = json.load(f)
            if idx and isinstance(idx, list) and "id" in idx[0]:
                latest_id = idx[0]["id"]  # ex: "2026-09"
                y_str, m_str = latest_id.split("-")
                return int(m_str), int(y_str)
        except Exception:
            pass

    return report_month, report_year


def deep_clean(obj):
    if isinstance(obj, str):
        s = html.unescape(obj).strip()
        return s.encode('utf-8', 'ignore').decode('utf-8')
    elif isinstance(obj, dict):
        return {k: deep_clean(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [deep_clean(i) for i in obj]
    return obj


def generate_newsletter_json(force_zoho=False, notify=False):
    # Si on est en mode approbation (--force) et que newsletter_ready.json existe déjà,
    # on publie exactement la version qui a été prévisualisée et approuvée par Evan !
    if force_zoho and not notify and os.path.exists('newsletter_ready.json'):
        try:
            with open('newsletter_ready.json', 'r', encoding='utf-8') as f:
                approved_data = deep_clean(json.load(f))
            approved_data["status"] = "approved"
            with open('newsletter_ready.json', 'w', encoding='utf-8') as f:
                json.dump(approved_data, f, indent=2, ensure_ascii=False)
            bin_id = update_jsonbin(approved_data)
            print(f"Newsletter approuvée synchronisée sur JSONBin (Bin ID: {bin_id})")
            trigger_zoho_webhook(approved_data)
            return approved_data
        except Exception as e:
            print(f"Avertissement lecture newsletter_ready.json ({e}), régénération...")

    now = datetime.now()
    data = fetch_unified_data()
    all_news = data.get('news', [])
    boc_rate = str(data.get('boc_rate', '2.25%'))
    if not boc_rate.endswith('%'):
        boc_rate = f"{boc_rate}%"

    top_news = select_top_news(all_news, count=3)

    # Calcul du Thermomètre (harmonisé avec report_generator.py et les stats Centris)
    try:
        rate_val = float(boc_rate.replace('%', '').strip())
    except ValueError:
        rate_val = 2.25

    if rate_val < 3.5:
        market_temp = "Marché Actif (Vendeurs)"
    elif rate_val < 4.5:
        market_temp = "Marché Équilibré"
    else:
        market_temp = "Marché Prudent (Acheteurs)"

    # Liens personnalisés
    booking_url = "https://calendar.app.google/a37T5exmNpFfBZ6SA"
    facebook_url = "https://www.facebook.com/evanpatrunocourtier/"
    instagram_url = "https://www.instagram.com/evanpatruno.immo/?hl=fr"
    linkedin_url = "https://www.linkedin.com/in/evan-patruno/"

    months_fr = {
        "1": "Janvier", "2": "Février", "3": "Mars", "4": "Avril",
        "5": "Mai", "6": "Juin", "7": "Juillet", "8": "Août",
        "9": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre"
    }

    report_month, report_year = resolve_latest_report_period(now)
    month_name = months_fr[str(report_month)]
    year = report_year

    # Sélection déterministe par mois pour que l'aperçu et la publication soient toujours cohérents
    daily_quote = CITATIONS[(report_month - 1) % len(CITATIONS)]
    pro_tip = PRO_TIPS[(report_month - 1) % len(PRO_TIPS)]

    # Lien vers le rapport PDF généré sur Vercel via le sous-domaine
    report_filename = f"{report_year}-{report_month:02d}.pdf"
    report_url = f"https://dossier.evanpatruno.ca/rapports/{report_filename}"

    newsletter_data = {
        "Sujet": f"Infolettre - {month_name} {year}",
        "Mois": month_name,
        "Annee": str(year),
        "Taux_BOC": boc_rate,
        "Contenu_Article": "\n\n".join([f"{a.get('title', '')} : {a.get('summary', '')}" for a in top_news]),
        "Citation": daily_quote,
        "Astuce_Pro": pro_tip,
        "Lien_Rapport": report_url,
        "campaign_id": f"NL-{report_month:02d}-{year}",
        "month": month_name,
        "year": year,
        "boc_rate": boc_rate,
        "boc_rate_val": rate_val,
        "market_temp": market_temp,
        "market_status": market_temp,
        "status": "pending_approval" if not force_zoho else "approved",
        "booking_url": booking_url,
        "facebook_url": facebook_url,
        "instagram_url": instagram_url,
        "linkedin_url": linkedin_url,
        "top_articles": [
            {
                "title": item.get('title', 'Titre non disponible'),
                "summary": item.get('summary', ''),
                "link": item.get('link', 'https://www.evanpatruno.ca/rapports'),
                "source": item.get('source', 'Actualités Immobilier')
            } for item in top_news
        ],
        "report_label": f"Rapport de Marché - {month_name} {year}",
        "expert_note": "Le marché s'équilibre graduellement. C'est le moment idéal pour réévaluer votre capacité de financement ou la valeur marchande de votre propriété.",
        "footer_msg": "Besoin d'une évaluation précise de votre propriété ?",
        "quick_links": [
            {"label": "Calculatrice Hypothécaire", "url": "https://www.evanpatruno.ca/outils"},
            {"label": "Évaluation Gratuite", "url": "https://www.evanpatruno.ca/vendre"}
        ]
    }

    newsletter_data["articles"] = newsletter_data["top_articles"]
    newsletter_data["news_list"] = newsletter_data["top_articles"]

    final_data = deep_clean(newsletter_data)

    # Sauvegarde locale
    with open('newsletter_ready.json', 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    # Upload au cloud (JSONBin)
    bin_id = update_jsonbin(final_data)
    print(f"Newsletter JSON générée sur le Cloud ! Bin ID: {bin_id}")

    # Toujours mettre à jour newsletter_preview.html pour que l'aperçu soit prêt
    try:
        env = Environment(loader=FileSystemLoader('.'))
        template = env.get_template('newsletter_preview_template.html')
        context = {
            "month": final_data["month"],
            "year": final_data["year"],
            "boc_rate": final_data["boc_rate"],
            "market_status": final_data["market_status"],
            "top_articles": final_data["top_articles"],
            "pro_tip": final_data["Astuce_Pro"],
            "report_url": final_data["Lien_Rapport"],
            "report_label": final_data["report_label"]
        }
        preview_html = template.render(context)
        with open('newsletter_preview.html', 'w', encoding='utf-8') as f:
            f.write(preview_html)
        print("Aperçu HTML généré : newsletter_preview.html")
    except Exception as e:
        print(f"Erreur rendu aperçu HTML : {e}")

    # IMPORTANT : On n'appelle le webhook Zoho CRM/Campaigns QUE lors de l'approbation explicite (--force)
    # L'envoi du courriel d'aperçu à Evan lors de --notify est géré par GitHub Actions / send_preview_email.py
    if force_zoho:
        trigger_zoho_webhook(final_data)

    return final_data


def trigger_zoho_webhook(data):
    webhook_url = os.getenv("ZOHO_WEBHOOK_URL")
    if not webhook_url:
        print("[Attention] ZOHO_WEBHOOK_URL non configuré. Notification Zoho annulée.")
        return

    print("Envoi du signal de validation au Zoho CRM...")
    try:
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
        with open(BIN_ID_FILE, 'r', encoding='utf-8') as f:
            bin_id = f.read().strip()

    if bin_id:
        url = f"https://api.jsonbin.io/v3/b/{bin_id}"
        requests.put(url, json=data, headers=headers, timeout=15)
    else:
        url = "https://api.jsonbin.io/v3/b"
        res = requests.post(url, json=data, headers=headers, timeout=15)
        if res.status_code == 200:
            bin_id = res.json()['metadata']['id']
            with open(BIN_ID_FILE, 'w', encoding='utf-8') as f:
                f.write(bin_id)

    return bin_id


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    notify = "--notify" in sys.argv
    generate_newsletter_json(force_zoho=force, notify=notify)

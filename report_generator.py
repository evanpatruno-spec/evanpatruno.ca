# -*- coding: utf-8 -*-
import json
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

def generate_evan_message(data):
    """Génère un message contextuel basé sur les données réelles du mois."""
    boc_rate = float(data.get('boc_rate', '4.5').replace('%', ''))
    boc_status = data.get('boc_status', 'maintenu').lower()
    
    # Marché moyen par région
    stats = data.get('market_stats', {})
    avg_trend = 0
    trends_count = 0
    for r, s in stats.items():
        if isinstance(s, dict) and 'trend' in s:
            try:
                val = int(s['trend'].replace('%', '').replace('+', ''))
                avg_trend += val
                trends_count += 1
            except: pass
    
    avg_trend = avg_trend / trends_count if trends_count > 0 else 0
    
    current_month = datetime.now().month
    
    # LOGIQUE DE DÉCISION DU MESSAGE
    if "baiss" in boc_status or "diminu" in boc_status:
        return "Bonne nouvelle ! La baisse du taux directeur par la Banque du Canada ouvre une porte d'opportunité. C'est le moment idéal pour sécuriser un taux avantageux avant que la hausse de la demande ne fasse grimper les prix encore plus vite. Votre pouvoir d'achat vient de faire un bond."
    
    if avg_trend > 8:
        return f"Le marché s'échauffe avec une hausse moyenne des prix de {avg_trend:.0f}% ce mois-ci. Si vous envisagez de vendre, les conditions sont optimales. Pour les acheteurs, la rapidité et une pré-approbation solide sont vos meilleurs atouts dans ce contexte de forte demande."

    if current_month in [3, 4, 5]: # Printemps
        return "Le marché printanier est officiellement là. C'est la période la plus active de l'année. Les nouvelles inscriptions augmentent, offrant plus de choix, mais la compétition reste forte. Une stratégie d'achat bien rodée est indispensable pour ne pas passer à côté de votre coup de cœur."

    if boc_rate > 4.5:
        return "Malgré des taux qui restent élevés, le marché démontre une résilience impressionnante. La stabilité est le mot d'ordre ce mois-ci. C'est un excellent moment pour une analyse comparative rigoureuse : acheter maintenant avec un taux variable pourrait s'avérer très lucratif lors du prochain cycle de baisses."

    return "Le marché immobilier actuel demande de la précision. Entre les variations de taux et l'ajustement des prix, chaque projet est unique. Que vous soyez en phase de réflexion ou prêt à passer à l'action, je suis là pour décoder ces chiffres avec vous et transformer ces données en stratégie gagnante."

def main():
    print("Démarrage de la génération du rapport...")
    
    # 1. Charger les données
    try:
        if os.path.exists('news.json'):
            with open('news.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            print("Erreur: news.json introuvable.")
            return
    except Exception as e:
        print(f"Erreur chargement news.json: {e}")
        return

    # 2. Préparer les variables pour le template
    now = datetime.now()
    months_fr = {
        1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
        7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
    }
    
    # Extraire status BoC
    boc_status = "Maintenu"
    boc_raw_status = data.get('boc_status', 'maintenu').lower()
    if 'baiss' in boc_raw_status or 'diminu' in boc_raw_status: boc_status = "En baisse"
    elif 'augment' in boc_raw_status or 'hausse' in boc_raw_status: boc_status = "En hausse"

    # Calcul largeur thermomètre (simulé sur taux)
    rate_val = float(data.get('boc_rate', '4.5').replace('%', ''))
    temp_width = max(10, min(90, (rate_val / 6) * 100)) 
    
    market_temp = "Marché Équilibré"
    if rate_val < 3.5: market_temp = "Marché Actif (Vendeurs)"
    elif rate_val > 5.0: market_temp = "Marché Calme (Acheteurs)"

    context = {
        "month_name": months_fr[now.month],
        "year": now.year,
        "boc_rate": data.get('boc_rate', '4.50%'),
        "boc_status": boc_status,
        "boc_date": data.get('last_update', now.strftime('%Y-%m-%d')).split(' ')[0],
        "boc_next": "Voir calendrier économique",
        "market_temp": market_temp,
        "temp_width": temp_width,
        "message_evan": generate_evan_message(data),
        "market_stats": data.get('market_stats', {}),
        "news": data.get('news', [])
    }

    # 3. Rendu Jinja2
    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template('report_template.html')
    output_html = template.render(context)

    # 4. Sauvegarder
    output_dir = 'rapports'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    filename = now.strftime('%Y-%m.html')
    filepath = os.path.join(output_dir, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(output_html)
        
    # Mettre à jour l'index JSON des rapports
    index_path = os.path.join(output_dir, 'index.json')
    index_data = []
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            index_data = json.load(f)
            
    # Ajouter le nouveau rapport s'il n'existe pas
    report_entry = {
        "id": now.strftime('%Y-%m'),
        "title": f"Rapport de Marché - {months_fr[now.month]} {now.year}",
        "date": now.strftime('%Y-%m-%d'),
        "pdf": f"{now.strftime('%Y-%m')}.pdf",
        "url": f"/rapports/{now.strftime('%Y-%m')}"
    }
    
    # Éviter les doublons
    index_data = [r for r in index_data if r['id'] != report_entry['id']]
    index_data.insert(0, report_entry)
    
    # Garder seulement les 12 derniers
    index_data = index_data[:12]
    
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)

    print(f"Succès: HTML du rapport généré dans {filepath}")

if __name__ == "__main__":
    main()

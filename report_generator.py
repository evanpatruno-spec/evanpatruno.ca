# -*- coding: utf-8 -*-
import json
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

HISTORICAL_DATA = {
    "2026-01": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "2026-01-28",
        "boc_next": "18 mars 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 75,
        "message_evan": "L'année 2026 démarre sous le signe de la stabilité. Les taux restent à 2.25%, ce qui redonne confiance aux acheteurs. C'est le moment d'établir votre stratégie d'achat avant le pic printanier.",
        "market_stats": {
            "montreal": {
                "price": "625 000", "trend": "+3%",
                "condo_price": "415 000", "condo_trend": "+1%",
                "sales": "2 850", "sales_trend": "+2%",
                "new_listings": "4 100", "active_listings": "16 500",
                "days": "58", "condition": "Vendeurs"
            },
            "laval": {
                "price": "615 000", "trend": "+2%",
                "condo_price": "390 000", "condo_trend": "+2%",
                "sales": "580", "sales_trend": "+4%",
                "new_listings": "820", "active_listings": "2 900",
                "days": "54", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "560 000", "trend": "+4%",
                "condo_price": "375 000", "condo_trend": "+3%",
                "sales": "1 150", "sales_trend": "+5%",
                "new_listings": "1 600", "active_listings": "6 100",
                "days": "50", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "495 000", "trend": "+3%",
                "condo_price": "350 000", "condo_trend": "+2%",
                "sales": "980", "sales_trend": "+3%",
                "new_listings": "1 450", "active_listings": "5 500",
                "days": "47", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "La Presse",
                "title": "Immobilier : un début d'année dynamique pour les acheteurs au Québec",
                "description": "Les courtiers immobiliers constatent un retour progressif des acheteurs sur le marché dès les premières semaines de janvier, stimulés par la stabilisation des taux d'intérêt."
            },
            {
                "source": "Les Affaires",
                "title": "Taux d'intérêt : la Banque du Canada maintient le cap pour commencer 2026",
                "description": "Lors de sa première annonce de l'année, la banque centrale a maintenu son taux directeur à 2,25%, confirmant une accalmie après le cycle de resserrement."
            },
            {
                "source": "Le Devoir",
                "title": "Crise du logement : Montréal cherche des solutions pour accélérer les chantiers",
                "description": "La Ville de Montréal étudie de nouvelles mesures réglementaires pour faciliter l'octroi de permis de construction résidentielle face à la pénurie."
            },
            {
                "source": "Blogue Centris",
                "title": "Quelles sont les grandes tendances du marché immobilier pour 2026 ?",
                "description": "Analyse des perspectives du marché québécois pour l'année qui commence : entre stabilisation des prix et légère hausse de l'inventaire."
            }
        ]
    },
    "2026-02": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "2026-01-28",
        "boc_next": "18 mars 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 75,
        "message_evan": "Le mois de février montre une reprise graduelle des inscriptions. Les conditions restent à l'avantage des vendeurs en raison d'un inventaire historiquement bas. La préparation est la clé du succès.",
        "market_stats": {
            "montreal": {
                "price": "625 000", "trend": "+4%",
                "condo_price": "432 000", "condo_trend": "+2%",
                "sales": "3 100", "sales_trend": "+1%",
                "new_listings": "4 400", "active_listings": "17 200",
                "days": "55", "condition": "Vendeurs"
            },
            "laval": {
                "price": "620 000", "trend": "+3%",
                "condo_price": "400 000", "condo_trend": "+3%",
                "sales": "620", "sales_trend": "+3%",
                "new_listings": "890", "active_listings": "3 100",
                "days": "52", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "570 000", "trend": "+5%",
                "condo_price": "385 000", "condo_trend": "+4%",
                "sales": "1 280", "sales_trend": "+6%",
                "new_listings": "1 850", "active_listings": "6 400",
                "days": "48", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "500 000", "trend": "+4%",
                "condo_price": "355 000", "condo_trend": "+3%",
                "sales": "1 050", "sales_trend": "+4%",
                "new_listings": "1 600", "active_listings": "5 800",
                "days": "44", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "La Presse",
                "title": "RMR de Montréal : les prix des propriétés résistent bien en février",
                "description": "Malgré le froid hivernal, les prix médians demeurent stables avec une légère hausse pour les copropriétés qui attirent les premiers acheteurs."
            },
            {
                "source": "Les Affaires",
                "title": "Copropriétés : la demande reste forte pour les condos abordables",
                "description": "Le segment des condos montre une belle activité en ce début d'année, particulièrement dans les secteurs périphériques de Montréal."
            },
            {
                "source": "Le Devoir",
                "title": "Taux hypothécaires : les institutions financières ajustent leurs offres",
                "description": "Les banques canadiennes commencent à proposer des taux fixes plus compétitifs en prévision du marché printanier."
            },
            {
                "source": "APCIQ",
                "title": "Statistiques mensuelles : légère hausse de l'inventaire en RMR",
                "description": "L'offre de propriétés à vendre enregistre une légère hausse, offrant un peu plus de choix aux acheteurs actifs."
            }
        ]
    },
    "2026-03": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "2026-03-18",
        "boc_next": "29 avril 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 75,
        "message_evan": "Le marché printanier démarre officiellement ce mois-ci. Les prix médians augmentent sensiblement à 652 250 $ pour les unifamiliales de Montréal. Soyez prêts à agir avec conviction.",
        "market_stats": {
            "montreal": {
                "price": "652 250", "trend": "+5%",
                "condo_price": "420 000", "condo_trend": "+1%",
                "sales": "3 980", "sales_trend": "-2%",
                "new_listings": "5 900", "active_listings": "18 100",
                "days": "50", "condition": "Vendeurs"
            },
            "laval": {
                "price": "630 000", "trend": "+3%",
                "condo_price": "405 000", "condo_trend": "+2%",
                "sales": "790", "sales_trend": "+2%",
                "new_listings": "1 150", "active_listings": "3 150",
                "days": "47", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "580 000", "trend": "+6%",
                "condo_price": "390 000", "condo_trend": "+3%",
                "sales": "1 620", "sales_trend": "+4%",
                "new_listings": "2 300", "active_listings": "6 600",
                "days": "44", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "510 000", "trend": "+5%",
                "condo_price": "360 000", "condo_trend": "+3%",
                "sales": "1 350", "sales_trend": "+3%",
                "new_listings": "2 050", "active_listings": "5 900",
                "days": "40", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "La Presse",
                "title": "L'activité printanière s'installe sur le marché immobilier",
                "description": "Les visites se multiplient et le nombre de promesses d'achat est en hausse en ce mois de mars, annonçant un printemps dynamique."
            },
            {
                "source": "Les Affaires",
                "title": "La Banque du Canada maintient son taux directeur à 2,25 % en mars",
                "description": "La décision de la banque centrale de maintenir les taux stables rassure le marché de l'habitation à l'aube de la saison forte."
            },
            {
                "source": "Le Devoir",
                "title": "Marché immobilier : hausse notable du prix médian des maisons",
                "description": "L'unifamiliale connaît un regain de croissance des prix dans la RMR de Montréal, portée par la rareté persistante des propriétés."
            },
            {
                "source": "Blogue Centris",
                "title": "Conseils pour vendre votre propriété au printemps 2026",
                "description": "Découvrez nos recommandations pour préparer votre mise en marché et maximiser la valeur de votre transaction immobilière."
            }
        ]
    },
    "2026-04": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "2026-04-29",
        "boc_next": "10 juin 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 75,
        "message_evan": "Avril confirme le dynamisme printanier. Les ventes sont soutenues et les prix médians se stabilisent à des niveaux élevés. Une excellente mise en marché est indispensable pour vous démarquer.",
        "market_stats": {
            "montreal": {
                "price": "645 000", "trend": "+3.2%",
                "condo_price": "425 000", "condo_trend": "+0.2%",
                "sales": "4 744", "sales_trend": "-7%",
                "new_listings": "6 800", "active_listings": "20 959",
                "days": "52", "condition": "Vendeurs"
            },
            "laval": {
                "price": "645 000", "trend": "+4%",
                "condo_price": "410 000", "condo_trend": "+3%",
                "sales": "910", "sales_trend": "+2%",
                "new_listings": "1 250", "active_listings": "3 200",
                "days": "49", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "585 000", "trend": "+8%",
                "condo_price": "395 000", "condo_trend": "+5%",
                "sales": "2 050", "sales_trend": "+3%",
                "new_listings": "2 700", "active_listings": "6 800",
                "days": "45", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "515 000", "trend": "+6%",
                "condo_price": "365 000", "condo_trend": "+4%",
                "sales": "1 780", "sales_trend": "+4%",
                "new_listings": "2 400", "active_listings": "6 100",
                "days": "42", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "La Presse",
                "title": "Marché immobilier d'avril : les inscriptions actives continuent de grimper",
                "description": "L'inventaire de propriétés enregistre une hausse constante, offrant un peu plus d'air aux acheteurs sur le marché montréalais."
            },
            {
                "source": "Les Affaires",
                "title": "Taux d'intérêt : statu quo maintenu par la Banque du Canada fin avril",
                "description": "La Banque du Canada a maintenu son taux directeur à 2,25 % lors de sa réunion du 29 avril, prévoyant une transition stable."
            },
            {
                "source": "Le Devoir",
                "title": "Ralentissement des transactions immobilières au Québec en avril",
                "description": "Les ventes résidentielles affichent un léger repli, mais les prix continuent leur progression tranquille dans la RMR de Montréal."
            },
            {
                "source": "Radio-Canada",
                "title": "Accès à la propriété : la modération s'impose pour l'année 2026",
                "description": "Les experts qualifient l'année de transition, où le rythme de croissance des prix redevient plus gérable pour les acheteurs."
            }
        ]
    },
    "2026-05": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "2026-04-29",
        "boc_next": "10 juin 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 75,
        "message_evan": "Le mois de mai est le pic d'activité de l'année. La sélection est à son maximum, mais les acheteurs sont nombreux. Une analyse rigoureuse des comparables est la clé pour réussir.",
        "market_stats": {
            "montreal": {
                "price": "650 000", "trend": "+4%",
                "condo_price": "430 000", "condo_trend": "+1.5%",
                "sales": "5 100", "sales_trend": "-5%",
                "new_listings": "7 200", "active_listings": "21 500",
                "days": "50", "condition": "Vendeurs"
            },
            "laval": {
                "price": "640 000", "trend": "+3.5%",
                "condo_price": "415 000", "condo_trend": "+2.5%",
                "sales": "980", "sales_trend": "+1%",
                "new_listings": "1 350", "active_listings": "3 300",
                "days": "47", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "590 000", "trend": "+7%",
                "condo_price": "400 000", "condo_trend": "+4.5%",
                "sales": "2 200", "sales_trend": "+2%",
                "new_listings": "2 900", "active_listings": "7 000",
                "days": "43", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "520 000", "trend": "+5.5%",
                "condo_price": "370 000", "condo_trend": "+3.5%",
                "sales": "1 900", "sales_trend": "+3%",
                "new_listings": "2 550", "active_listings": "6 300",
                "days": "39", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "La Presse",
                "title": "Immobilier de mai : forte affluence dans les visites libres",
                "description": "Le mois de mai confirme sa réputation de période charnière de l'année, avec une présence marquée des acheteurs et vendeurs."
            },
            {
                "source": "Les Affaires",
                "title": "Stabilisation financière : le secteur financier canadien jugé résilient",
                "description": "La Banque du Canada souligne la solidité des assises financières du pays dans son dernier rapport sur la stabilité."
            },
            {
                "source": "Le Devoir",
                "title": "Pénurie d'offre résidentielle : l'impact sur les prix se maintient",
                "description": "Bien que l'offre augmente, elle reste insuffisante dans les quartiers prisés de Montréal, maintenant une pression sur les prix."
            },
            {
                "source": "TVA Nouvelles",
                "title": "Combien devez-vous gagner pour acheter votre première propriété en 2026 ?",
                "description": "Une analyse du coût d'acquisition met en lumière l'importance d'une planification financière minutieuse dans le contexte actuel."
            }
        ]
    }
}

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
    
    now = datetime.now()
    # Si on est au début du mois (1-10), on parle du mois qui vient de finir
    report_month = now.month - 1 if now.day <= 10 else now.month
    if report_month == 0: report_month = 12
    
    # LOGIQUE DE DÉCISION DU MESSAGE
    if "baiss" in boc_status or "diminu" in boc_status:
        return "Bonne nouvelle ! La baisse du taux directeur par la Banque du Canada ouvre une porte d'opportunité. C'est le moment idéal pour sécuriser un taux avantageux avant que la hausse de la demande ne fasse grimper les prix encore plus vite. Votre pouvoir d'achat vient de faire un bond."
    
    if avg_trend > 8:
        return f"Le marché s'échauffe avec une hausse moyenne des prix de {avg_trend:.0f}% ce mois-ci. Si vous envisagez de vendre, les conditions sont optimales. Pour les acheteurs, la rapidité et une pré-approbation solide sont vos meilleurs atouts dans ce contexte de forte demande."
 
    if report_month == 5: # Mai spécifique
        return "Le mois de mai est traditionnellement le pic d'activité de l'année. La sélection de propriétés est à son maximum, mais les acheteurs sont aussi plus nombreux. Pour réussir votre transaction ce mois-ci, l'analyse fine des comparables est cruciale : ne surpayez pas, mais soyez prêt à agir avec conviction."
 
    if report_month in [3, 4]: # Printemps (Mars/Avril)
        return "Le marché printanier est officiellement là. C'est la période la plus active de l'année. Les nouvelles inscriptions augmentent, offrant plus de choix, mais la compétition reste forte. Une stratégie d'achat bien rodée est indispensable pour ne pas passer à côté de votre coup de cœur."
 
    if boc_rate > 4.5:
        return "Malgré des taux qui restent élevés, le marché démontre une résilience impressionnante. La stabilité est le mot d'ordre ce mois-ci. C'est un excellent moment pour une analyse comparative rigoureuse : acheter maintenant avec un taux variable pourrait s'avérer très lucratif lors du prochain cycle de baisses."
 
    return "Le marché immobilier actuel demande de la précision. Entre les variations de taux et l'ajustement des prix, chaque projet est unique. Que vous soyez en phase de réflexion ou prêt à passer à l'action, je suis là pour décoder ces chiffres avec vous et transformer ces données en stratégie gagnante."
 
def main(target_year=None, target_month=None):
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
    
    if target_year and target_month:
        report_year = target_year
        report_month = target_month
    else:
        # LOGIQUE DE DATE : Si on est le 1-10 du mois, le rapport concerne le mois précédent
        if now.day <= 10:
            report_month = now.month - 1
            report_year = now.year
            if report_month == 0:
                report_month = 12
                report_year -= 1
        else:
            report_month = now.month
            report_year = now.year
 
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
        "month_name": months_fr[report_month],
        "year": report_year,
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

    # Override for historical months to ensure data accuracy and uniqueness
    key = f"{report_year}-{report_month:02d}"
    if key in HISTORICAL_DATA:
        h = HISTORICAL_DATA[key]
        context.update({
            "boc_rate": h["boc_rate"],
            "boc_status": h["boc_status"],
            "boc_date": h["boc_date"],
            "boc_next": h["boc_next"],
            "market_temp": h["market_temp"],
            "temp_width": h["temp_width"],
            "message_evan": h["message_evan"],
            "market_stats": h["market_stats"],
            "news": h["news"]
        })


    # 3. Rendu Jinja2
    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template('report_template.html')
    output_html = template.render(context)

    # 4. Sauvegarder
    output_dir = 'rapports'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    filename = f"{report_year}-{report_month:02d}.html"
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
    report_id = f"{report_year}-{report_month:02d}"
    report_entry = {
        "id": report_id,
        "title": f"Rapport de Marché - {months_fr[report_month]} {report_year}",
        "date": now.strftime('%Y-%m-%d'),
        "pdf": f"{report_id}.pdf",
        "url": f"/rapports/{report_id}"
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
    import sys
    if len(sys.argv) == 3:
        main(int(sys.argv[1]), int(sys.argv[2]))
    else:
        main()

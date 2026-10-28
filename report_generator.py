# -*- coding: utf-8 -*-
import json
import os
import re
import html
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

HISTORICAL_DATA = {
    "2026-01": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "28 janvier 2026",
        "boc_next": "18 mars 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 75,
        "message_evan": "L'année 2026 démarre sous le signe de la stabilité. Les taux restent à 2,25 %, ce qui redonne confiance aux acheteurs. C'est le moment d'établir votre stratégie d'achat avant le pic printanier.",
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
                "description": "Lors de sa première annonce de l'année, la banque centrale a maintenu son taux directeur à 2,25 %, confirmant une accalmie après le cycle de resserrement."
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
        "boc_date": "28 janvier 2026",
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
        "boc_date": "18 mars 2026",
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
        "boc_date": "29 avril 2026",
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
        "boc_date": "29 avril 2026",
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
    },
    "2026-06": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "10 juin 2026",
        "boc_next": "15 juillet 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 75,
        "message_evan": "Juin clôture le deuxième trimestre avec une hausse constante des inscriptions actives. Les acheteurs disposent de plus d'options pour la période des déménagements, tandis que les maisons unifamiliales demeurent très convoitées.",
        "market_stats": {
            "montreal": {
                "price": "648 000", "trend": "+4%",
                "condo_price": "431 000", "condo_trend": "+2%",
                "sales": "3 890", "sales_trend": "-6%",
                "new_listings": "5 800", "active_listings": "19 850",
                "days": "41", "condition": "Vendeurs"
            },
            "laval": {
                "price": "638 000", "trend": "+3.5%",
                "condo_price": "412 000", "condo_trend": "+2%",
                "sales": "740", "sales_trend": "-3%",
                "new_listings": "1 080", "active_listings": "3 180",
                "days": "43", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "588 000", "trend": "+6%",
                "condo_price": "398 000", "condo_trend": "+3.5%",
                "sales": "1 690", "sales_trend": "-2%",
                "new_listings": "2 350", "active_listings": "6 650",
                "days": "39", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "518 000", "trend": "+5%",
                "condo_price": "368 000", "condo_trend": "+3%",
                "sales": "1 420", "sales_trend": "-1%",
                "new_listings": "2 050", "active_listings": "6 050",
                "days": "37", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "APCIQ",
                "title": "Bilan du 2e trimestre 2026 : l'inventaire résidentiel poursuit sa remontée à Montréal",
                "description": "La hausse des inscriptions actives permet d'atténuer la surenchère dans plusieurs secteurs, tout en maintenant les prix médians en croissance modérée."
            },
            {
                "source": "Les Affaires",
                "title": "Banque du Canada : le taux directeur maintenu à 2,25 % lors de l'annonce du 10 juin",
                "description": "La banque centrale privilégie la prudence afin d'observer l'évolution de l'inflation et de l'activité économique estivale."
            },
            {
                "source": "La Presse",
                "title": "Copropriétés à Montréal : un marché qui revient progressivement à l'équilibre",
                "description": "Les acheteurs de condos profitent d'un choix élargi dans les quartiers centraux, réduisant la pression à la hausse sur les prix."
            },
            {
                "source": "Blogue Centris",
                "title": "Préparer sa transaction estivale : les points clés avant de passer chez le notaire",
                "description": "Tour d'horizon des vérifications essentielles pour assurer une prise de possession fluide à l'approche du 1er juillet."
            }
        ]
    },
    "2026-07": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "15 juillet 2026",
        "boc_next": "2 septembre 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 72,
        "message_evan": "En juillet, la période d'ajustement se poursuit dans le Grand Montréal. Le marché des copropriétés atteint l'équilibre sur l'île de Montréal, tandis que l'unifamiliale conserve un avantage marqué pour les vendeurs avec un délai moyen de 38 jours.",
        "market_stats": {
            "montreal": {
                "price": "646 500", "trend": "+4%",
                "condo_price": "432 500", "condo_trend": "+2%",
                "sales": "3 240", "sales_trend": "-9%",
                "new_listings": "5 100", "active_listings": "19 600",
                "days": "38", "condition": "Vendeurs"
            },
            "laval": {
                "price": "636 000", "trend": "+3%",
                "condo_price": "411 000", "condo_trend": "+2%",
                "sales": "610", "sales_trend": "-5%",
                "new_listings": "950", "active_listings": "3 150",
                "days": "40", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "584 000", "trend": "+5%",
                "condo_price": "396 000", "condo_trend": "+3%",
                "sales": "1 410", "sales_trend": "-6%",
                "new_listings": "2 100", "active_listings": "6 720",
                "days": "37", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "516 000", "trend": "+4.5%",
                "condo_price": "366 000", "condo_trend": "+2.5%",
                "sales": "1 180", "sales_trend": "-5%",
                "new_listings": "1 820", "active_listings": "6 080",
                "days": "36", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "APCIQ",
                "title": "RMR de Montréal : la période d'ajustement se poursuit, le marché des copropriétés à l'équilibre",
                "description": "Le prix médian des unifamiliales a progressé de 4 % sur un an, celui des plex de 6 % et celui des copropriétés de 2 %, avec un délai moyen de 38 jours pour les maisons."
            },
            {
                "source": "Les Affaires",
                "title": "Annonce du 15 juillet : la Banque du Canada maintient son taux directeur à 2,25 %",
                "description": "La stabilité monétaire estivale permet aux ménages québécois de planifier leurs projets de financement sans hausse des taux variables."
            },
            {
                "source": "La Presse",
                "title": "Croissance de l'offre de copropriétés sur la Rive-Sud et la Rive-Nord",
                "description": "Alors que la progression de l'inventaire ralentit au centre-ville, l'offre s'accélère désormais dans les couronnes de Montréal."
            },
            {
                "source": "Le Devoir",
                "title": "Démographie et habitation : un nouvel équilibre s'installe dans la métropole",
                "description": "La modération de la croissance démographique tempère la demande locative et résidentielle après plusieurs années de surchauffe."
            }
        ]
    },
    "2026-08": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "15 juillet 2026",
        "boc_next": "2 septembre 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 70,
        "message_evan": "Les chiffres d'août confirment que le rééquilibrage gagne désormais les couronnes (Rive-Sud et Rive-Nord) avec 20 128 inscriptions actives (+18 %). C'est une excellente fenêtre pour les acheteurs qui retrouvent du pouvoir de négociation avant l'automne.",
        "market_stats": {
            "montreal": {
                "price": "646 000", "trend": "+3%",
                "condo_price": "434 000", "condo_trend": "+4%",
                "sales": "2 853", "sales_trend": "-13%",
                "new_listings": "4 850", "active_listings": "20 128",
                "days": "42", "condition": "Vendeurs"
            },
            "laval": {
                "price": "635 000", "trend": "+3%",
                "condo_price": "413 000", "condo_trend": "+3%",
                "sales": "540", "sales_trend": "-10%",
                "new_listings": "910", "active_listings": "3 280",
                "days": "44", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "582 000", "trend": "+4%",
                "condo_price": "398 000", "condo_trend": "+4%",
                "sales": "1 240", "sales_trend": "-11%",
                "new_listings": "2 050", "active_listings": "7 120",
                "days": "40", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "514 000", "trend": "+3.5%",
                "condo_price": "368 000", "condo_trend": "+3%",
                "sales": "1 020", "sales_trend": "-11%",
                "new_listings": "1 760", "active_listings": "6 410",
                "days": "39", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "APCIQ",
                "title": "RMR de Montréal : le rééquilibrage du marché gagne désormais les couronnes",
                "description": "En août, 2 853 ventes résidentielles ont été réalisées et l'inventaire a progressé de 18 % sur un an pour atteindre 20 128 inscriptions en vigueur."
            },
            {
                "source": "La Presse",
                "title": "Prix médians à Montréal : progression modérée de 3 % pour l'unifamiliale et de 4 % pour le condo",
                "description": "Malgré une offre plus abondante, la majorité des marchés d'unifamiliales de la RMR continuent d'avantager les vendeurs."
            },
            {
                "source": "Les Affaires",
                "title": "Pouvoir de négociation : les acheteurs prennent davantage le temps de comparer",
                "description": "Les délais de vente s'établissent en moyenne à 42 jours pour les maisons unifamiliales et à 62 jours pour les copropriétés."
            },
            {
                "source": "Blogue Centris",
                "title": "Rentrée automnale : comment positionner le prix de sa propriété ?",
                "description": "Avec la hausse de l'inventaire sur la Rive-Sud (+28 %) et la Rive-Nord (+26 %), une évaluation comparative précise dès la mise en marché est déterminante."
            }
        ]
    },
    "2026-09": {
        "boc_rate": "2.25%",
        "boc_status": "Maintenu",
        "boc_date": "2 septembre 2026",
        "boc_next": "28 octobre 2026",
        "market_temp": "Marché Actif (Vendeurs)",
        "temp_width": 70,
        "message_evan": "En septembre, la route vers un marché plus équilibré se poursuit avec 20 350 inscriptions actives (+17 % sur un an) et un prix médian de 645 500 $ pour l'unifamiliale (+2 %). Une stratégie de prix juste et réaliste est essentielle cet automne.",
        "market_stats": {
            "montreal": {
                "price": "645 500", "trend": "+2%",
                "condo_price": "435 000", "condo_trend": "+2%",
                "sales": "9 265", "sales_trend": "-12%",
                "new_listings": "16 280", "active_listings": "20 350",
                "days": "40", "condition": "Vendeurs"
            },
            "laval": {
                "price": "638 000", "trend": "+2%",
                "condo_price": "419 000", "condo_trend": "+2%",
                "sales": "1 760", "sales_trend": "-10%",
                "new_listings": "3 050", "active_listings": "3 560",
                "days": "42", "condition": "Vendeurs"
            },
            "rive-sud": {
                "price": "579 000", "trend": "+3%",
                "condo_price": "404 000", "condo_trend": "+3%",
                "sales": "4 045", "sales_trend": "-11%",
                "new_listings": "6 620", "active_listings": "7 560",
                "days": "39", "condition": "Vendeurs"
            },
            "rive-nord": {
                "price": "510 000", "trend": "+2.5%",
                "condo_price": "373 500", "condo_trend": "+2.5%",
                "sales": "3 350", "sales_trend": "-11%",
                "new_listings": "5 790", "active_listings": "6 785",
                "days": "38", "condition": "Vendeurs"
            }
        },
        "news": [
            {
                "source": "APCIQ",
                "title": "RMR de Montréal et de Québec : la route vers un marché plus équilibré se poursuit",
                "description": "Au 3e trimestre 2026, le prix médian des unifamiliales dans la RMR de Montréal s'est établi à 645 500 $ (+2 %) et celui des copropriétés à 435 000 $ (+2 %)."
            },
            {
                "source": "APCIQ",
                "title": "L'immobilier résidentiel poursuit sa période de transition au Québec",
                "description": "L'offre de propriétés inscrites sur Centris dans la RMR de Montréal atteint 20 350 unités (+17 %), offrant davantage de choix aux acheteurs."
            },
            {
                "source": "Protégez-Vous",
                "title": "Prêt hypothécaire : réservez votre taux tôt pour économiser",
                "description": "Dans un contexte où les taux fixes connaissent des fluctuations, verrouiller un taux hypothécaire à l'avance protège votre budget d'achat."
            },
            {
                "source": "Les Affaires",
                "title": "Partage des données immobilières : l'APCIQ conclut une entente avec le Bureau de la concurrence",
                "description": "Cette entente vise à moderniser l'accès aux données transactionnelles pour soutenir le travail de conseil des courtiers immobiliers au Québec."
            }
        ]
    }
}


def generate_evan_message(data, report_month):
    """Génère un message contextuel basé sur les données réelles du mois."""
    boc_rate = float(str(data.get('boc_rate', '2.25')).replace('%', '').strip())
    boc_status = str(data.get('boc_status', 'maintenu')).lower()

    stats = data.get('market_stats', {})
    avg_trend = 0
    trends_count = 0
    for r, s in stats.items():
        if isinstance(s, dict) and 'trend' in s:
            try:
                val = float(s['trend'].replace('%', '').replace('+', '').strip())
                avg_trend += val
                trends_count += 1
            except Exception:
                pass

    avg_trend = avg_trend / trends_count if trends_count > 0 else 0

    if "baiss" in boc_status or "diminu" in boc_status:
        return "Bonne nouvelle ! La baisse du taux directeur par la Banque du Canada ouvre une fenêtre d'opportunité. C'est le moment idéal pour sécuriser un taux avantageux avant que la hausse de la demande ne stimule les prix. Votre pouvoir d'achat s'en trouve renforcé."

    if avg_trend > 8:
        return f"Le marché affiche une vigueur soutenue avec une hausse moyenne des prix de {avg_trend:.0f} % sur un an. Si vous envisagez de vendre, les conditions sont optimales. Pour les acheteurs, la rapidité et une préqualification solide sont vos meilleurs atouts."

    if report_month == 5:
        return "Le mois de mai est traditionnellement le pic d'activité de l'année. La sélection de propriétés est à son maximum, mais les acheteurs sont aussi plus nombreux. Pour réussir votre transaction, l'analyse fine des comparables est cruciale."

    if report_month in [3, 4]:
        return "Le marché printanier bat son plein. Les nouvelles inscriptions augmentent, offrant plus de choix, mais la compétition demeure vive pour les propriétés clé en main. Une stratégie bien préparée est indispensable."

    if report_month in [9, 10, 11]:
        return "Le marché d'automne offre un rééquilibrage graduel de l'inventaire tout en maintenant des prix solides. Que vous souhaitiez vendre avant l'hiver ou profiter d'un choix élargi pour acheter, une stratégie sur mesure basée sur les comparables récents fera toute la différence."

    if boc_rate > 4.5:
        return "Malgré des taux plus restrictifs, le marché démontre une résilience remarquable. C'est un excellent moment pour une analyse comparative rigoureuse afin de saisir les opportunités de négociation."

    return "Le marché immobilier actuel demande de la précision. Entre l'évolution de l'inventaire et la stabilisation des prix, chaque secteur évolue à son propre rythme. Je suis à votre disposition pour décoder ces chiffres et bâtir votre plan d'action."


def sanitize_report_news(news_list):
    cleaned = []
    seen = set()
    for item in news_list:
        title = html.unescape(item.get('title', '')).strip()
        source = html.unescape(item.get('source', 'Actualités')).strip()
        desc = html.unescape(item.get('description', item.get('summary', ''))).strip()

        if " - " in title:
            parts = title.rsplit(" - ", 1)
            if 1 < len(parts[1].strip()) <= 40:
                if source in ("news.google.com", "Google News") or re.match(r'^\d+\s+\w+$', source):
                    source = parts[1].strip()
                title = parts[0].strip()

        desc = re.sub(r"L[’']article\s+.*?est apparu en premier sur.*$", "", desc, flags=re.IGNORECASE | re.DOTALL).strip()
        norm_t = re.sub(r'\W+', '', title.lower())[:50]
        if not title or norm_t in seen:
            continue
        seen.add(norm_t)

        cleaned.append({
            "source": source,
            "title": title,
            "description": desc
        })
        if len(cleaned) >= 4:
            break
    return cleaned


def main(target_year=None, target_month=None):
    print("Démarrage de la génération du rapport...")

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

    now = datetime.now()

    if target_year and target_month:
        report_year = int(target_year)
        report_month = int(target_month)
    else:
        # Le rapport mensuel porte toujours sur le dernier mois complet écoulé (M-1)
        report_month = now.month - 1
        report_year = now.year
        if report_month == 0:
            report_month = 12
            report_year -= 1

    months_fr = {
        1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
        7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
    }

    # Lire boc_rates.json pour les vraies dates et statuts de la Banque du Canada
    boc_file_data = {}
    if os.path.exists('boc_rates.json'):
        try:
            with open('boc_rates.json', 'r', encoding='utf-8') as f:
                boc_file_data = json.load(f)
        except Exception:
            pass

    boc_rate_str = str(data.get('boc_rate', f"{boc_file_data.get('rate', '2.25')}%"))
    if not boc_rate_str.endswith('%'):
        boc_rate_str += '%'

    boc_status = "Maintenu"
    boc_raw_status = str(boc_file_data.get('status', data.get('boc_status', 'maintenu'))).lower()
    if 'baiss' in boc_raw_status or 'diminu' in boc_raw_status:
        boc_status = "En baisse"
    elif 'augment' in boc_raw_status or 'hausse' in boc_raw_status:
        boc_status = "En hausse"

    boc_date = boc_file_data.get('date', data.get('last_update', now.strftime('%Y-%m-%d')).split(' ')[0])
    boc_next = boc_file_data.get('next_announcement', 'Voir calendrier BoC')

    try:
        rate_val = float(boc_rate_str.replace('%', '').strip())
    except ValueError:
        rate_val = 2.25

    if rate_val < 3.5:
        market_temp = "Marché Actif (Vendeurs)"
        temp_width = 72
    elif rate_val <= 4.5:
        market_temp = "Marché Équilibré"
        temp_width = 55
    else:
        market_temp = "Marché Prudent (Acheteurs)"
        temp_width = 35

    raw_stats = data.get('market_stats', {})
    clean_stats = {k: v for k, v in raw_stats.items() if isinstance(v, dict)}

    context = {
        "month_name": months_fr[report_month],
        "year": report_year,
        "boc_rate": boc_rate_str,
        "boc_status": boc_status,
        "boc_date": boc_date,
        "boc_next": boc_next,
        "market_temp": market_temp,
        "temp_width": temp_width,
        "message_evan": generate_evan_message(data, report_month),
        "market_stats": clean_stats,
        "news": sanitize_report_news(data.get('news', []))
    }

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

    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template('report_template.html')
    output_html = template.render(context)

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

    report_id = f"{report_year}-{report_month:02d}"
    # Date de publication : le 1er du mois suivant
    pub_year = report_year + 1 if report_month == 12 else report_year
    pub_month = 1 if report_month == 12 else report_month + 1
    pub_date = f"{pub_year}-{pub_month:02d}-01"

    report_entry = {
        "id": report_id,
        "title": f"Rapport de Marché - {months_fr[report_month]} {report_year}",
        "date": pub_date,
        "pdf": f"{report_id}.pdf",
        "url": f"/rapports/{report_id}"
    }

    index_data = [r for r in index_data if r['id'] != report_entry['id']]
    index_data.append(report_entry)
    index_data.sort(key=lambda r: r['id'], reverse=True)
    index_data = index_data[:12]

    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)

    print(f"Succès: HTML du rapport généré dans {filepath}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3:
        main(int(sys.argv[1]), int(sys.argv[2]))
    elif len(sys.argv) == 2 and "-" in sys.argv[1]:
        y_s, m_s = sys.argv[1].split("-")
        main(int(y_s), int(m_s))
    else:
        main()

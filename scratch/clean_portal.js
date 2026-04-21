const fs = require('fs');

// We define the CLEAN strings here using Hex Escapes.
// This is 100% immune to encoding issues because the source code is ASCII.
const CLEAN_DATA = {
    MOCK_DATA: `
    const MOCK_DATA = {
        firstName: "Evan",
        code: "Achat - Evan Patruno",
        property: "Achat - Evan Patruno",
        city: "En attente de propri\\u00e9t\\u00e9",
        stage: "Analyse des offres",
        image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
        timeline: [
            { label: "Pr\\u00e9paration", icon: "\\uD83D\\uDCCB", status: "completed" },
            { label: "Offre d\\u00e9pos\\u00e9e", icon: "\\uD83D\\uDD0D", status: "active" },
            { label: "Conditions", icon: "\\uD83D\\uDEE1\\uFE0F", status: "pending" },
            { label: "Notaire", icon: "\\u2712\\uFE0F", status: "pending" },
            { label: "Succ\\u00e8s", icon: "\\uD83C\\uDFE0", status: "pending" }
        ],
        team: [
            { role: "Votre Courtier", name: "Evan Patruno", icon: "\\uD83D\\uDCF1", contact: "tel:5145673249" },
            { role: "Collaborateur", name: "Marc-Andr\\u00e9 Girard", icon: "\\uD83E\\uDD1D", contact: "mailto:test@test.com" },
            { role: "Courtier Hyp.", name: "Sophie Lapointe", icon: "\\uD83D\\uDCB0", contact: "tel:5555555555" },
            { role: "Inspecteur", name: "Inspectec Inc.", icon: "\\uD83D\\uDD0D", contact: "tel:4444444444" },
            { role: "Notaire", name: "Me Jean Picard", icon: "\\uD83D\\uDDB1\\uFE0F", contact: "tel:3333333333" }
        ],
        checklist: [
            { name: "Financement Approuv\\u00e9", done: true },
            { name: "Offre d'achat", done: false },
            { name: "ID Photo", done: true }
        ],
        milestones: {
            financing: { days: 5, date: "25 Avril 2026" },
            inspection: { days: 12, date: "2 Mai 2026" },
            signature: { days: 25, date: "15 Mai 2026" },
            occupation: { days: 28, date: "18 Mai 2026" }
        },
        movingChecklist: [
            { name: "Aviser son propri\\u00e9taire (60 jours avant)", done: true },
            { name: "Contacter Bell / Videotron / Hydro-Qu\\u00e9bec", done: false },
            { name: "Faire suivre son courrier \\u2014 Postes Canada", done: false },
            { name: "Aviser la RAMQ et la SAAQ", done: false },
            { name: "R\\u00e9server la compagnie de d\\u00e9m\\u00e9nagement", done: false },
            { name: "Commander les boites et mat\\u00e9riaux", done: false },
            { name: "Faire l'inventaire des biens assurables", done: false },
            { name: "Changer les serrures \\u00e0 l'arriv\\u00e9e", done: false }
        ],
        partners: [
            { name: "D\\u00e9m\\u00e9nagement Express", icon: "\\uD83D\\uDE66", category: "D\\u00e9m\\u00e9nagement", benefit: "10% Rabais clients Evan", code: "EVAN10" },
            { name: "CleanPro Montr\\u00e9al", icon: "\\uD83E\\uDD59", category: "Nettoyage", benefit: "-50$ sur 1\\u00e8re visite", code: "PATRUNO" },
            { name: "HomeD\\u00e9cor Plus", icon: "\\u2728", category: "Am\\u00e9nagement", benefit: "Consultation gratuite", code: "PORTAIL" }
        ],
        concierge: {
            smartHome: [
                { category: "S\\u00e9curit\\u00e9", icon: "\\uD83D\\uDD10", title: "Serrure intelligente", desc: "Remplacez vos serrures d\\u00e8s l'emm\\u00e9nagement pour plus de s\\u00e9curit\\u00e9." },
                { category: "Confort", icon: "\\uD83C\\uDF21\\uFE0F", title: "Thermostat connect\\u00e9", desc: "Ecobee ou Nest pour optimiser votre consommation d'\\u00e9nergie." },
                { category: "Surveillance", icon: "\\uD83D\\uDCF9", title: "Cam\\u00e9ra ext\\u00e9rieure", desc: "Ring ou Arlo : surveillez votre propri\\u00e9t\\u00e9 \\u00e0 distance." }
            ],
            maintenance: [
                { period: "PRINTEMPS", title: "Goutti\\u00e8res & toiture", desc: "V\\u00e9rifier les goutti\\u00e8res et la toiture apr\\u00e8s l'hiver." },
                { period: "\\u00c9T\\u00c9", title: "Climatisation", desc: "Nettoyer les filtres et v\\u00e9rifier la thermopompe." },
                { period: "AUTOMNE", title: "Isolation & fen\\u00eatres", desc: "V\\u00e9rifier les calfeutrages et pr\\u00e9parer pour l'hiver." },
                { period: "HIVER", title: "Syst\\u00e8me de chauffage", desc: "Tester la fournaise et faire entretenir si n\\u00e9cessaire." }
            ],
            resources: [
                { title: "R\\u00e9gime d'Acc\\u00e8s \\u00e0 la Propri\\u00e9t\\u00e9 (RAP) \\u2014 ARC", url: "https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/sujets/reer-reer-ferr-autres-regimes-enregistres/retirer-votre-reer-regulier/regime-acces-propriete.html" },
                { title: "Guide de l'acheteur \\u2014 OACIQ officiel", url: "https://www.oaciq.com/fr/articles/rachetez-une-propriete" },
                { title: "Calculateur de droit de mutation", url: "https://www.ville.montreal.qc.ca/portal/page?_pageid=44,52683200&_dad=portal&_schema=PORTAL" }
            ]
        }
    };`,
    
    // Also the icons in HTML and other strings
    HTML_CLEAN: {
        'Après-Vente': 'Apr&egrave;s-Vente',
        'Ã¢â€“Â¼': '&#9660;',
        'Ã°Å¸Å¡â‚¬': '&#128640;',
        'Ã°Å¸Â â€š': '&#127810;',
        'Ã°Å¸â€œÅ¡': '&#128218;',
        'Ã¢Å“â€œ': '&#10003;',
        'Ã¢Ëœâ€¦': '&#9733;',
        'Ã¢Â­Â ': '&#11088;',
        'Ã°Å¸Â â€ ': '&#127942;',
        'Ã°Å¸â€œÂ±': '&#128241;',
        'Accès': 'Acc&egrave;s'
    }
};

const PATHS = [
    'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html',
    'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html'
];

PATHS.forEach(p => {
    let content = fs.readFileSync(p, 'utf8');
    
    // Overwrite MOCK_DATA
    const mockStart = content.indexOf('const MOCK_DATA = {');
    const mockEnd = content.indexOf('};', mockStart) + 2;
    if (mockStart !== -1 && mockEnd !== -1) {
        content = content.substring(0, mockStart) + CLEAN_DATA.MOCK_DATA + content.substring(mockEnd);
    }
    
    // Replace remaining garp in HTML
    for (const [garp, clean] of Object.entries(CLEAN_DATA.HTML_CLEAN)) {
        content = content.split(garp).join(clean);
    }
    
    fs.writeFileSync(p, content, 'utf8');
});

console.log('Hex-Isolation Complete.');

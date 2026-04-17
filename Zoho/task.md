# Checklist des améliorations Zoho CRM

## Phase 1 : Personnalisation
- [x] Analyser et nettoyer les modèles d'e-mails existants (Ton et structure validités).
- [x] Créer de nouveaux modèles d'e-mails stratégiques (Relance, Intro & 30j réalisés).
- [x] Revoir la disposition (layouts) des modules (Prospects/Affaires/Contacts) pour masquer les champs inutiles.
- [x] Rapatrier les champs exclusifs de "Prospect physique" vers "Standard" (Prix recherché, Pays, etc.).
- [x] Rapatrier les champs exclusifs de Contacts ("Affichage personnalisé" vers "Standard").
- [x] Rapatrier les champs exclusifs de Affaires ("Immobilier" vers "Standard").
- [x] **Créer les "Règles de disposition" pour masquer Acheteur/Vendeur dynamiquement (Vérifié - Déjà programmé par Evan le 25 mars !).**
- [ ] Mettre en place le masquage automatique des champs redondants (Phase UX finale).

## Phase 2 : Automatisation (Via Blueprint)
- [x] **Automatiser les actions post-transition dans le Blueprint** :
  - [x] Action : Créer les tâches de relance automatiques ("Rappeler demain").
  - [x] Action : Créer la tâche "Rappeler dans 6 mois" (Nurturing) et tâches d'étapes.
  - [x] Action : Envoi d'e-mails de Nurturing ou Relance lors des changements de statut.
  - [x] Action : E-mail de confirmation de RDV avec liste de documents.
- [x] Ajouter une automatisation pour les leads/affaires dormants (Réalisé en Phase 5).

## Phase 3 : Gestion de Processus
- [x] Optimiser le Blueprint "Process Prospect" (Résoudre les culs-de-sac, intégrer des champs obligatoires, automatiser).
- [x] Optimiser le Blueprint "Affaire ACHAT" (ajouter des champs obligatoires entre les transitions).
- [x] Créer les champs avancés Affaires (Checklist, Prix, Dates).
- [x] Relier les champs aux transitions et aligner le Pipeline/Probabilités.
- [x] Créer un Blueprint dédié aux "Affaires VENTE" si pertinent.
- [ ] Mettre en place un processus d'approbation ou de révision si nécessaire (ex: validation de documents).

## Phase 4 : Réorganisation Visuelle (Layouts)
- [x] Organiser les champs de la disposition Standard des Prospects.
- [x] Organiser les champs de la disposition Standard des Contacts.
- [x] Organiser les champs de la disposition Standard des Affaires.

## Phase 5 : Automatisation et Rappels
- [x] Configurer une alerte pour les prospects dormants (30 jours sans activité).
- [x] Analyser et créer de nouveaux modèles d'e-mails professionnels.

## Phase 6 : Intelligence Commerciale (Bonus)
- [x] Configurer le "Lead Scoring" (Notation automatique) pour le module Prospects.
- [x] Activer et connecter les Signaux (Email and Tracking) pour les pop-ups "Espionnage".
- [x] Configurer les Agents Zia (Intelligence Artificielle de personnalisation et prédiction).
- [x] Configurer l'Intelligence des e-mails et détection d'anomalies Zia.

## Phase 7 : Standardisation des Données (Nom/Prénom)
- [x] Analyser la structure actuelle des noms dans les modules Prospects et Contacts.
- [x] Proposer une stratégie de séparation (Prénom/Nom).
- [x] Mettre à jour les dispositions (Layouts) pour afficher les deux champs séparément.
- [x] (Optionnel) Nettoyer les données existantes (Scripts Deluge exécutés !).

## Phase 8 : Optimisation des Workflows (Audit & Nettoyage)
- [x] Audit complet des règles de workflow existantes.
- [x] Désactivation des règles obsolètes (Zoho Bookings).
- [x] Correction de la description `Rappel délais financement`.
- [x] Clarification et correction de la règle `Transaction anniversaire`.
- [x] Création des rappels critiques : Inspection, Autres Conditions, Clôture (Notaire).
- [x] Sécurisation de l'envoi des guides (Champ `Guide Envoyé` + Logique de workflow).
- [ ] ⏸️ Créer la règle automatique d'Avis Google (Post-Vente) [Mis de côté]
- [ ] Nettoyage des règles obsolètes (Bookings).
- [ ] Étendre la séquence de réengagement (60/90 jours).

## Phase 9 : Nouvelles Améliorations Stratégiques (Sélection 13 Idées)
- [x] **Idée 18 : Champs de Motivations & Qualification** (Savoir "Pourquoi" ils achètent/vendent, Ajout date renouvellement, délais pour vendre).
  - [ ] Terminer le mappage de conversion pour ces nouveaux champs.
  - [ ] Mettre en place la règle de disposition d'affichage conditionnel (Acheteur vs Vendeur).
- [ ] **Idée 19 : Chronologie de suivi** (Visualiser le temps depuis le dernier contact).
- [x] **Nouveau : Alignement Blueprint / Kanban pour les Prospects**
  - [x] Nettoyer le champ "Statut du prospect" et ajouter le champ "Raison de la perte".
  - [x] Redessiner le Blueprint pour inclure "RDV / Évaluation".
  - [x] Appliquer les champs obligatoires (ex: Raison perte, Motivation) dans les transitions.
- [ ] **Idée 20 : Détection de Doublons** (Paramétrer les règles de fusion auto).
- [ ] **Idée 35 : Cadeau de Fermeture** (Rappel auto 3 jours avant clôture).
- [ ] **Idée 38 : Compte à rebours** (Widget visuel de jours avant acte).
- [ ] **Idée 39 : Recommandations Partenaires** (Bouton d'envoi de contacts).
- [ ] **Idée 40 : Accès Collaborateur Conjoint** (Lier les fiches conjoints).
- [x] **Idée 41 : Anniversaire d'Achat** (Séquence 5 ans)
  - [x] Créer les 5 modèles d'e-mails pour chaque année.
  - [x] Configurer les 5 Règles de Workflow (Déclencheur Date) pour chaque anniversaire.
  - [x] Désactiver les anciennes règles obsolètes d'anniversaire (`IA - Courriel 1 an achat`, etc).

## Phase 10 : Délivrabilité et Spam
- [x] **Authentifier le domaine l'envoi d'e-mail (SPF / DKIM)** pour empêcher les e-mails de tomber dans les spams (via Zoho CRM). Le domaine (evanpatruno.ca) est déjà 100% vérifié !
- [x] **Vérifier l'expéditeur ("De")** dans l'Alerte E-mail des règles de Workflow pour éviter le "noreply@zohocrm" (Test Validé ✅).
- [x] **Idée 43 : Programme de Parrainage / Ambassadeur** (Champs et Modèle créés 🚀. Reste à lancer l'envoi).
- [ ] **Idée 46 : Cartes de Vœux** (Automatisations de fin d'année).
- [ ] **Idée 47 : Suivi des Travaux** (Relance post-achat sur les rénos).
- [ ] **Idée 75 : Champs Obligatoires Progressifs** (Validation par étape).
- [ ] **Idée 78 : Nettoyage E-mails Invalides** (Suppression auto des bounces).

## Phase 11 : Intelligence par Source (Froid vs Chaud)
- [ ] Vérifier et ajuster les valeurs du champ "Origine du Contact" (Lead Source : Facebook vs En personne).
- [ ] Créer une Règle de Workflow "Piste Chaude (En Personne)" : Génère uniquement une Tâche de suivi manuel.
- [ ] Créer une Règle de Workflow "Piste Froide (Publicité)" : Déclenche l'envoi d'e-mails automatiques et SMS.

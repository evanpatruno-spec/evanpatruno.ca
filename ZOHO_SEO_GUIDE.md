# Guide de Configuration Technique SEO - Zoho Sites

Ce guide vous explique comment résoudre les problèmes structurels identifiés pour **evanpatruno.ca**.

## 1. Résoudre l'Erreur SSL (Priorité Haute)

L'erreur "Certificat non valide" survient souvent quand le domaine sans `www` n'est pas correctement lié au certificat.

1.  Connectez-vous à **Zoho Sites**.
2.  Allez dans **Settings** > **Custom Domain**.
3.  Vérifiez que votre domaine est bien "Primary".
4.  Cherchez l'option **SSL** (souvent sous l'onglet "Security" ou "Custom Domain").
5.  Si possible, activez le **"Force HTTPS"**.
6.  **Important :** Si vous utilisez Cloudflare ou un autre registraire (GoDaddy, etc.), assurez-vous que l'enregistrement `A` pointe vers l'IP de Zoho et qu'aucun proxy externe ne bloque le certificat de Zoho.

## 2. Soumettre le Sitemap à Google

1.  Allez sur la [Google Search Console](https://search.google.com/search-console).
2.  Ajoutez votre propriété : `https://www.evanpatruno.ca`.
3.  Dans le menu de gauche, cliquez sur **Sitemaps**.
4.  Entrez l'URL : `sitemap-cms.xml` et cliquez sur **Submit**.
5.  Faites de même pour Bing Webmaster Tools.

## 3. SEO par Page dans Zoho

Pour chaque page où vous avez injecté un snippet (Acheteurs, Vendeurs, etc.) :

1.  Dans l'éditeur Zoho, allez dans **Pages**.
2.  Cliquez sur l'icône **SEO/Settings** de la page concernée.
3.  Remplissez :
    *   **Page Title :** (Ex: *Evan Patruno | Courtier Immobilier Estrie & Montréal*)
    *   **Meta Description :** (Ex: *Achetez ou vendez votre propriété au juste prix avec l'expertise d'Evan Patruno. Alertes VIP, stratégie de négociation et protection totale.*)
    *   **Keywords :** courtier immobilier, achat maison québec, evan patruno, hypothécaire.

## 4. Robots.txt

Vérifiez que votres fichier robots.txt (accessible via `evanpatruno.ca/robots.txt`) n'interdit pas l'accès aux dossiers importants. Zoho le gère généralement bien par défaut.

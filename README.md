# Mes projets web

Petit dashboard qui liste mes projets web. Pour chacun, on peut consulter son README
(récupéré via l'API GitHub), voir ses infos principales et ouvrir le site déployé.

> Application générée en partie par IA : **Claude Sonnet 5.5** (Anthropic).

## Fonctionnalités

- Liste des projets avec indicateur « en ligne » / « pas de déploiement »
- Fiche projet : description, langage, étoiles, date de dernière mise à jour
- README affiché directement dans la page (images et liens relatifs corrigés)
- Boutons « Ouvrir le site » et « Voir sur GitHub »
- Lien direct vers un projet (`index.html#nom-du-depot`)
- Interface adaptée au mobile : liste puis fiche, avec bouton retour
- Thème clair ou sombre selon le réglage du système
- Messages d'erreur explicites (README absent, limite GitHub, réseau, dépôt introuvable)

## Structure

Un fichier = un langage.

| Fichier         | Rôle                                   |
| --------------- | -------------------------------------- |
| `index.html`    | Structure de la page                   |
| `style.css`     | Styles                                 |
| `app.js`        | Logique et appels à l'API GitHub       |
| `projects.json` | Configuration : pseudo et projets      |

## Configuration

Modifie `projects.json` :

```json
{
  "username": "ton-pseudo-github",
  "projects": [
    { "repo": "nom-du-depot", "url": "https://mon-site.com" },
    { "repo": "autre-depot", "url": "", "title": "Titre personnalisé (optionnel)" }
  ]
}
```

- `repo` : nom exact du dépôt GitHub (public)
- `url` : adresse du site déployé, ou `""` s'il n'y en a pas
- `title` : nom affiché à la place du nom du dépôt (optionnel)

## Lancer le projet

Aucune installation ni build. Il faut simplement servir le dossier avec un serveur local,
car un navigateur bloque la lecture de `projects.json` en ouvrant `index.html` directement :

```bash
python3 -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

## Limites

- Seuls les dépôts publics sont accessibles (pas de token).
- Sans identification, GitHub limite à 60 requêtes par heure et par adresse IP.
  L'application fait une requête par projet au chargement, plus une par README ouvert
  (les README sont mis en cache pendant la visite).
- Les polices sont chargées depuis Google Fonts.

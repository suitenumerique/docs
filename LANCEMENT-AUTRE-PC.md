# Lancer Docs sur un autre PC Linux

## Prérequis

- Docker avec le plugin `docker compose`
- connexion Internet au premier lancement pour télécharger/construire les images
- plusieurs gigaoctets libres pour les images et volumes Docker

## Démarrage

Depuis le dossier extrait :

```bash
chmod +x run-docs-lan.sh
LAN_HOST="$(hostname -I | awk '{print $1}')" ./run-docs-lan.sh
```

Le premier lancement est plus long, car Docker initialise PostgreSQL, Redis,
MinIO et Keycloak, puis démarre le backend, le frontend et la collaboration.

Pour un usage uniquement sur le PC local :

```bash
LAN_HOST=127.0.0.1 ./run-docs-lan.sh
```

## Accès

- Docs : `http://ADRESSE_IP_DU_PC:3000`
- API : `http://ADRESSE_IP_DU_PC:8071`
- Connexion Keycloak : `http://ADRESSE_IP_DU_PC:8083`

Toujours utiliser le même nom d'hôte ou la même adresse IP pendant tout le flux
de connexion ; ne pas mélanger `localhost` et l'adresse LAN.

## Arrêt

```bash
docker compose -f compose.yml -f compose.lan.yml down
```

Cette commande conserve les volumes et les données. Ne pas ajouter `-v` sauf si
la suppression complète des données est réellement souhaitée.

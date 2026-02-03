# Outbox Worker (BetLeague)

Ce repo utilise un **Outbox Pattern** pour garantir que les Domain Events sont **persistés dans la même transaction** que la commande métier, puis traités **asynchronement** par un worker dédié.

## Principe

1. Une commande (ex: `invite_user`) écrit ses données métier.
2. Elle publie un event via `OutboxDomainEventBus`.
3. Le bus écrit une ligne dans `outbox_message` (même transaction DB).
4. Un worker (`outbox_worker`) poll la table `outbox_message` et dispatch les events vers les handlers applicatifs.

## Conteneur Docker

Le worker est un service `outbox_worker` dans `docker-compose.yml`.

Variables d’environnement:
- `OUTBOX_BATCH_SIZE` (default: 50)
- `OUTBOX_POLL_INTERVAL_MS` (default: 250)
- `OUTBOX_MAX_POLL_INTERVAL_MS` (default: 5000)
- `OUTBOX_JITTER_MS` (default: 100)

## Lancer en local

```bash
cd BetLeague
docker compose up -d --build
```

Le worker tourne en continu et traite l’outbox.

## Dépannage

- Si `outbox_message` grossit, vérifie que le container `outbox_worker` est **Up**.
- Tu peux inspecter les derniers messages:

```bash
docker compose exec db psql -U postgres -d betleague -c "select id,event_name,processed_at,attempts,last_error from outbox_message order by id desc limit 20;"
```


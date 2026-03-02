# JetStream (NATS) – Outbox publisher

Ce repo utilise le pattern **Outbox** en base (Postgres) pour garantir la publication transactionnelle des événements.

Deux modes existent pour le worker `outbox_worker_main.py` :

- `OUTBOX_DISPATCH_MODE=local` : exécute les handlers *dans* le worker (sans broker)
- `OUTBOX_DISPATCH_MODE=jetstream` : publie les événements vers **NATS JetStream**

## Variables d’environnement

- `OUTBOX_DISPATCH_MODE`: `local|jetstream`
- `NATS_URL`: ex `nats://nats:4222` (Docker) ou `nats://127.0.0.1:4222` (local)
- `NATS_STREAM`: ex `BETLEAGUE`
- `NATS_SUBJECT_PREFIX`: ex `betleague`

Les sujets sont dérivés de `event_name` :

- `ticket.choices.resolved` → `betleague.ticket.choices.resolved`

## Démarrage (Docker)

```bash
docker compose up -d db redis nats
```

## Consommer les événements (démo)

```bash
cd back
NATS_URL='nats://127.0.0.1:4222' python3 jetstream_consumer_main.py
```

## Publier un événement (démo)

```bash
cd back
NATS_URL='nats://127.0.0.1:4222' python3 -c "import asyncio; from infrastructure.services.nats_jetstream import JetStreamPublisher, load_jetstream_settings; \nasync def main():\n p=JetStreamPublisher(load_jetstream_settings());\n await p.publish_event(event_name='league.started', payload={'event_name':'league.started','league_id':1,'league_name':'Test'}, message_id='demo-1');\n await p.close();\nasyncio.run(main())"
```

## Notes perf/sécurité

- La déduplication JetStream utilise le header `Nats-Msg-Id` = `outbox_id`.
- Pour la sécurité en prod : active TLS + auth (NKey/creds) et des permissions par subject.


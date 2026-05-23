# BetLeagueBack

## Logging & observabilité

Le backend expose maintenant des logs structurés utilisables en prod, avec corrélation requête/réponse.

### Champs utiles dans les logs JSON

- `ts`: timestamp UTC
- `level`: niveau du log
- `logger`: nom du logger Python
- `service`: nom logique du service, configurable via `LOG_SERVICE_NAME`
- `component`: composant émetteur (`api`, `outbox_worker`, etc.)
- `env`: environnement (`dev` / `prod`)
- `msg`: nom de l’événement
- `request_id`: identifiant de corrélation HTTP quand disponible
- `context`: métadonnées structurées additionnelles

### Corrélation front ↔ back

- le frontend envoie `X-Request-Id` sur les appels API
- le backend le conserve et le renvoie dans la réponse
- les erreurs frontend normalisées remontent aussi ce `requestId`

Exemple de workflow:

1. une erreur UI affiche ou capture un `requestId`
2. rechercher ce `request_id` dans les logs backend
3. suivre les événements `http.request.completed`, `http.exception.handled`, `auth.*`, etc.

### Variables d’environnement utiles

Voir aussi :

- `back/.env.local.example` pour le **développement local**
- `back/.env.example` pour la **production / Neon**

Pour travailler en local, copie `back/.env.local.example` vers `back/.env`. Le fichier `docker-compose.yml` continue de charger `back/.env`.

- `ENVIRONMENT=prod`
- `SQLALCHEMY_DATABASE_URL` : endpoint Neon **pooler** pour le runtime applicatif
- `ALEMBIC_DATABASE_URL` : endpoint Neon **direct** pour les migrations Alembic
- `SQLALCHEMY_SSL_MODE=verify-full`
- `SQLALCHEMY_SSL_ROOT_CERT` : optionnel si l’endpoint PostgreSQL présente une CA privée / chaîne autosignée (PEM sur une ligne avec `\n` échappés)
- `SQLALCHEMY_POOL_RECYCLE=300`
- `SQLALCHEMY_POOL_TIMEOUT=30`
- `SQLALCHEMY_COMMAND_TIMEOUT=30`
- en `prod`, FastAPI désactive automatiquement `/docs`, `/redoc` et `/openapi.json`
- `JSON_LOGS=true`
- `LOG_SERVICE_NAME=betleague-back`
- `HTTP_REQUEST_LOGGING_ENABLED=true`
- `HTTP_REQUEST_LOGGING_EXCLUDED_PATHS=/health`
- `HTTP_SLOW_REQUEST_THRESHOLD_MS=1000`

Le backend applique désormais un `application_name` PostgreSQL explicite par composant (`betleague-api`, `betleague-celery`, `betleague-migrations`) via `connect_args`, avec `jit=off`, `pool_pre_ping`, `pool_recycle` et `pool_timeout` pour mieux supporter Neon en production. Si ton PostgreSQL n’utilise pas une chaîne publique standard, tu peux conserver `verify-full` et injecter le certificat racine via `SQLALCHEMY_SSL_ROOT_CERT`.

### Développement local rapide

Exemple minimal local :

- `ENVIRONMENT=dev`
- `SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/betleague`
- `SQLALCHEMY_SSL_MODE=disable`
- `APP_FRONTEND_URL=http://localhost:3000`
- `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

Le setup local ne nécessite ni endpoint Neon, ni `ALEMBIC_DATABASE_URL`, ni secret de migration séparé : Alembic retombe automatiquement sur `SQLALCHEMY_DATABASE_URL` si aucune URL dédiée n’est fournie.

### Événements principaux

#### HTTP

- `http.request.started`
- `http.request.completed`
- `http.request.failed`
- `http.validation.failed`
- `http.exception.handled`
- `http.exception.unhandled`

#### Auth / sécurité

- `auth.login.succeeded`
- `auth.login.failed`
- `auth.refresh.succeeded`
- `auth.refresh.rejected`
- `auth.password_changed`
- `auth.2fa.*`
- `auth.blacklist.*`
- `auth.token.*`

### Politique de sécurité

Les logs évitent volontairement de stocker:

- tokens JWT
- cookies
- mots de passe
- secrets applicatifs
- payloads sensibles complets

### Recommandation d’exploitation

En production:

- conserver `JSON_LOGS=true`
- injecter `LOG_SERVICE_NAME`
- agréger stdout/stderr dans votre plateforme de logs
- indexer au minimum `request_id`, `msg`, `level`, `component`, `status_code`


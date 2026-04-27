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

Voir aussi `back/.env.example`.

- `ENVIRONMENT=prod`
- en `prod`, FastAPI désactive automatiquement `/docs`, `/redoc` et `/openapi.json`
- `JSON_LOGS=true`
- `LOG_SERVICE_NAME=betleague-back`
- `HTTP_REQUEST_LOGGING_ENABLED=true`
- `HTTP_REQUEST_LOGGING_EXCLUDED_PATHS=/health`
- `HTTP_SLOW_REQUEST_THRESHOLD_MS=1000`

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


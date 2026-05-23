# Runbook de secours base de données — BetLeague

Ce runbook décrit la procédure de secours officielle pour BetLeague lorsque **Neon (primaire)** n'est plus utilisable en production et qu'il faut basculer manuellement sur **PostgreSQL secondaire OVH/VPS**.

## Objectif

- **Primaire** : Neon
  - runtime applicatif : endpoint **poolé**
  - migrations : endpoint **direct**
- **Secondaire** : PostgreSQL 15/16 sur OVH/VPS
  - runtime applicatif : endpoint secondaire
  - migrations : endpoint secondaire
- **Bascule** : **manuelle** par secrets + redéploiement Swarm
- **Protection des données** : dump régulier + <restauration testée

---

## 1. Pré-requis permanents

Avant toute panne réelle, vérifier que les points suivants sont déjà en place.

### 1.1 Base secondaire prête

La base secondaire doit respecter les contraintes suivantes :

- PostgreSQL **15 ou 16**
- idéalement **même version majeure** que la prod primaire
- accès réseau **strictement limité** au backend BetLeague
- SSL activé si exposition externe
- utilisateur dédié applicatif
- utilisateur dédié migrations/DDL si possible

### 1.2 Secrets et modèles prêts

Les fichiers suivants doivent exister côté exploitation :

- `infrastructure/deploy/swarm/secrets/backend.env` → **primaire active**
- `infrastructure/deploy/swarm/secrets/migrations.env` → **primaire active**
- `infrastructure/deploy/swarm/secrets/backend.env.secondary.example` → **modèle secours secondaire**
- `infrastructure/deploy/swarm/secrets/migrations.env.secondary.example` → **modèle secours secondaire**

Pour savoir **quelles vraies valeurs renseigner** dans ces modèles, se référer à :

- `infrastructure/deploy/swarm/SECRETS_SECONDARY_DB.md`

### 1.3 Sauvegardes régulières

Un dump PostgreSQL régulier doit être disponible pour restauration vers la base secondaire.

Pour une procédure détaillée d’export / restauration entre providers managés, voir aussi :

- `infrastructure/deploy/swarm/MIGRATION_NEON_TO_SUPABASE.md`

Minimum recommandé :

- dump complet quotidien
- dump fréquent supplémentaire avant fenêtres de release sensibles
- au moins **une restauration testée** sur la base secondaire

### 1.4 Vérifications de santé disponibles

BetLeague expose déjà les contrôles utiles :

- API readiness : `/ready`
- API health : `/health`
- logs services Swarm

---

## 2. Déclencheurs de bascule

La procédure s'applique si l'un des cas suivants survient sur Neon :

- quota compute dépassé
- indisponibilité prolongée
- erreurs de connexion répétées
- temps de réponse incompatibles avec la prod
- erreur provider confirmée côté Neon

Pour le cas spécifique d’un export de données depuis Neon vers Supabase après incident de quota, voir aussi :

- `infrastructure/deploy/swarm/MIGRATION_NEON_TO_SUPABASE.md`

Signaux typiques observables dans BetLeague :

- `/ready` passe en `degraded`
- erreurs SQL côté backend
- timeout sur les routes API
- workers Celery / outbox en échec DB
- erreurs 5xx côté front sur les écrans dépendants de la base

---

## 3. Inventaire des URLs à préparer

## 3.1 Primaire Neon

### Runtime applicatif

`SQLALCHEMY_DATABASE_URL`

Exemple :

```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://user:password@ep-primary-pooler.eu-west-1.aws.neon.tech/neondb
```

### Migrations Alembic

`ALEMBIC_DATABASE_URL`

Exemple :

```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://user:password@ep-primary.eu-west-1.aws.neon.tech/neondb
```

## 3.2 Secondaire PostgreSQL OVH/VPS

### Runtime applicatif

`SQLALCHEMY_DATABASE_URL`

Exemple :

```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://betleague_app:change-me@pg-secondary.internal:5432/betleague
```

### Migrations Alembic

`ALEMBIC_DATABASE_URL`

Exemple :

```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://betleague_migrations:change-me@pg-secondary.internal:5432/betleague
```

> Si la base secondaire est exposée hors réseau privé, imposer SSL et certificat de confiance cohérent.

---

## 4. Principe de bascule officiel

La bascule est **manuelle**.

On ne fait **jamais** :

- de failover automatique entre deux bases indépendantes
- d'écriture simultanée sur Neon et la secondaire
- de migration lancée sur une base différente de celle utilisée par l'application active

Le flux officiel est :

1. diagnostiquer l'incident Neon
2. geler les écritures si nécessaire
3. restaurer les données sur la secondaire
4. remplacer les secrets DB runtime + migrations
5. redéployer la stack / release
6. vérifier `/ready`, `/health`, smoke tests métier
7. communiquer le passage en mode secours

---

## 5. Procédure exacte de secours — étape par étape

## Étape 0 — Ouvrir l'incident

Créer un incident interne et noter :

- heure de début
- symptôme principal
- statut Neon
- dernière opération métier critique connue (release, migration, import, etc.)

## Étape 1 — Confirmer que le problème vient bien de Neon

Vérifications minimales :

```zsh
docker service logs betleague_backend --since 10m | cat
docker service logs betleague_celery_worker --since 10m | cat
docker service logs betleague_outbox_worker --since 10m | cat
```

Contrôler aussi l'API :

```zsh
curl -fsS https://api.betleague.app/health
curl -fsS https://api.betleague.app/ready
```

Si `ready` remonte une erreur `database`, poursuivre la procédure.

## Étape 2 — Geler les écritures

Pendant une bascule DB, il faut éviter les écritures concurrentes sur une base qui change.

Minimum opérationnel recommandé :

- suspendre les actions d'administration critiques
- ne pas lancer de migration applicative pendant l'incident
- informer que l'application peut être temporairement dégradée

Si tu as une fenêtre d'intervention courte, la stratégie la plus simple est :

- activer une maintenance applicative côté edge/front
- ou prévenir qu'une indisponibilité courte est en cours

> Tant qu'un vrai mode `maintenance/read-only` n'est pas codé dans l'app, le plus sûr reste une courte fenêtre de maintenance contrôlée.

## Étape 3 — Restaurer les données sur la base secondaire

### 3.1 Identifier la sauvegarde la plus récente

Choisir :

- le dernier dump valide
- ou le dernier snapshot restaurable validé

### 3.2 Restaurer sur PostgreSQL secondaire

Exemple type si tu utilises un dump PostgreSQL custom :

```zsh
export PGPASSWORD='REPLACE_ME'
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname='postgresql://betleague_migrations@pg-secondary.internal:5432/betleague' \
  /path/to/latest.dump
```

### 3.3 Vérifier que la restauration est cohérente

Vérifier au minimum :

- présence des tables principales
- volume de données plausible
- date de dernier enregistrement cohérente

Exemple :

```zsh
psql 'postgresql://betleague_migrations@pg-secondary.internal:5432/betleague' -c 'SELECT now();'
psql 'postgresql://betleague_migrations@pg-secondary.internal:5432/betleague' -c '\dt'
```

## Étape 4 — Préparer les secrets de secours actifs

### 4.1 Sauvegarder les secrets actifs avant modification

```zsh
cd /Users/lucasdasilvamarques/BetLeague/infrastructure/deploy/swarm/secrets
cp backend.env backend.env.before-failover
cp migrations.env migrations.env.before-failover
```

### 4.2 Remplacer par les valeurs secondaires

Option simple : recopier depuis les modèles secondaires puis remplir les vrais secrets.

```zsh
cp backend.env.secondary.example backend.env
cp migrations.env.secondary.example migrations.env
```

Puis renseigner les vraies valeurs de prod secondaire.

### 4.3 Vérifier les variables obligatoires

`backend.env` doit contenir au minimum :

- `SQLALCHEMY_DATABASE_URL`
- `SQLALCHEMY_SSL_MODE`
- le reste des secrets habituels backend

`migrations.env` doit contenir au minimum :

- `ALEMBIC_DATABASE_URL`

## Étape 5 — Valider la connectivité avant redéploiement

Avant de relancer la stack, vérifier que les URLs secondaires sont joignables.

Exemple de test simple depuis un poste d'admin ou hôte de déploiement :

```zsh
python - <<'PY'
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = 'postgresql+asyncpg://betleague_app:change-me@pg-secondary.internal:5432/betleague'

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        await conn.execute(text('SELECT 1'))
    await engine.dispose()

asyncio.run(main())
PY
```

## Étape 6 — Redéployer avec les secrets de secours

Le redéploiement doit réinjecter les nouveaux secrets Swarm.

### Option A — via workflow applicatif recommandé

Déclencher `app-release.yml` ou le playbook de release prévu par ton infra.

Le but est de :

1. relancer les migrations si nécessaire
2. redéployer backend
3. redéployer workers
4. redéployer frontend si besoin

### Option B — via playbook Ansible de release

Utiliser le chemin officiel de ton infra si tu l'exécutes manuellement.

> Utiliser en priorité le mécanisme déjà décrit dans `infrastructure/deploy/swarm/README.md`, pour que les secrets/configs hashés soient correctement recréés.

## Étape 7 — Vérifier la convergence Swarm

```zsh
docker stack services betleague
docker stack ps betleague
docker service logs betleague_backend --since 5m | cat
docker service logs betleague_celery_worker --since 5m | cat
docker service logs betleague_outbox_worker --since 5m | cat
```

Tous les services DB-dépendants doivent revenir au vert :

- `backend`
- `celery_worker`
- `celery_beat`
- `outbox_worker`
- `jetstream_consumer` si activé

## Étape 8 — Vérifier l'application après bascule

### 8.1 Vérifications HTTP

```zsh
curl -fsS https://api.betleague.app/health
curl -fsS https://api.betleague.app/ready
curl -I https://app.betleague.app
```

### 8.2 Vérifications métier minimales

Tester :

1. connexion utilisateur
2. affichage matchs
3. affichage ligues
4. affichage tickets
5. profil utilisateur
6. création d'un ticket de test si fenêtre autorisée

### 8.3 Vérification background jobs

Confirmer qu'il n'y a pas d'erreurs DB récurrentes dans :

- workers Celery
- outbox
- consumer

## Étape 9 — Communiquer le mode secours

Informer explicitement :

- que l'application tourne sur la base secondaire
- que Neon reste incidenté ou isolé
- qu'un retour arrière sera planifié plus tard

---

## 6. Retour à Neon après incident

Le retour arrière doit suivre la même rigueur.

## Étape 1 — Attendre la stabilisation complète de Neon

Ne pas revenir trop tôt.

Vérifier :

- quota rétabli
- connectivité stable
- latence acceptable
- logs propres

## Étape 2 — Décider de la stratégie de retour

Deux cas :

### Cas A — secondaire utilisée en lecture/écriture pendant l'incident

Il faut **reconcilier** les données avant de revenir sur Neon.

### Cas B — incident très court, peu ou pas d'écritures

Le retour peut être plus simple, mais doit rester vérifié.

## Étape 3 — Restaurer/synchroniser vers Neon si nécessaire

Le chemin dépendra de ta stratégie de sauvegarde.

## Étape 4 — Restaurer les secrets primaires

```zsh
cd /Users/lucasdasilvamarques/BetLeague/infrastructure/deploy/swarm/secrets
cp backend.env.before-failover backend.env
cp migrations.env.before-failover migrations.env
```

## Étape 5 — Redéployer de nouveau

Même mécanique que pour la bascule vers la secondaire.

## Étape 6 — Refaire les smoke tests

Même check-list que section 5 / étapes 7 et 8.

---

## 7. Check-list d'exploitation

## Hebdomadaire

- vérifier qu'un dump récent existe
- vérifier l'espace disque de la base secondaire
- vérifier que les credentials secondaires restent valides

## Mensuel

- tester une restauration sur la base secondaire
- vérifier la version PostgreSQL secondaire
- tester la connectivité SSL si DB externe
- relire ce runbook

## Trimestriel

- faire un exercice complet de bascule en environnement de préproduction ou fenêtre contrôlée
- mesurer le temps réel de rétablissement
- corriger les points bloquants

---

## 8. Critères de succès de la méthode de secours

La méthode est considérée comme prête si :

- la base secondaire existe et est joignable
- les secrets secondaires sont prêts
- un dump récent est restaurable
- `/ready` repasse `ok` après bascule
- le front et les routes API critiques refonctionnent
- l'équipe sait exécuter ce runbook sans improvisation

---

## 9. Décisions officielles pour BetLeague

Pour BetLeague, la stratégie validée est :

- **Neon en primaire**
- **PostgreSQL OVH/VPS en secondaire**
- **dump régulier**
- **bascule manuelle par secrets + redéploiement**
- **aucun failover automatique inter-provider**

C'est le compromis recommandé entre :

- simplicité opérationnelle
- sécurité des données
- cohérence avec l'architecture Swarm actuelle
- risque limité en production





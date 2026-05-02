# Ansible sécurisé pour BetLeague (`VPS-3`)

Cette couche Ansible complète Terraform pour durcir l'hôte BetLeague après provisioning OVH.

## Objectifs

- fermeture SSH par mot de passe
- restriction UFW de SSH aux CIDR de confiance
- application d'une politique UFW compatible Docker/Swarm via `DOCKER-USER`, pour éviter l'exposition accidentelle de ports publiés
- activation de `fail2ban`, `auditd` et `unattended-upgrades`
- vérifications post-hardening automatisées sur la configuration SSH effective, `ufw status verbose` et la prison `fail2ban` `sshd`
- configuration Docker avec options runtime durcies
- préparation d'une arborescence runtime stricte sous `/opt/betleague`

Dans la configuration Docker gérée par le rôle `docker_host`, l'option `live-restore` est volontairement désactivée : elle est incompatible avec le mode Docker Swarm utilisé ensuite par `init_swarm.yml` et `deploy_swarm.yml`.

## Structure

```text
ansible/
├── ansible.cfg
├── inventories/
│   └── prod/
│       └── group_vars/
│           └── all.yml.example
├── playbooks/
│   ├── deploy_swarm.yml
│   ├── release_swarm.yml
│   ├── init_swarm.yml
│   └── harden_host.yml
├── requirements.yml
└── roles/
    ├── app_host/
    ├── base_hardening/
    ├── docker_host/
    ├── edge_tls/
    ├── swarm_host/
    └── swarm_stack/
```

## Pré-requis

- Terraform déjà appliqué dans `../terraform`
- accès SSH par clé sur l'hôte
- au moins un CIDR de confiance à autoriser pour SSH

Sur un VPS OVH neuf, l'image Ubuntu peut exposer uniquement l'utilisateur cloud `ubuntu` au premier démarrage. Il n'est pas nécessaire de créer l'utilisateur admin final manuellement : le playbook `harden_host.yml` se connecte d'abord avec un utilisateur bootstrap joignable, crée ensuite l'utilisateur admin configuré (`betleague` par défaut), installe sa clé SSH, puis applique `AllowUsers` sur cet utilisateur.

En CI Terraform, le job de hardening résout l'utilisateur admin final depuis les outputs Terraform (`ansible_inventory_host.betleague_admin_user`, puis `admin_user`, puis `ansible_user` pour compatibilité), teste automatiquement cet utilisateur, puis `SSH_BOOTSTRAP_USER` si cette variable GitHub Environment est définie, sinon `ubuntu`. Cela permet de fonctionner à la fois sur un VPS déjà durci et sur un VPS OVH from scratch, sans hardcoder `betleague` dans le workflow.

La clé privée `SSH_PRIVATE_KEY` doit correspondre à la clé publique injectée par OVH au provisioning initial (`TF_VAR_VPS_PUBLIC_SSH_KEY_DEV` / `TF_VAR_VPS_PUBLIC_SSH_KEY_PROD`) et sera aussi dérivée en clé publique pour `~betleague/.ssh/authorized_keys`.

## Génération de l'inventaire

### Depuis Terraform (bootstrap infra)

```bash
cd infrastructure
python3 scripts/render-ansible-inventory.py \
  --terraform-dir terraform \
  --output ansible/inventories/prod/hosts.yml
```

### Sans Terraform (release applicative dédiée)

```bash
cd infrastructure
python3 scripts/render-ansible-inventory.py \
  --ansible-host 203.0.113.10 \
  --ansible-user deploy \
  --hostname betleague-prod \
  --environment-name prod \
  --compose-root /opt/betleague \
  --output ansible/inventories/prod/hosts.yml
```

## Variables à renseigner

Copie `inventories/prod/group_vars/all.yml.example` vers un fichier local non sensible adapté à ton environnement, puis renseigne au minimum :

- `betleague_ssh_trusted_cidrs`
- `betleague_ssh_port` (si SSH n'écoute pas sur `22`)
- `betleague_enable_fail2ban`
- `betleague_admin_user`
- `betleague_admin_authorized_public_keys` (optionnel, pour gérer les clés SSH autorisées de l'utilisateur admin via Ansible)
- `betleague_runtime_user`
- `betleague_runtime_group`

### Bootstrap sans édition manuelle de `authorized_keys`

Pour installer la clé publique dédiée à GitHub Actions sans `nano`/édition interactive sur le VPS, utilise Ansible avec une clé d'administration déjà fonctionnelle :

```bash
ssh-keygen -y -f "$HOME/.ssh/betleague_github_actions" > /tmp/betleague_github_actions.pub

python3 - <<'PY' > /tmp/ci-public-key-vars.json
import json
from pathlib import Path

print(json.dumps({
    "betleague_admin_authorized_public_keys": [
        Path("/tmp/betleague_github_actions.pub").read_text().strip()
    ]
}))
PY

cd infrastructure/ansible
ANSIBLE_CONFIG=ansible.cfg ansible-playbook \
  -i inventories/prod/hosts.yml \
  --private-key "$HOME/.ssh/ta-cle-admin-actuelle" \
  -e @/tmp/ci-public-key-vars.json \
  playbooks/harden_host.yml
```

Ainsi, la clé publique CI est ajoutée de façon idempotente dans `~{{ betleague_admin_user }}/.ssh/authorized_keys` par le rôle `base_hardening`, sans manipulation manuelle sur l'hôte.

Pour un bootstrap manuel hors CI sur un VPS neuf où seul `ubuntu` est joignable, force simplement l'utilisateur de connexion Ansible à `ubuntu` au premier passage, tout en gardant `betleague_admin_user` positionné sur l'utilisateur final voulu (`betleague` par défaut) :

```bash
cd infrastructure/ansible
ANSIBLE_CONFIG=ansible.cfg ansible-playbook \
  -i inventories/prod/hosts.yml \
  --private-key "$HOME/.ssh/ta-cle-provisioning-ovh" \
  -e ansible_user=ubuntu \
  -e @/tmp/ci-public-key-vars.json \
  playbooks/harden_host.yml
```

Après ce premier hardening, les déploiements applicatifs doivent se connecter avec l'utilisateur admin final configuré.

## Installation des collections

```bash
cd infrastructure/ansible
ansible-galaxy collection install -r requirements.yml
```

## Vérification de syntaxe

```bash
cd infrastructure/ansible
ansible-playbook -i inventories/prod/hosts.yml playbooks/deploy_swarm.yml --syntax-check
ansible-playbook -i inventories/prod/hosts.yml playbooks/init_swarm.yml --syntax-check
ansible-playbook -i inventories/prod/hosts.yml playbooks/harden_host.yml --syntax-check
```

## Initialisation du manager Swarm

```bash
cd infrastructure/ansible
ansible-playbook -i inventories/prod/hosts.yml playbooks/init_swarm.yml
```

## Déploiement de la stack Swarm

```bash
cd infrastructure/ansible
ansible-playbook -i inventories/prod/hosts.yml \
  -e @/chemin/vers/swarm-vars.json \
  playbooks/deploy_swarm.yml
```

En CI/CD, deux chemins existent désormais :

1. `/.github/workflows/terraform-ci.yml` pour l’enchaînement infra + hardening + déploiement applicatif
2. `/.github/workflows/app-release.yml` pour une release applicative seule, sans Terraform

Dans les deux cas, le déploiement Swarm passe désormais par le workflow réutilisable `/.github/workflows/_swarm-deploy.yml`, ce qui centralise :

- la génération d’inventaire Ansible
- la préparation SSH stricte
- la construction de `swarm-vars.json`
- le `--syntax-check` Ansible
- l’exécution du playbook Ansible autorisé pour le contexte (`playbooks/deploy_swarm.yml` ou `playbooks/release_swarm.yml`)

Le workflow `terraform-ci.yml` enchaîne, selon l’environnement ciblé :

1. `apply-dev` / `apply-prod`
2. `harden-host-dev` / `harden-host-prod` qui appelle `playbooks/harden_host.yml`
3. `deploy-swarm-dev` / `deploy-swarm-prod` qui délègue à `/.github/workflows/_swarm-deploy.yml`

Les jobs `harden-host-dev` et `harden-host-prod` attendent la variable GitHub Environment `SSH_TRUSTED_CIDRS` pour construire `betleague_ssh_trusted_cidrs`.

Les jobs manuels `terraform-ci.yml` et le workflow réutilisable `/.github/workflows/_swarm-deploy.yml` ciblent désormais un runner self-hosted configurable via la variable de dépôt `BETLEAGUE_SELF_HOSTED_RUNNER_LABELS_JSON`, avec fallback `["self-hosted","macOS"]`. Si tu as un runner dédié sur ton Mac, le plus simple est donc de définir explicitement cette variable sur des labels qui n'identifient que ce runner. Ce runner doit aussi exposer `python3` (3.11+ recommandé) dans le `PATH`, car BetLeague crée maintenant son environnement Python local directement sur la machine au lieu d’utiliser `actions/setup-python`.

Sur macOS, les jobs Ansible bootstrapent aussi un bundle CA explicite à partir de `certifi` avant `ansible-galaxy collection install`, afin d’éviter les erreurs `CERTIFICATE_VERIFY_FAILED` vers `galaxy.ansible.com`. Si ton runner passe derrière un proxy TLS d’entreprise ou une PKI interne, tu peux compléter ce bundle sans désactiver la validation TLS en définissant soit le secret GitHub `BETLEAGUE_EXTRA_CA_CERT_PEM`, soit la variable `BETLEAGUE_EXTRA_CA_CERT_PATH` pointant vers un fichier PEM déjà présent sur le runner.

Les jobs `deploy-swarm-dev` et `deploy-swarm-prod`, ainsi que `app-release.yml`, s’appuient tous sur `/.github/workflows/_swarm-deploy.yml`, qui construit un `swarm-vars.json` injectant explicitement `GUNICORN_WORKERS` et `GUNICORN_FORWARDED_ALLOW_IPS` dans le rôle `swarm_stack`, sans dépendre de `backend.env` pour ces paramètres de runtime Gunicorn.

Le workflow `app-release.yml` reste le point d’entrée manuel pour une release applicative seule. Il délègue à `/.github/workflows/_swarm-deploy.yml`, lequel reconstruit l'inventaire Ansible directement depuis `DEPLOY_HOST` et `DEPLOY_USER` portés par les GitHub Environments, ce qui évite toute dépendance à un artefact Terraform lors d’une simple mise à jour d’images applicatives.

Pour cette voie de release dédiée, le workflow appelle désormais le playbook `playbooks/release_swarm.yml` plutôt que `playbooks/deploy_swarm.yml`.

Le playbook `deploy_swarm.yml` prépare aussi le TLS edge sur l’hôte via le rôle `edge_tls` : installation de `certbot`, certificat autosigné de bootstrap, webroot ACME, émission/renouvellement Let’s Encrypt et hook de reload Nginx pour le service Swarm `edge`.

Grafana utilise le dashboard provisionné `BetLeague - System Overview` comme page d'accueil via `GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH`. Cela évite de retomber sur un ancien Home dashboard persisté dans `grafana_data` qui peut référencer des panels legacy absents des images Grafana récentes (`welcome`, `gettingstarted`, `dashlist`, `news`). Toute modification de ce comportement nécessite un déploiement Swarm complet (`deploy_swarm.yml`) afin de mettre à jour le service `grafana`, pas seulement une release applicative (`release_swarm.yml`).

Le vhost Nginx `edge` ne définit pas de `Content-Security-Policy` additionnelle pour Grafana et ne masque pas la CSP upstream. Grafana sert donc sa propre CSP native (`GF_SECURITY_CONTENT_SECURITY_POLICY=true`), compatible avec ses bundles frontend et plugins intégrés. C'est volontaire : une CSP Nginx générique trop stricte peut produire des erreurs UI du type `Panel plugin not found: stat` ou `Panel plugin not found: timeseries`, tandis qu'une absence totale de CSP serait une régression de défense XSS pour un endpoint d'administration. Le dashboard provisionné évite aussi les annotations internes Grafana pour ne pas dépendre d'une datasource spéciale `-- Grafana --` absente sur certaines versions.

Comme les Docker configs Swarm sont immuables, `deploy_swarm.yml` vérifie aussi que le service `edge` monte bien le `ConfigName` Nginx calculé depuis le dernier rendu. Si le navigateur affiche encore une erreur CSP `script-src 'self'`, vérifie que le job a atteint `deploy-swarm-*` et que `docker service inspect <stack>_edge` ne référence plus un ancien `betleague_edge_nginx_conf_<hash>`. Le service `edge` publie 80/443 en `mode: host`; il surcharge donc l'ordre global `start-first` avec `update_config.order=stop-first`, indispensable sur Swarm mono-node pour éviter que le nouveau task reste bloqué parce que l'ancien occupe encore les ports hôte.

Le mot de passe `admin` Grafana est aussi resynchronisé par Ansible après chaque déploiement complet et chaque release applicative. C'est nécessaire car `GF_SECURITY_ADMIN_PASSWORD__FILE` n'est pris en compte par Grafana qu'à l'initialisation de la base dans le volume persistant `grafana_data`; si le secret GitHub `GRAFANA_ADMIN_PASSWORD` change ensuite, la base Grafana conserve l'ancien mot de passe tant qu'une commande `grafana cli admin reset-admin-password` n'est pas exécutée. La tâche Ansible lit la valeur fournie par la CI, réinitialise le compte `admin`, puis valide l'authentification sans journaliser le secret.

Par défaut, ce rôle émet maintenant les certificats Let’s Encrypt en **ECDSA P-256** (`--key-type ecdsa --elliptic-curve secp256r1`) et aligne le certificat autosigné de bootstrap sur la même famille de clé (courbe OpenSSL `prime256v1`). Le fallback RSA reste possible si tu changes explicitement `betleague_letsencrypt_key_type`, avec une taille durcie à `4096` bits.

Le rôle applique aussi un garde-fou anti rate-limit : tant que `betleague_letsencrypt_staging=true` n'a pas été validé de bout en bout, une émission directe Let’s Encrypt production est refusée sauf si tu assumes explicitement le risque avec `betleague_letsencrypt_acked_production=true`.

Le rôle `swarm_stack` précharge aussi les images backend/frontend visées, applique `./scripts/run_migrations.sh` **avant** `docker stack deploy`, puis laisse Swarm effectuer le rolling update applicatif. Ce séquencement est nécessaire pour éviter une coupure backend lors d’une release versionnée.

Pour PostgreSQL managé sur Neon, le runtime applicatif utilise désormais un endpoint **pooler** via `SQLALCHEMY_DATABASE_URL`, tandis que les migrations Alembic utilisent un endpoint **direct** séparé injecté via le secret `MIGRATIONS_ENV`. Cela évite d’exposer les credentials DDL aux services runtime tout en gardant un tuning SQLAlchemy adapté à Neon (`verify-full`, `pool_recycle`, `pool_timeout`, `command_timeout`, `application_name`).

Le playbook `release_swarm.yml`, lui, est dédié aux releases applicatives d’une stack déjà en place. Il :

1. vérifie l’existence des images cibles
2. déclenche le service one-shot `<stack>_migrations` (par défaut `betleague_migrations`)
3. attend sa fin avec succès
4. effectue ensuite un rolling update séquencé de `backend`, puis des workers (`celery_worker`, `celery_beat`, `outbox_worker`), puis de `frontend`
5. termine par des smoke tests HTTP sur l’API et le frontend

Cette voie est donc plus proche d’un workflow de release zero-downtime applicatif qu’un simple `docker stack deploy` global.

Attention : `harden-host-dev` / `deploy-swarm-dev` et `harden-host-prod` / `deploy-swarm-prod` s’exécutent sur des jobs GitHub Actions distincts. Si les runners n’ont pas une sortie réseau stable et autorisée par `SSH_TRUSTED_CIDRS`, le déploiement Swarm suivant peut être bloqué après activation d’UFW/SSH restrictif. Avec un runner self-hosted sur ton Mac, `SSH_TRUSTED_CIDRS` doit donc inclure l’IP publique de sortie de ce Mac (ou celle de ton VPN/bastion), typiquement en `/32`.

## Application

```bash
cd infrastructure/ansible
ansible-playbook -i inventories/prod/hosts.yml playbooks/harden_host.yml
```

Le playbook relit ensuite la configuration SSH effective avec `/usr/sbin/sshd -T` et échoue si les garanties critiques ne sont pas présentes :

```text
allowusers betleague
passwordauthentication no
kbdinteractiveauthentication no
permitrootlogin no
pubkeyauthentication yes
```

Il vérifie aussi que l'utilisateur cloud par défaut (`ubuntu` par défaut) n'apparaît pas dans `allowusers` et que son mot de passe est verrouillé lorsque `betleague_lock_default_cloud_user_password=true`.

Le hardening SSH est déployé dans `/etc/ssh/sshd_config.d/00-betleague-hardening.conf` afin d'être lu avant les éventuels drop-ins cloud-init, par exemple `/etc/ssh/sshd_config.d/50-cloud-init.conf`. C'est volontaire : OpenSSH conserve généralement la première valeur rencontrée pour les directives globales comme `PasswordAuthentication`, donc un fichier BetLeague en `99-...` pourrait arriver trop tard et laisser `passwordauthentication yes` effectif.

## Remarques sécurité

- Ne stocke pas les secrets applicatifs dans Ansible en clair.
- Garde les fichiers secrets dans `/opt/betleague/secrets/` avec propriétaire `root`.
- Sépare les credentials de migration DDL (`MIGRATIONS_ENV`) des credentials runtime (`BACKEND_ENV`) pour limiter le blast radius en cas de compromission applicative.
- Le certificat TLS edge public n'est plus injecté comme secret GitHub : la clé privée est générée et renouvelée sur l'hôte par Let’s Encrypt, puis copiée dans `/opt/betleague/shared/tls/edge/` avec permissions strictes.
- Pour limiter les risques de rate-limit Let’s Encrypt en production, garde `LETSENCRYPT_STAGING=true` au premier déploiement public, valide tout le flux HTTP-01/HTTPS, puis bascule seulement ensuite vers `LETSENCRYPT_STAGING=false` avec `LETSENCRYPT_PRODUCTION_ACK=true`.
- Les releases backend/frontend sans downtime supposent des migrations DB backward-compatible (_expand / contract_). Si une migration casse l’ancienne version backend, Swarm ne pourra pas garantir une continuité fonctionnelle malgré le rolling update `start-first`.
- Une fois le hardening appliqué, garde uniquement les CIDR administratifs strictement nécessaires dans `betleague_ssh_trusted_cidrs`.
- La politique UFW BetLeague bloque les nouvelles connexions Docker publiées autres que les ports explicitement autorisés dans `betleague_public_tcp_ports` (par défaut `80/443`).
- Fail2ban est aligné sur le port SSH réel (`betleague_ssh_port`), ignore `localhost` + les CIDR d’administration, applique des bannissements progressifs via l’action `ufw` et active aussi une jail `recidive` pour bannir plus longtemps les IP déjà sanctionnées à répétition.
- `betleague_ssh_trusted_cidrs` reste volontairement vide par défaut : le rôle échoue explicitement tant qu’au moins un CIDR d’administration valide n’est pas fourni, pour éviter toute ouverture SSH implicite ou tout lockout silencieux.
- Les changements de configuration Fail2ban utilisent un `reload` plutôt qu’un `restart`, afin de préserver autant que possible l’état des bans actifs.























# Ansible sécurisé pour BetLeague (`VPS-3`)

Cette couche Ansible complète Terraform pour durcir l'hôte BetLeague après provisioning OVH.

## Objectifs

- fermeture SSH par mot de passe
- restriction UFW de SSH aux CIDR de confiance
- application d'une politique UFW compatible Docker/Swarm via `DOCKER-USER`, pour éviter l'exposition accidentelle de ports publiés
- activation de `fail2ban`, `auditd` et `unattended-upgrades`
- vérifications post-hardening automatisées sur `ufw status verbose` et la prison `fail2ban` `sshd`
- configuration Docker avec options runtime durcies
- préparation d'une arborescence runtime stricte sous `/opt/betleague`

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
- `betleague_runtime_user`
- `betleague_runtime_group`

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
- l’exécution de `playbooks/deploy_swarm.yml`

Le workflow `terraform-ci.yml` enchaîne, selon l’environnement ciblé :

1. `apply-dev` / `apply-prod`
2. `harden-host-dev` / `harden-host-prod` qui appelle `playbooks/harden_host.yml`
3. `deploy-swarm-dev` / `deploy-swarm-prod` qui délègue à `/.github/workflows/_swarm-deploy.yml`

Les jobs `harden-host-dev` et `harden-host-prod` attendent la variable GitHub Environment `SSH_TRUSTED_CIDRS` pour construire `betleague_ssh_trusted_cidrs`.

Les jobs `deploy-swarm-dev` et `deploy-swarm-prod`, ainsi que `app-release.yml`, s’appuient tous sur `/.github/workflows/_swarm-deploy.yml`, qui construit un `swarm-vars.json` injectant explicitement `GUNICORN_WORKERS` et `GUNICORN_FORWARDED_ALLOW_IPS` dans le rôle `swarm_stack`, sans dépendre de `backend.env` pour ces paramètres de runtime Gunicorn.

Le workflow `app-release.yml` reste le point d’entrée manuel pour une release applicative seule. Il délègue à `/.github/workflows/_swarm-deploy.yml`, lequel reconstruit l'inventaire Ansible directement depuis `DEPLOY_HOST` et `DEPLOY_USER` portés par les GitHub Environments, ce qui évite toute dépendance à un artefact Terraform lors d’une simple mise à jour d’images applicatives.

Le playbook `deploy_swarm.yml` prépare aussi le TLS edge sur l’hôte via le rôle `edge_tls` : installation de `certbot`, certificat autosigné de bootstrap, webroot ACME, émission/renouvellement Let’s Encrypt et hook de reload Nginx pour le service Swarm `edge`.

Le rôle `swarm_stack` précharge aussi les images backend/frontend visées, applique `./scripts/run_migrations.sh` **avant** `docker stack deploy`, puis laisse Swarm effectuer le rolling update applicatif. Ce séquencement est nécessaire pour éviter une coupure backend lors d’une release versionnée.

Attention : `harden-host-dev` / `deploy-swarm-dev` et `harden-host-prod` / `deploy-swarm-prod` s’exécutent sur des jobs GitHub Actions distincts. Si les runners n’ont pas une sortie réseau stable et autorisée par `SSH_TRUSTED_CIDRS`, le déploiement Swarm suivant peut être bloqué après activation d’UFW/SSH restrictif.

## Application

```bash
cd infrastructure/ansible
ansible-playbook -i inventories/prod/hosts.yml playbooks/harden_host.yml
```

## Remarques sécurité

- Ne stocke pas les secrets applicatifs dans Ansible en clair.
- Garde les fichiers secrets dans `/opt/betleague/secrets/` avec propriétaire `root`.
- Le certificat TLS edge public n'est plus injecté comme secret GitHub : la clé privée est générée et renouvelée sur l'hôte par Let’s Encrypt, puis copiée dans `/opt/betleague/shared/tls/edge/` avec permissions strictes.
- Les releases backend/frontend sans downtime supposent des migrations DB backward-compatible (_expand / contract_). Si une migration casse l’ancienne version backend, Swarm ne pourra pas garantir une continuité fonctionnelle malgré le rolling update `start-first`.
- Une fois le hardening appliqué, garde uniquement les CIDR administratifs strictement nécessaires dans `betleague_ssh_trusted_cidrs`.
- La politique UFW BetLeague bloque les nouvelles connexions Docker publiées autres que les ports explicitement autorisés dans `betleague_public_tcp_ports` (par défaut `80/443`).
- Fail2ban est aligné sur le port SSH réel (`betleague_ssh_port`), ignore `localhost` + les CIDR d’administration, applique des bannissements progressifs via l’action `ufw` et active aussi une jail `recidive` pour bannir plus longtemps les IP déjà sanctionnées à répétition.
- `betleague_ssh_trusted_cidrs` reste volontairement vide par défaut : le rôle échoue explicitement tant qu’au moins un CIDR d’administration valide n’est pas fourni, pour éviter toute ouverture SSH implicite ou tout lockout silencieux.
- Les changements de configuration Fail2ban utilisent un `reload` plutôt qu’un `restart`, afin de préserver autant que possible l’état des bans actifs.

















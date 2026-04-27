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
    ├── swarm_host/
    └── swarm_stack/
```

## Pré-requis

- Terraform déjà appliqué dans `../terraform`
- accès SSH par clé sur l'hôte
- au moins un CIDR de confiance à autoriser pour SSH

## Génération de l'inventaire

```bash
cd infrastructure
python3 scripts/render-ansible-inventory.py \
  --terraform-dir terraform \
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

En CI/CD, le workflow `/.github/workflows/terraform-ci.yml` enchaîne désormais, selon l’environnement ciblé :

1. `apply-dev` / `apply-prod`
2. `harden-host-dev` / `harden-host-prod` qui appelle `playbooks/harden_host.yml`
3. `deploy-swarm-dev` / `deploy-swarm-prod` qui appelle `playbooks/deploy_swarm.yml`

Les jobs `harden-host-dev` et `harden-host-prod` attendent la variable GitHub Environment `SSH_TRUSTED_CIDRS` pour construire `betleague_ssh_trusted_cidrs`.

Les jobs `deploy-swarm-dev` et `deploy-swarm-prod` construisent aussi un `swarm-vars.json` qui injecte explicitement `GUNICORN_WORKERS` et `GUNICORN_FORWARDED_ALLOW_IPS` dans le rôle `swarm_stack`, sans dépendre de `backend.env` pour ces paramètres de runtime Gunicorn.

Attention : `harden-host-dev` / `deploy-swarm-dev` et `harden-host-prod` / `deploy-swarm-prod` s’exécutent sur des jobs GitHub Actions distincts. Si les runners n’ont pas une sortie réseau stable et autorisée par `SSH_TRUSTED_CIDRS`, le déploiement Swarm suivant peut être bloqué après activation d’UFW/SSH restrictif.

## Application

```bash
cd infrastructure/ansible
ansible-playbook -i inventories/prod/hosts.yml playbooks/harden_host.yml
```

## Remarques sécurité

- Ne stocke pas les secrets applicatifs dans Ansible en clair.
- Garde les fichiers secrets dans `/opt/betleague/secrets/` avec propriétaire `root`.
- Une fois le hardening appliqué, garde uniquement les CIDR administratifs strictement nécessaires dans `betleague_ssh_trusted_cidrs`.
- La politique UFW BetLeague bloque les nouvelles connexions Docker publiées autres que les ports explicitement autorisés dans `betleague_public_tcp_ports` (par défaut `80/443`).
- Fail2ban est aligné sur le port SSH réel (`betleague_ssh_port`), ignore `localhost` + les CIDR d’administration, applique des bannissements progressifs via l’action `ufw` et active aussi une jail `recidive` pour bannir plus longtemps les IP déjà sanctionnées à répétition.
- `betleague_ssh_trusted_cidrs` reste volontairement vide par défaut : le rôle échoue explicitement tant qu’au moins un CIDR d’administration valide n’est pas fourni, pour éviter toute ouverture SSH implicite ou tout lockout silencieux.
- Les changements de configuration Fail2ban utilisent un `reload` plutôt qu’un `restart`, afin de préserver autant que possible l’état des bans actifs.













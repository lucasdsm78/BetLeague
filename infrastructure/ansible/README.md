# Ansible sécurisé pour BetLeague (`VPS-3`)

Cette couche Ansible complète Terraform pour durcir l'hôte BetLeague après provisioning OVH.

## Objectifs

- fermeture SSH par mot de passe
- restriction UFW de SSH aux CIDR de confiance
- activation de `fail2ban`, `auditd` et `unattended-upgrades`
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
    └── docker_host/
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

## Application

```bash
cd infrastructure/ansible
ansible-playbook -i inventories/prod/hosts.yml playbooks/harden_host.yml
```

## Remarques sécurité

- Ne stocke pas les secrets applicatifs dans Ansible en clair.
- Garde les fichiers secrets dans `/opt/betleague/secrets/` avec propriétaire `root`.
- Une fois le hardening appliqué, garde uniquement les CIDR administratifs strictement nécessaires dans `betleague_ssh_trusted_cidrs`.




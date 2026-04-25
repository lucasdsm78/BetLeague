#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_ENV:?GITHUB_ENV is required}"

export_if_set() {
  local source_name="$1"
  local target_name="$2"
  local value="${!source_name-}"

  if [ -n "$value" ]; then
    printf '%s=%s\n' "$target_name" "$value" >> "$GITHUB_ENV"
  fi
}

export_if_set GH_TF_VAR_PROJECT_NAME TF_VAR_project_name
export_if_set GH_TF_VAR_ENVIRONMENT TF_VAR_environment
export_if_set GH_TF_VAR_INSTANCE_NAME TF_VAR_instance_name
export_if_set GH_TF_VAR_SSH_KEY_NAME TF_VAR_ssh_key_name
export_if_set GH_TF_VAR_SSH_KEY_PUBLIC_KEY TF_VAR_ssh_key_public_key
export_if_set GH_TF_VAR_SSH_AUTHORIZED_KEYS TF_VAR_ssh_authorized_keys
export_if_set GH_TF_VAR_ADMIN_USER TF_VAR_admin_user
export_if_set GH_TF_VAR_BILLING_PERIOD TF_VAR_billing_period
export_if_set GH_TF_VAR_PRIVATE_SUBNET_CIDR TF_VAR_private_subnet_cidr
export_if_set GH_TF_VAR_TIMEZONE TF_VAR_timezone
export_if_set GH_TF_VAR_ALLOWED_TCP_PORTS TF_VAR_allowed_tcp_ports
export_if_set GH_TF_VAR_DOCKER_USERS TF_VAR_docker_users
export_if_set GH_TF_VAR_EXTRA_PACKAGES TF_VAR_extra_packages
export_if_set GH_TF_VAR_ENABLE_FAIL2BAN TF_VAR_enable_fail2ban
export_if_set GH_TF_VAR_COMPOSE_ROOT TF_VAR_compose_root
export_if_set GH_TF_VAR_CREATE_DNS_RECORDS TF_VAR_create_dns_records
export_if_set GH_TF_VAR_DNS_ZONE TF_VAR_dns_zone
export_if_set GH_TF_VAR_DNS_DEFAULT_TTL TF_VAR_dns_default_ttl
export_if_set GH_TF_VAR_APP_SUBDOMAIN TF_VAR_app_subdomain
export_if_set GH_TF_VAR_API_SUBDOMAIN TF_VAR_api_subdomain


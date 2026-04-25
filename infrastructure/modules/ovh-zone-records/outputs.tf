output "record_ids" {
  description = "IDs des enregistrements DNS OVH créés, indexés par clé logique."
  value = {
    for key, record in ovh_domain_zone_record.this : key => record.id
  }
}

output "records" {
  description = "Représentation normalisée des enregistrements DNS gérés par le module."
  value       = local.normalized_records
}


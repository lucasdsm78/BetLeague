#!/usr/bin/env bash
set -euo pipefail

# Generate self-signed TLS certificates for NATS (dev/test).
# Usage: ./generate-certs.sh [output_dir]
#
# Production: use proper PKI / Let's Encrypt / Vault PKI.

DIR="${1:-$(dirname "$0")/certs}"
mkdir -p "$DIR"

echo "Generating NATS TLS certs in $DIR ..."

# CA (self-signed root)
openssl req -x509 -nodes -days 365 \
  -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
  -keyout "$DIR/ca-key.pem" \
  -out "$DIR/ca-cert.pem" \
  -subj "/CN=BetLeague NATS CA"

# Server cert signed by CA
openssl req -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
  -keyout "$DIR/server-key.pem" \
  -out "$DIR/server.csr" \
  -subj "/CN=nats"

openssl x509 -req -days 365 \
  -in "$DIR/server.csr" \
  -CA "$DIR/ca-cert.pem" -CAkey "$DIR/ca-key.pem" -CAcreateserial \
  -out "$DIR/server-cert.pem" \
  -extfile <(printf "subjectAltName=DNS:nats,DNS:localhost,IP:127.0.0.1")

# Client cert signed by same CA (for mTLS)
openssl req -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
  -keyout "$DIR/client-key.pem" \
  -out "$DIR/client.csr" \
  -subj "/CN=betleague-client"

openssl x509 -req -days 365 \
  -in "$DIR/client.csr" \
  -CA "$DIR/ca-cert.pem" -CAkey "$DIR/ca-key.pem" -CAcreateserial \
  -out "$DIR/client-cert.pem"

# Cleanup CSRs
rm -f "$DIR"/*.csr "$DIR"/*.srl

chmod 600 "$DIR"/*-key.pem
chmod 644 "$DIR"/*-cert.pem

echo "Done. Files:"
ls -la "$DIR"/*.pem

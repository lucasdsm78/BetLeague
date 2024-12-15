from cryptography.fernet import Fernet
import secrets

# Générer une clé sécurisée
def generate_fernet_key() -> str:
    return Fernet.generate_key().decode()

def generate_jwt_secret() -> str:
    return secrets.token_urlsafe(32)  # Génère une chaîne de 43 caractères

# Exemple d'utilisation
if __name__ == "__main__":
    key = generate_fernet_key()
    jwt_secret = generate_jwt_secret()
    print(f"Clé JWT sécurisée : {jwt_secret}")
    print(f"Clé Fernet sécurisée : {key}")

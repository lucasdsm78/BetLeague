class InvalidPlatformException(Exception):
    message = "Cette plateforme n'est pas valide pour cet achat"

    def __init__(self, platform: str):
        self.platform = platform

    def __str__(self):
        return f"{self.platform} n'est pas une plateforme valide"


class InvalidPurchaseStatusException(Exception):
    message = "Ce statut d'achat n'est pas valide"

    def __init__(self, status: str):
        self.status = status

    def __str__(self):
        return f"{self.status} n'est pas un statut d'achat valide"


class PurchaseNotFoundError(Exception):
    message = "L'achat n'existe pas."

    def __str__(self):
        return PurchaseNotFoundError.message


class InvalidWebhookError(Exception):
    message = "Signature webhook invalide."

    def __str__(self):
        return InvalidWebhookError.message

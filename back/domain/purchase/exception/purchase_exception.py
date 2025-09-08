class InvalidPlatformException(Exception):
    message = "This platform is not a valid ticket platform"

    def __init__(self, platform: str):
        self.platform = platform

    def __str__(self):
        return f"{self.platform} is not a valid platform"


class InvalidPurchaseStatusException(Exception):
    message = "This purchase status is not a valid purchase status"

    def __init__(self, status: str):
        self.status = status

    def __str__(self):
        return f"{self.status} is not a purchase status"


class PurchaseNotFoundError(Exception):
    message = "The purchase does not exist."

    def __str__(self):
        return PurchaseNotFoundError.message


class InvalidWebhookError(Exception):
    message = "Signature webhook invalide."

    def __str__(self):
        return InvalidWebhookError.message

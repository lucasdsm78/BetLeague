class PackNotFoundError(Exception):
    message = "Le pack n'existe pas."

    def __str__(self):
        return PackNotFoundError.message

class PackNotFoundError(Exception):
    message = "The pack does not exist."

    def __str__(self):
        return PackNotFoundError.message

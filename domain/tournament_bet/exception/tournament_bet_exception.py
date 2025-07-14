class NotEnoughBTLError(Exception):
    message = "Not enough BTL to place bet"

    def __str__(self) -> str:
        return NotEnoughBTLError.message


class BetAlreadyExistsError(Exception):
    message = "Bet already exists for this match"

    def __str__(self) -> str:
        return BetAlreadyExistsError.message

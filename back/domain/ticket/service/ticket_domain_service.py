from decimal import Decimal, ROUND_HALF_UP
from typing import List


class TicketDomainService:
    """Domain service for ticket business logic.

    Gain calculation belongs here, not in the infrastructure layer.
    """

    @staticmethod
    def calculate_gain(odd_values: List[Decimal], mise: int) -> float:
        total = Decimal("1.0")
        for odd in odd_values:
            total *= odd
        result = Decimal(str(mise)) * total
        return float(result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

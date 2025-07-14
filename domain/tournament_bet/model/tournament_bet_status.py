from enum import Enum

class TournamentBetStatus(Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"

    @staticmethod
    def from_str(status: str) -> "TournamentBetStatus":
        for s in TournamentBetStatus:
            if s.value == status:
                return s
        raise ValueError(f"Unknown status: {status}")

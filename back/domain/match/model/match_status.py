from enum import Enum
from dataclasses import dataclass

from domain.match.exception.match_exception import InvalidMatchStatusException


@dataclass(init=False, eq=True, frozen=True)
class MatchStatus(Enum):
    NOT_STARTED = "NS"
    FIRST_HALF = "1H"
    HALFTIME = "HT"
    SECOND_HALF = "2H"
    EXTRA_TIME = "ET"
    PENALTIES = "PEN"
    FINISHED = "FT"
    FINISHED_AFTER_EXTRA = "AET"
    FINISHED_AFTER_PEN = "AP"
    BREAK_TIME = "BT"
    SUSPENDED = "SUSP"
    INTERRUPTED = "INT"
    POSTPONED = "PST"
    CANCELLED = "CANC"
    ABANDONED = "ABD"
    TECHNICAL_LOSS = "AWD"
    WALKOVER = "WO"
    LIVE = "LIVE"

    def is_finished(self) -> bool:
        return self in (
            MatchStatus.FINISHED,
            MatchStatus.FINISHED_AFTER_EXTRA,
            MatchStatus.FINISHED_AFTER_PEN,
            MatchStatus.TECHNICAL_LOSS,
            MatchStatus.WALKOVER,
        )

    def is_live(self) -> bool:
        return self in (
            MatchStatus.FIRST_HALF,
            MatchStatus.HALFTIME,
            MatchStatus.SECOND_HALF,
            MatchStatus.EXTRA_TIME,
            MatchStatus.PENALTIES,
            MatchStatus.BREAK_TIME,
            MatchStatus.LIVE,
        )

    def is_cancelled(self) -> bool:
        return self in (
            MatchStatus.CANCELLED,
            MatchStatus.ABANDONED,
            MatchStatus.SUSPENDED,
            MatchStatus.POSTPONED,
        )

    @classmethod
    def from_str(cls, status: str) -> "MatchStatus":
        try:
            return cls(status)
        except ValueError:
            raise InvalidMatchStatusException(status) from None

from dataclasses import dataclass
from enum import Enum

from domain.tournament.exception.tournament_exception import InvalidStageTypeException


@dataclass(init=False, eq=True, frozen=True)
class StageType(Enum):
    EIGHTH_FINAL = "eighth_final"
    QUARTER_FINAL = "quarter_final"
    SEMI_FINAL = "semi_final"
    FINAL = "final"

    @classmethod
    def from_str(cls, stage_type: str) -> "StageType":
        try:
            return cls(stage_type)
        except ValueError:
            raise InvalidStageTypeException(stage_type) from None

from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from application.match.match_query_model import MatchOddReadModel


class MatchOddsByMatchIdsResponse(BaseModel):
    odds_by_match_id: Dict[int, List[MatchOddReadModel]] = Field(default_factory=dict)


class MatchOddsQueryParams(BaseModel):
    match_ids: List[int] = Field(default_factory=list)
    bet_type: Optional[str] = None


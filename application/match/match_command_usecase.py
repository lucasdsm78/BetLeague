from abc import ABC, abstractmethod
from datetime import datetime

from application.match.match_command_model import NoMatchScoreUpdatedResponse, MatchScoreUpdatedResponse
from domain.match.model.match_possibility import MatchPossibility
from domain.match.repository.match_repository import MatchRepository
from domain.services.match_score_api.match_score_api import MatchScoreApi
from domain.token.token_exception import TokenInvalidError
from domain.utils.are_similar import are_similar
from infrastructure.config import Settings


class MatchCommandUseCase(ABC):

    @abstractmethod
    def check_scores(self, token: str, from_date: datetime, to_date: datetime):
        raise NotImplementedError


class MatchCommandUseCaseImpl(MatchCommandUseCase):

    def __init__(
            self,
            match_repository: MatchRepository,
            match_score_api: MatchScoreApi,
            settings: Settings
    ):
        self.match_repository: MatchRepository = match_repository
        self.settings: Settings = settings
        self.match_score_api: MatchScoreApi = match_score_api

    def check_scores(self, token: str, from_date: datetime, to_date: datetime):
        try:
            if token != self.settings.secret_key_token:
                raise TokenInvalidError

            matches = self.match_repository.get_matches_from_dates(to_date=to_date, from_date=from_date)
            matches_from_api = self.match_score_api.get_matches_finished()
            updated = False

            if len(matches_from_api) != 0 and matches is not None:
                for match in matches:
                    for match_api in matches_from_api:
                        if are_similar(match_api["homeTeam"]["shortName"], match.home_team) \
                                and are_similar(match_api["awayTeam"]["shortName"], match.away_team):
                            if match_api["score"]["winner"] == MatchPossibility.home_team_winner.value:
                                match.winner = 1
                            elif match_api["score"]["winner"] == MatchPossibility.away_team_winner.value:
                                match.winner = 2
                            else:
                                match.winner = "N"
                        self.match_repository.update(match)
                        self.match_repository.commit()
                        updated = True
            if updated:
                return MatchScoreUpdatedResponse()
            else:
                return NoMatchScoreUpdatedResponse()

        except:
            self.match_repository.rollback()
            raise

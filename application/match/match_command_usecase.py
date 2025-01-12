from abc import ABC
from domain.match.repository.match_repository import MatchRepository
from domain.services.match_score_api.match_score_api import MatchScoreApi
from infrastructure.config import Settings


class MatchCommandUseCase(ABC):
    pass


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

from abc import ABC, abstractmethod
from typing import Callable, List, Dict, Any

from sqlalchemy.ext.asyncio.session import AsyncSession

from application.match.match_command_model import NoMatchScoreUpdatedResponse, MatchScoreUpdatedResponse
from domain.match.event.match_winner_updated_event import MatchWinnerUpdatedEvent, MatchUpdatedEvent
from domain.match.model.match_possibility import MatchPossibility
from domain.match.repository.match_repository import MatchRepository
from domain.services.match_score_api.match_score_api import MatchScoreApi
from domain.services.rabbitmq.publisher import RabbitMQPublisher
from domain.services.rabbitmq.publisher_score_service import RabbitMQPublisherScoreService
from domain.token.token_exception import TokenInvalidError
from domain.utils.are_similar import are_similar
from infrastructure.config import Settings
from datetime import datetime
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl


class MatchCommandUseCase(ABC):

    @abstractmethod
    async def check_scores(self, token: str, from_date: datetime, to_date: datetime):
        raise NotImplementedError


class MatchCommandUseCaseImpl(MatchCommandUseCase):

    def __init__(
            self,
            match_repository: MatchRepository,
            match_score_api: MatchScoreApi,
            settings: Settings,
            session_factory: Callable[[], AsyncSession],
            publisher: RabbitMQPublisherScoreService,
            similarity_threshold: int = 70,
    ):
        self.match_repository: MatchRepository = match_repository
        self.settings: Settings = settings
        self.match_score_api: MatchScoreApi = match_score_api
        self.publisher: RabbitMQPublisherScoreService = publisher
        self._session_factory = session_factory
        self._similarity_threshold = similarity_threshold


    async def check_scores(self, token: str, from_date: datetime, to_date: datetime):
        if token != self.settings.secret_key_token:
            raise TokenInvalidError()

        await self.publisher.connect()

        async with self._session_factory() as session:
            async with session.begin():
                repo = MatchRepositoryImpl(session=session)

                matches = await repo.get_matches_from_dates(from_date, to_date)
                if not matches:
                    return NoMatchScoreUpdatedResponse()

                api_matches: List[Dict[str, Any]] = await self.match_score_api.get_matches_finished(from_date, to_date)
                if not api_matches:
                    return NoMatchScoreUpdatedResponse()

                to_update = []
                events = []

                for m in matches:
                    matched_api = next(
                        (
                            api_m for api_m in api_matches
                            if (are_similar(api_m["home"], m.home_team, self._similarity_threshold) and
                                are_similar(api_m["away"], m.away_team, self._similarity_threshold))
                               or  # Try reversed team order in case they're swapped
                               (are_similar(api_m["home"], m.away_team, self._similarity_threshold) and
                                are_similar(api_m["away"], m.home_team, self._similarity_threshold))
                        ),
                        None
                    )
                    if not matched_api:
                        continue

                    # Check if teams were matched in reverse order
                    teams_reversed = (
                            are_similar(matched_api["home"], m.away_team, self._similarity_threshold) and
                            are_similar(matched_api["away"], m.home_team, self._similarity_threshold)
                    )

                    api_winner = matched_api.get("winner")

                    # Adjust winner based on whether teams were matched in reverse
                    if teams_reversed:
                        if api_winner == MatchPossibility.home_team_winner.value:
                            new_w = "1"  # Away win because teams are reversed
                        elif api_winner == MatchPossibility.away_team_winner.value:
                            new_w = "2"  # Home win because teams are reversed
                        else:
                            new_w = "N"
                    else:
                        if api_winner == MatchPossibility.home_team_winner.value:
                            new_w = "1"
                        elif api_winner == MatchPossibility.away_team_winner.value:
                            new_w = "2"
                        else:
                            new_w = "N"

                    if m.winner != new_w:
                        to_update.append({"id": m.id, "winner": new_w})
                        events.append(MatchUpdatedEvent(match_id=m.id, event_type="MatchUpdatedEvent"))

                if to_update:
                    await repo.bulk_update_winner(to_update)
                    for ev in events:
                        await self.publisher.publish_match_winner_updated(ev)
                    return MatchScoreUpdatedResponse()

                return NoMatchScoreUpdatedResponse()

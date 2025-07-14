from abc import ABC, abstractmethod
from typing import Callable
from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.tournament_bet_command_model import TournamentBetCreateModel, TournamentBetCreateResponse
from domain.tournament_bet.exception.tournament_bet_exception import NotEnoughBTLError, BetAlreadyExistsError
from domain.tournament_bet.model.tournament_bet import TournamentBet
from domain.tournament_bet.model.tournament_bet_status import TournamentBetStatus
from domain.tournament_bet.repository.tournament_bet_repository import TournamentBetRepository
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.tournament_bet.tournament_bet_repository import TournamentBetRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class TournamentBetCommandUseCase(ABC):
    @abstractmethod
    async def place_bet(self, tournament_id: int, match_id: int, bet: TournamentBetCreateModel, email: str) -> TournamentBetCreateResponse:
        raise NotImplementedError


class TournamentBetCommandUseCaseImpl(TournamentBetCommandUseCase):
    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory

    async def place_bet(self, tournament_id: int, match_id: int, bet: TournamentBetCreateModel, email: str) -> TournamentBetCreateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo = UserRepositoryImpl(session)
                player_repo = TournamentPlayersRepositoryImpl(session)
                match_repo = TournamentMatchRepositoryImpl(session)
                bet_repo = TournamentBetRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                player = await player_repo.get_player(tournament_id, user.id)
                if not player or player.is_eliminated:
                    raise UserNotFoundError

                if player.nb_btl < bet.amount:
                    raise NotEnoughBTLError

                existing = await bet_repo.find_by_player_match(player.id, match_id)
                if existing:
                    raise BetAlreadyExistsError

                match = await match_repo.find_by_id(match_id)
                if not match or match.tournament_id != tournament_id:
                    raise ValueError("Match not found")

                player.nb_btl -= bet.amount
                await player_repo.update(player)

                bet_entity = TournamentBet(
                    player_id=player.id,
                    match_id=match_id,
                    amount=bet.amount,
                    choice=bet.choice,
                    status=TournamentBetStatus.PENDING,
                )
                await bet_repo.add(bet_entity)

        return TournamentBetCreateResponse()

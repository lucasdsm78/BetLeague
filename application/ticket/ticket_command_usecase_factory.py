from sqlalchemy.ext.asyncio import AsyncSession
from application.ticket.ticket_command_usecase import TicketCommandUseCaseImpl
from domain.services.rabbitmq.publisher import RabbitMQPublisher
from infrastructure.config import Settings
from infrastructure.postgresql.database import AsyncSessionLocal
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament import TournamentRepositoryImpl, TournamentPlayersRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl
from infrastructure.services.rabbitmq.publisher import RabbitMQPublisherImpl


def build_ticket_command_usecase(
        session: AsyncSession,
        settings: Settings,
) -> TicketCommandUseCaseImpl:
    ticket_repository = TicketRepositoryImpl(session=session)
    match_choice_repository = MatchChoicesRepositoryImpl(session=session)
    league_players_repository = LeaguePlayersRepositoryImpl(session=session)
    league_repository = LeagueRepositoryImpl(session=session)
    user_repo = UserRepositoryImpl(session=session)
    match_repository = MatchRepositoryImpl(session=session)
    league_players_repository = LeaguePlayersRepositoryImpl(session=session)
    tournament_repository = TournamentRepositoryImpl(session=session)
    tournament_players_repository = TournamentPlayersRepositoryImpl(session=session)
    publisher = RabbitMQPublisherImpl(settings=settings)

    return TicketCommandUseCaseImpl(
        ticket_repository=ticket_repository,
        settings=settings,
        session_factory=AsyncSessionLocal,
        match_choices_repository=match_choice_repository,
        league_players_repository=league_players_repository,
        user_repository=user_repo,
        match_repository=match_repository,
        tournament_repository=tournament_repository,
        tournament_players_repository=tournament_players_repository,
        publisher=publisher,
        league_repository=league_repository
    )

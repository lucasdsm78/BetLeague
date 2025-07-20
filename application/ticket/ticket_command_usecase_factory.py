from sqlmodel.ext.asyncio.session import AsyncSession

from application.ticket.ticket_command_usecase import TicketCommandUseCaseImpl
from infrastructure.config import Settings
from infrastructure.postgresql.database import AsyncSessionLocal
from infrastructure.services.rabbitmq.publisher import RabbitMQPublisherImpl

from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl


def build_ticket_command_usecase(
        session: AsyncSession,
        settings: Settings,
) -> TicketCommandUseCaseImpl:
    match_repo = MatchRepositoryImpl(session=session)
    match_choices_repo = MatchChoicesRepositoryImpl(session=session)

    publisher = RabbitMQPublisherImpl(settings=settings)

    return TicketCommandUseCaseImpl(
        session_factory=AsyncSessionLocal,
        match_choices_repository=match_choices_repo,
        match_repository=match_repo,
        settings=settings,
        publisher=publisher
    )

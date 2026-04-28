from application.ticket.ticket_command_usecase import TicketCommandUseCaseImpl
from infrastructure.config import Settings
from infrastructure.postgresql.database import AsyncSessionLocal
from infrastructure.postgresql.ticket.ticket_unit_of_work import TicketUnitOfWorkImpl


def build_ticket_command_usecase(
        settings: Settings,
) -> TicketCommandUseCaseImpl:
    return TicketCommandUseCaseImpl(
        uow_factory=lambda: TicketUnitOfWorkImpl(session_factory=AsyncSessionLocal),
        settings=settings,
    )

from application.league.league_command_usecase import LeagueCommandUseCase, LeagueCommandUseCaseImpl
from application.league.league_query_usecase import LeagueQueryUseCase, LeagueQueryUseCaseImpl
from application.match.match_command_usecase import MatchCommandUseCase, MatchCommandUseCaseImpl
from application.match.match_query_usecase import MatchQueryUseCase, MatchQueryUseCaseImpl
from application.purchase.purchase_command_usecase import PurchaseCommandUseCase, PurchaseCommandUseCaseImpl
from application.purchase.purchase_query_usecase import PurchaseQueryUseCase, PurchaseQueryUseCaseImpl
from application.ticket.ticket_command_usecase import TicketCommandUseCase, TicketCommandUseCaseImpl
from application.ticket.ticket_query_usecase import TicketQueryUseCaseImpl, TicketQueryUseCase
from application.tournament_subscription.cancel.cancel_tournament_subscription_usecase import \
    CancelTournamentSubscriptionUseCase, CancelTournamentSubscriptionUseCaseImpl
from application.tournament_subscription.create.create_tournament_subscription_usecase import CreateTournamentSubscriptionUseCase, \
    CreateTournamentSubscriptionUseCaseImpl
from application.tournament_subscription.webhook.process_stripe_webhook import \
    ProcessStripeWebhookTournamentSubscriptionUseCase, ProcessStripeWebhookTournamentSubscriptionUseCaseImpl
from application.user.user_command_usecase import UserCommandUseCase, UserCommandUseCaseImpl
from application.user.user_query_usecase import UserQueryUseCase, UserQueryUseCaseImpl
from application.tournament.tournament_command_usecase import TournamentCommandUseCase, TournamentCommandUseCaseImpl
from application.tournament.tournament_query_usecase import TournamentQueryUseCase, TournamentQueryUseCaseImpl
from application.notification.notification_command_usecase import NotificationCommandUseCase
from application.notification.notification_command_usecase_impl import NotificationCommandUseCaseImpl
from application.notification.notification_query_usecase import NotificationQueryUseCase
from application.notification.notification_query_usecase_impl import NotificationQueryUseCaseImpl
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.purchase.repository.pack_repository import PackRepository
from domain.purchase.repository.purchase_repository import PurchaseRepository
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.totp_service import TOTPService
from domain.services.match_score_api.match_score_api import MatchScoreApi
from domain.services.rabbitmq.publisher import RabbitMQPublisher
from domain.services.rabbitmq.publisher_score_service import RabbitMQPublisherScoreService
from domain.services.stripe.stripe_service import StripeService
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from domain.tournament_subscription.repository.tournament_subscription_repository import \
    TournamentSubscriptionRepository
from domain.tournament_subscription.service.tournament_subscription_domain_service import SubscriptionDomainService
from domain.tournament.exception.tournament_exception import UserNotSubscribedError
from domain.user.model.user import User
from domain.user.repository.user_repository import UserRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from domain.notification.repository.notification_repository import NotificationRepository

from functools import lru_cache
from typing import Iterator, AsyncGenerator, Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm.session import Session

from infrastructure.config import Settings
from infrastructure.postgresql.database import AsyncSessionLocal
from infrastructure.postgresql.invitation.invitation_repository import InvitationRepositoryImpl
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.purchase.pack_repository import PackRepositoryImpl
from infrastructure.postgresql.purchase.purchase_repository import PurchaseRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_stage_repository import TournamentStageRepositoryImpl
from infrastructure.postgresql.tournament_subscription.tournament_subscription_repository import \
    TournamentSubscriptionRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl
from infrastructure.scheduler.tournament_scheduler import TournamentScheduler, TournamentSchedulerImpl
from infrastructure.services.authentication.authentication import AuthenticationToken
from infrastructure.services.authentication.hash import HashImpl
from infrastructure.services.authentication.jwt_bearer import JwtBearer
from infrastructure.services.authentication.manager_token import JwtManagerTokenImpl
from infrastructure.services.authentication.totp_service import TOTPServiceImpl
from infrastructure.services.match_score_api.match_score_api import MatchScoreApiImpl
from sqlalchemy.ext.asyncio import AsyncSession
from infrastructure.services.rabbitmq.publisher import RabbitMQPublisherImpl
from infrastructure.services.rabbitmq.publisher_score_service import RabbitMQPublisherScoreServiceImpl
from infrastructure.services.stripe.stripe_service import StripeServiceImpl
from infrastructure.postgresql.notification.notification_repository import NotificationRepositoryImpl
from infrastructure.services.notification.notifications_hub import NotificationsHub
from application.events.event_bus import InProcessDomainEventBus, DomainEventBus
from domain.league.events.league_invitation_created import LeagueInvitationCreated
from application.notification.handlers.league_invitation_notification_handler import OnLeagueInvitationCreatedCreateNotification
from domain.services.notification.notification_realtime_publisher import NotificationRealtimePublisher
from application.events.outbox_event_bus import OutboxDomainEventBus

jwt_auth = JwtBearer()


def get_session() -> Iterator[Session]:
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        session.close()

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            pass

def get_session_factory() -> Callable[[], AsyncSession]:
    return AsyncSessionLocal

@lru_cache()
def get_settings() -> Settings:
    return Settings()


def manager_token_dependency(settings: Settings = Depends(get_settings)) -> ManagerToken:
    return JwtManagerTokenImpl(settings=settings)


def hash_dependency() -> Hash:
    return HashImpl()


def totp_service() -> TOTPService:
    return TOTPServiceImpl()


def match_score_api(settings: Settings = Depends(get_settings)) -> MatchScoreApi:
    return MatchScoreApiImpl(settings=settings)


def user_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> UserRepository:
    return UserRepositoryImpl(session)


def ticket_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TicketRepository:
    return TicketRepositoryImpl(session)


def match_choices_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> MatchChoiceRepository:
    return MatchChoicesRepositoryImpl(session)


def league_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> LeagueRepository:
    return LeagueRepositoryImpl(session)


def league_players_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> LeaguePlayersRepository:
    return LeaguePlayersRepositoryImpl(session)


def tournament_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentRepository:
    return TournamentRepositoryImpl(session)


def tournament_stage_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentStageRepository:
    return TournamentStageRepositoryImpl(session)


def tournament_players_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentPlayersRepository:
    return TournamentPlayersRepositoryImpl(session)


def tournament_match_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentMatchRepository:
    return TournamentMatchRepositoryImpl(session)


def match_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> MatchRepository:
    return MatchRepositoryImpl(session)


def invitation_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> InvitationRepository:
    return InvitationRepositoryImpl(session)

def user_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        user_repository: UserRepository = Depends(user_repository_dependency),
        hasher: Hash = Depends(hash_dependency),
        manager_token: ManagerToken = Depends(manager_token_dependency),
        totp_service: TOTPService = Depends(totp_service),
        settings: Settings = Depends(get_settings)
) -> UserCommandUseCase:
    return UserCommandUseCaseImpl(
        user_repository=user_repository,
        hasher=hasher,
        session_factory=session_factory,
        manager_token=manager_token,
        totp_service=totp_service,
        settings=settings
    )


def notification_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> NotificationRepository:
    sf = get_session_factory()
    class _Repo(NotificationRepository):
        async def create(self, notification):
            async with sf() as s:
                async with s.begin():
                    return await NotificationRepositoryImpl(s).create(notification)

        async def list_by_user(self, user_id: int, limit: int, cursor):
            async with sf() as s:
                return await NotificationRepositoryImpl(s).list_by_user(user_id=user_id, limit=limit, cursor=cursor)

        async def unread_count(self, user_id: int) -> int:
            async with sf() as s:
                return await NotificationRepositoryImpl(s).unread_count(user_id=user_id)

        async def mark_read(self, user_id: int, notification_id: int, read_at: int) -> None:
            async with sf() as s:
                async with s.begin():
                    await NotificationRepositoryImpl(s).mark_read(user_id=user_id, notification_id=notification_id, read_at=read_at)

        async def mark_all_read(self, user_id: int, read_at: int) -> int:
            async with sf() as s:
                async with s.begin():
                    return await NotificationRepositoryImpl(s).mark_all_read(user_id=user_id, read_at=read_at)

        async def delete(self, user_id: int, notification_id: int) -> None:
            async with sf() as s:
                async with s.begin():
                    await NotificationRepositoryImpl(s).delete(user_id=user_id, notification_id=notification_id)

    return _Repo()


def notifications_hub() -> NotificationsHub:
    return _notifications_hub_singleton()


@lru_cache()
def _notifications_hub_singleton() -> NotificationsHub:
    return NotificationsHub()


def notification_realtime_publisher_dependency() -> NotificationRealtimePublisher:
    return notifications_hub()


def notification_command_usecase(
    session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
    notification_repository: NotificationRepository = Depends(notification_repository_dependency),
    realtime_publisher: NotificationRealtimePublisher = Depends(notification_realtime_publisher_dependency),
) -> NotificationCommandUseCase:
    return NotificationCommandUseCaseImpl(
        notification_repository=notification_repository,
        realtime_publisher=realtime_publisher,
        session_factory=session_factory,
    )


def notification_query_usecase(
    session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
    notification_repository: NotificationRepository = Depends(notification_repository_dependency),
) -> NotificationQueryUseCase:
    return NotificationQueryUseCaseImpl(
        notification_repository=notification_repository,
        session_factory=session_factory,
    )


@lru_cache()
def domain_event_bus_singleton() -> InProcessDomainEventBus:
    bus = InProcessDomainEventBus()
    return bus


def domain_event_bus_dependency(
    session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> DomainEventBus:
    class _Bus(DomainEventBus):
        async def publish(self, event):
            async with session_factory() as session:
                async with session.begin():
                    await OutboxDomainEventBus(session).publish(event)

    return _Bus()


class _OutOfFastAPINotificationRepositoryProxy(NotificationRepository):
    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory

    async def create(self, notification):
        async with self._session_factory() as session:
            async with session.begin():
                return await NotificationRepositoryImpl(session).create(notification)

    async def list_by_user(self, user_id: int, limit: int, cursor):
        async with self._session_factory() as session:
            return await NotificationRepositoryImpl(session).list_by_user(user_id=user_id, limit=limit, cursor=cursor)

    async def unread_count(self, user_id: int) -> int:
        async with self._session_factory() as session:
            return await NotificationRepositoryImpl(session).unread_count(user_id=user_id)

    async def mark_read(self, user_id: int, notification_id: int, read_at: int) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                return await NotificationRepositoryImpl(session).mark_read(user_id=user_id, notification_id=notification_id, read_at=read_at)

    async def mark_all_read(self, user_id: int, read_at: int) -> int:
        async with self._session_factory() as session:
            async with session.begin():
                return await NotificationRepositoryImpl(session).mark_all_read(user_id=user_id, read_at=read_at)


def outbox_handler_bus_dependency(
    notification_uc: NotificationCommandUseCase | None = None,
) -> InProcessDomainEventBus:
    if notification_uc is None:
        # Utilisation hors FastAPI (scripts): on résout manuellement.
        sf = get_session_factory()
        notification_uc = NotificationCommandUseCaseImpl(
            notification_repository=_OutOfFastAPINotificationRepositoryProxy(sf),
            realtime_publisher=notification_realtime_publisher_dependency(),
            session_factory=sf,
        )
    bus = domain_event_bus_singleton()
    if not getattr(bus, '_betleague_handlers_registered', False):
        bus.subscribe(
            LeagueInvitationCreated,
            OnLeagueInvitationCreatedCreateNotification(notification_uc),
        )
        setattr(bus, '_betleague_handlers_registered', True)
    return bus


def league_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency),
        invitation_repository: InvitationRepository = Depends(invitation_repository_dependency),
        event_bus: DomainEventBus = Depends(domain_event_bus_dependency),
) -> LeagueCommandUseCase:
    return LeagueCommandUseCaseImpl(
        session_factory=session_factory,
        league_repository=league_repository,
        user_repository=user_repository,
        league_players_repository=league_players_repository,
        invitation_repository=invitation_repository,
        event_bus=event_bus,
    )

def league_query_usecase(
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency),
        user_repository_dependency: UserRepository = Depends(user_repository_dependency),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        invitation_repository_dependency: InvitationRepository = Depends(invitation_repository_dependency),
) -> LeagueQueryUseCase:
    return LeagueQueryUseCaseImpl(
        league_players_repository=league_players_repository,
        user_repository=user_repository_dependency,
        league_repository=league_repository,
        invitation_repository=invitation_repository_dependency,
    )

def ticket_query_usecase(
        match_choices_repository: MatchChoiceRepository = Depends(match_choices_repository_dependency),
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        user_repository_dependency: UserRepository = Depends(user_repository_dependency),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        match_repository: MatchRepository = Depends(match_repository_dependency),
        ticket_repository: TicketRepository = Depends(ticket_repository_dependency)
) -> TicketQueryUseCase:
    return TicketQueryUseCaseImpl(
        ticket_repository=ticket_repository,
        session_factory=session_factory,
        match_repository=match_repository,
        match_choices_repository=match_choices_repository,
        user_repository=user_repository_dependency,
        league_repository=league_repository
    )


def rabbitmq_dependency(settings: Settings = Depends(get_settings)) -> RabbitMQPublisher:
    return RabbitMQPublisherImpl(settings=settings)


def rabbitmq_dependency_score_service(settings: Settings = Depends(get_settings)) -> RabbitMQPublisherScoreService:
    return RabbitMQPublisherScoreServiceImpl(settings=settings)


def ticket_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        ticket_repository: TicketRepository = Depends(ticket_repository_dependency),
        match_choices_repository: MatchChoiceRepository = Depends(match_choices_repository_dependency),
        match_repository: MatchRepository = Depends(match_repository_dependency),
        tournament_repository: TournamentRepository = Depends(tournament_repository_dependency),
        tournament_players_repository: TournamentPlayersRepository = Depends(tournament_players_repository_dependency),
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency),
        publisher: RabbitMQPublisher = Depends(rabbitmq_dependency),
        settings: Settings = Depends(get_settings)
) -> TicketCommandUseCase:
    return TicketCommandUseCaseImpl(
        league_repository=league_repository,
        session_factory=session_factory,
        user_repository=user_repository,
        ticket_repository=ticket_repository,
        tournament_repository=tournament_repository,
        tournament_players_repository=tournament_players_repository,
        match_choices_repository=match_choices_repository,
        match_repository=match_repository,
        league_players_repository=league_players_repository,
        settings=settings,
        publisher=publisher
    )


def user_query_usecase(
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> UserQueryUseCase:
    return UserQueryUseCaseImpl(
        user_repository=user_repository
    )


def match_query_usecase(
        match_repository: MatchRepository = Depends(match_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> MatchQueryUseCase:
    return MatchQueryUseCaseImpl(
        match_repository=match_repository,
        user_repository=user_repository
    )


def match_command_usecase(
        match_repository: MatchRepository = Depends(match_repository_dependency),
        settings: Settings = Depends(get_settings),
        match_score_api_dependency: MatchScoreApi = Depends(match_score_api),
        publisher: RabbitMQPublisherScoreService = Depends(rabbitmq_dependency_score_service),
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> MatchCommandUseCase:
    return MatchCommandUseCaseImpl(
        match_repository=match_repository,
        settings=settings,
        match_score_api=match_score_api_dependency,
        publisher=publisher,
        session_factory=session_factory,
    )


def tournament_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory)
) -> TournamentCommandUseCase:
    return TournamentCommandUseCaseImpl(
        session_factory=session_factory
    )

def tournament_query_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        tournament_repository: TournamentRepository = Depends(tournament_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        stage_repository: TournamentStageRepository = Depends(tournament_stage_repository_dependency),
        tournament_match_repository: TournamentMatchRepository = Depends(tournament_match_repository_dependency)
) -> TournamentQueryUseCase:
    return TournamentQueryUseCaseImpl(
        session_factory=session_factory,
        tournament_repository=tournament_repository,
        user_repository=user_repository,
        tournament_stage_repository=stage_repository,
        tournament_match_repository=tournament_match_repository,
        stage_repository=stage_repository
    )

def tournament_scheduler(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> TournamentScheduler:
    return TournamentSchedulerImpl(
        session_factory=session_factory,
    )


async def authentication(
        manager_token: ManagerToken = Depends(manager_token_dependency),
        token: str = Depends(jwt_auth)
) -> str:
    token_authenticator = AuthenticationToken(
        manager_token=manager_token,
        token=token
    )
    return await token_authenticator.authentication()


async def current_user(
        token: str = Depends(authentication),
        manager_token: ManagerToken = Depends(manager_token_dependency)
) -> dict:
    decoded = await manager_token.verify_token(token)  # Use verify_token to check blacklist
    if decoded:
        decoded['token'] = token  # Add original token for logout operations
    return decoded


def stripe_service(settings: Settings = Depends(get_settings)) -> StripeService:
    return StripeServiceImpl(settings=settings)


def purchase_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> PurchaseRepository:
    return PurchaseRepositoryImpl(session=session)


def pack_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> PackRepository:
    return PackRepositoryImpl(session)


def purchase_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        user_repository: UserRepository = Depends(user_repository_dependency),
        purchase_repository: PurchaseRepository = Depends(purchase_repository_dependency),
        pack_repository: PackRepository = Depends(pack_repository_dependency),
        stripe_service_dependency: StripeService = Depends(stripe_service),
) -> PurchaseCommandUseCase:
    return PurchaseCommandUseCaseImpl(
        purchase_repository=purchase_repository,
        pack_repository=pack_repository,
        session_factory=session_factory,
        user_repository=user_repository,
        stripe_service=stripe_service_dependency,
    )


def purchase_query_usecase(
        pack_repository: PackRepository = Depends(pack_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> PurchaseQueryUseCase:
    return PurchaseQueryUseCaseImpl(
        pack_repository=pack_repository,
        user_repository=user_repository
    )

def tournament_subscription_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentSubscriptionRepository:
    return TournamentSubscriptionRepositoryImpl(session)


def tournament_subscription_domain_service_dependency(
        tournament_subscription_repository: TournamentSubscriptionRepository = Depends(tournament_subscription_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency)
):
    return SubscriptionDomainService(
        repository=tournament_subscription_repository,
       user_repository=user_repository,
    )

def create_tournament_subscription_use_case(
        stripe_service_dependency: StripeService = Depends(stripe_service),
        domain_service: SubscriptionDomainService = Depends(tournament_subscription_domain_service_dependency),
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory)
) -> CreateTournamentSubscriptionUseCase:
    return CreateTournamentSubscriptionUseCaseImpl(
        stripe_service=stripe_service_dependency,
        domain_service=domain_service,
        session_factory=session_factory,
    )

def cancel_tournament_subscription_use_case(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        stripe_service_dependency: StripeService = Depends(stripe_service),
) -> CancelTournamentSubscriptionUseCase:
    return CancelTournamentSubscriptionUseCaseImpl(
        session_factory=session_factory,
        stripe_service=stripe_service_dependency,
    )

def process_webhook_tournament_subscription_use_case(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> ProcessStripeWebhookTournamentSubscriptionUseCase:
    return ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(
        session_factory=session_factory,
    )


async def verify_tournament_subscription(
        current_user: dict = Depends(current_user),
        user_repository: UserRepository = Depends(user_repository_dependency),
        subscription_repository: TournamentSubscriptionRepository = Depends(tournament_subscription_repository_dependency),
) -> User:
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

    user = await user_repository.find_by_email(email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")

    subscription = await subscription_repository.find_active_by_user_id(user.id)
    if not subscription or not subscription.is_active():
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=UserNotSubscribedError.message)

    return user

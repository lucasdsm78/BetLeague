from __future__ import annotations
from infrastructure.postgresql.match.match_score_unit_of_work import MatchScoreUnitOfWorkImpl
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
from application.push_subscription.push_subscription_usecase import PushSubscriptionUseCase
from application.push_subscription.push_subscription_usecase_impl import PushSubscriptionUseCaseImpl
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.match.repository.match_odd_repository import MatchOddRepository
from domain.purchase.repository.pack_repository import PackRepository
from domain.purchase.repository.purchase_repository import PurchaseRepository
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.totp_service import TOTPService
from domain.match.model.sport import Sport
from domain.services.match_fetch_api.match_fetch_api import MatchFetchApi
from domain.services.match_score_api.match_score_api import MatchScoreApi
from domain.match.event.match_result_resolved_event import MatchResultResolvedEvent
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
from domain.push_subscription.repository.push_subscription_repository import PushSubscriptionRepository
from domain.services.push.web_push_service import WebPushService

from functools import lru_cache
from typing import Iterator, AsyncGenerator, Callable

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm.session import Session
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

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
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient
from infrastructure.services.api_sports.football_fetch_service import ApiSportsFootballFetchService
from infrastructure.services.api_sports.match_fetch_router import MultiSportMatchFetchRouter
from infrastructure.services.api_sports.score_service import ApiSportsScoreService
from application.match.match_fetch_usecase import MatchFetchUseCase, MatchFetchUseCaseImpl
from application.match.handlers.match_result_resolved_handler import OnMatchResultResolvedCheckChoices
from infrastructure.services.stripe.stripe_service import StripeServiceImpl
from infrastructure.postgresql.notification.notification_repository import NotificationRepositoryImpl
from infrastructure.postgresql.push_subscription.push_subscription_repository import PushSubscriptionRepositoryImpl
from infrastructure.services.push.web_push_service import WebPushServiceImpl
from infrastructure.services.notification.notifications_hub import NotificationsHub
from application.events.event_bus import InProcessDomainEventBus, DomainEventBus
from domain.league.events.league_invitation_created import LeagueInvitationCreated
from domain.league.events.league_invitation_accepted import LeagueInvitationAccepted
from domain.league.events.league_invitation_refused import LeagueInvitationRefused
from domain.league.events.league_started import LeagueStarted
from application.notification.handlers.league_invitation_notification_handler import OnLeagueInvitationCreatedCreateNotification
from application.notification.handlers.league_invitation_accepted_notification_handler import OnLeagueInvitationAcceptedCreateNotification
from application.notification.handlers.league_invitation_refused_notification_handler import OnLeagueInvitationRefusedCreateNotification
from application.notification.handlers.league_started_notification_handler import OnLeagueStartedCreateNotification
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from application.ticket.handlers.ticket_choices_resolved_handler import OnTicketChoicesResolvedCheckStatus
from domain.services.notification.notification_realtime_publisher import NotificationRealtimePublisher
from application.events.outbox_event_bus import OutboxDomainEventBus
from infrastructure.services.notification.redis_notification_realtime import (
    RedisNotificationRealtimePublisher,
)

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


from domain.services.authentication.token_blacklist import TokenBlacklistService
from infrastructure.services.authentication.token_blacklist_impl import build_token_blacklist


@lru_cache()
def token_blacklist_singleton() -> TokenBlacklistService:
    settings = get_settings()
    r = redis_client_singleton()
    return build_token_blacklist(settings=settings, redis=r)


def manager_token_dependency(
    settings: Settings = Depends(get_settings),
    blacklist: TokenBlacklistService = Depends(token_blacklist_singleton),
) -> ManagerToken:
    return JwtManagerTokenImpl(settings=settings, blacklist=blacklist)


def hash_dependency() -> Hash:
    return HashImpl()


def totp_service() -> TOTPService:
    return TOTPServiceImpl()


def match_score_api(settings: Settings = Depends(get_settings)) -> MatchScoreApi:
    return MatchScoreApiImpl(settings=settings)


@lru_cache()
def _api_sports_football_client() -> ApiSportsBaseClient:
    settings = get_settings()
    return ApiSportsBaseClient(
        base_url=settings.api_sports_football_url,
        api_key=settings.api_sports_key,
    )


def match_fetch_api_dep(settings: Settings = Depends(get_settings)) -> MatchFetchApi:
    client = _api_sports_football_client()
    league_ids = frozenset(int(x) for x in settings.api_sports_league_ids.split(","))
    football_service = ApiSportsFootballFetchService(client=client, league_ids=league_ids)
    return MultiSportMatchFetchRouter(services={
        Sport.FOOTBALL: football_service,
    })


def match_score_api_v2(settings: Settings = Depends(get_settings)) -> MatchScoreApi:
    client = _api_sports_football_client()
    return ApiSportsScoreService(client=client)


def match_fetch_usecase_dep(
        match_fetch_api_dependency: MatchFetchApi = Depends(match_fetch_api_dep),
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> MatchFetchUseCase:
    return MatchFetchUseCaseImpl(
        match_fetch_api=match_fetch_api_dependency,
        session_factory=session_factory,
    )


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


def match_odd_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> MatchOddRepository:
    from infrastructure.postgresql.match.match_odd_repository import MatchOddRepositoryImpl
    return MatchOddRepositoryImpl(session=session)


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
    settings = get_settings()
    if getattr(settings, "notifications_realtime_driver", "memory") == "redis":
        r = redis_client_singleton()
        if r is not None:
            return RedisNotificationRealtimePublisher(
                redis=r,
                channel_prefix=getattr(settings, "notifications_redis_channel_prefix", "betleague:notifications:user:"),
            )
    return notifications_hub()


@lru_cache()
def redis_client_singleton() -> Redis | None:
    settings = get_settings()
    if not getattr(settings, "redis_url", None):
        return None
    # redis_url doit inclure l'user ACL (ex: redis://notif:password@redis:6379/0)
    return Redis.from_url(
        settings.redis_url,
        decode_responses=False,
        socket_connect_timeout=2,
        socket_timeout=2,
        health_check_interval=30,
        retry_on_timeout=True,
    )


def notification_command_usecase(
    session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
    notification_repository: NotificationRepository = Depends(notification_repository_dependency),
    realtime_publisher: NotificationRealtimePublisher = Depends(notification_realtime_publisher_dependency),
) -> NotificationCommandUseCase:
    push_uc = None
    settings = get_settings()
    if settings.vapid_private_key and settings.vapid_public_key:
        try:
            push_uc = PushSubscriptionUseCaseImpl(
                push_subscription_repository=_PushSubscriptionRepositoryProxy(session_factory),
                web_push_service=web_push_service_singleton(),
                session_factory=session_factory,
            )
        except Exception:
            pass

    return NotificationCommandUseCaseImpl(
        notification_repository=notification_repository,
        realtime_publisher=realtime_publisher,
        session_factory=session_factory,
        push_subscription_uc=push_uc,
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

    async def delete(self, user_id: int, notification_id: int) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                await NotificationRepositoryImpl(session).delete(user_id=user_id, notification_id=notification_id)


def outbox_handler_bus_dependency(
    notification_uc: NotificationCommandUseCase | None = None,
) -> InProcessDomainEventBus:
    if notification_uc is None:
        # Utilisation hors FastAPI (scripts): on résout manuellement.
        sf = get_session_factory()
        push_uc = None
        settings = get_settings()
        if settings.vapid_private_key and settings.vapid_public_key:
            try:
                push_uc = PushSubscriptionUseCaseImpl(
                    push_subscription_repository=_PushSubscriptionRepositoryProxy(sf),
                    web_push_service=web_push_service_singleton(),
                    session_factory=sf,
                )
            except Exception:
                pass

        notification_uc = NotificationCommandUseCaseImpl(
            notification_repository=_OutOfFastAPINotificationRepositoryProxy(sf),
            realtime_publisher=notification_realtime_publisher_dependency(),
            session_factory=sf,
            push_subscription_uc=push_uc,
        )
    bus = domain_event_bus_singleton()
    if not getattr(bus, '_betleague_handlers_registered', False):
        bus.subscribe(
            LeagueInvitationCreated,
            OnLeagueInvitationCreatedCreateNotification(notification_uc),
        )
        bus.subscribe(
            LeagueInvitationAccepted,
            OnLeagueInvitationAcceptedCreateNotification(notification_uc),
        )
        bus.subscribe(
            LeagueInvitationRefused,
            OnLeagueInvitationRefusedCreateNotification(notification_uc),
        )
        bus.subscribe(
            LeagueStarted,
            OnLeagueStartedCreateNotification(notification_uc, session_factory=sf),
        )
        bus.subscribe(
            TicketChoicesResolvedEvent,
            OnTicketChoicesResolvedCheckStatus(session_factory=sf),
        )
        bus.subscribe(
            MatchResultResolvedEvent,
            OnMatchResultResolvedCheckChoices(session_factory=sf),
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


def ticket_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        settings: Settings = Depends(get_settings),
) -> TicketCommandUseCase:
    from infrastructure.postgresql.ticket.ticket_unit_of_work import TicketUnitOfWorkImpl
    return TicketCommandUseCaseImpl(
        uow_factory=lambda: TicketUnitOfWorkImpl(session_factory=session_factory),
        settings=settings,
    )


def user_query_usecase(
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> UserQueryUseCase:
    return UserQueryUseCaseImpl(
        user_repository=user_repository
    )


def match_query_usecase(
        match_repository: MatchRepository = Depends(match_repository_dependency),
        match_odd_repository: MatchOddRepository = Depends(match_odd_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
) -> MatchQueryUseCase:
    return MatchQueryUseCaseImpl(
        match_repository=match_repository,
        match_odd_repository=match_odd_repository,
        user_repository=user_repository
    )


def match_command_usecase(
        settings: Settings = Depends(get_settings),
        match_score_api_dependency: MatchScoreApi = Depends(match_score_api_v2),
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> MatchCommandUseCase:
    return MatchCommandUseCaseImpl(
        match_score_api=match_score_api_dependency,
        uow_factory=lambda: MatchScoreUnitOfWorkImpl(session_factory=session_factory),
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
        manager_token: ManagerToken = Depends(manager_token_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
) -> dict:
    decoded = await manager_token.verify_token(token)  # Use verify_token to check blacklist
    if not decoded:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
        )

    user_email = decoded.get("email")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
        )

    user = await user_repository.find_by_email(user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé ou supprimé",
        )

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


class _PushSubscriptionRepositoryProxy(PushSubscriptionRepository):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory

    async def create(self, subscription):
        async with self._session_factory() as session:
            async with session.begin():
                return await PushSubscriptionRepositoryImpl(session).create(subscription)

    async def find_by_endpoint(self, endpoint: str):
        async with self._session_factory() as session:
            return await PushSubscriptionRepositoryImpl(session).find_by_endpoint(endpoint)

    async def find_by_user_id(self, user_id: int):
        async with self._session_factory() as session:
            return await PushSubscriptionRepositoryImpl(session).find_by_user_id(user_id)

    async def delete_by_endpoint(self, endpoint: str):
        async with self._session_factory() as session:
            async with session.begin():
                return await PushSubscriptionRepositoryImpl(session).delete_by_endpoint(endpoint)

    async def delete_by_user_id(self, user_id: int):
        async with self._session_factory() as session:
            async with session.begin():
                return await PushSubscriptionRepositoryImpl(session).delete_by_user_id(user_id)

    async def update_last_used(self, subscription_id: int, last_used_at: int):
        async with self._session_factory() as session:
            async with session.begin():
                return await PushSubscriptionRepositoryImpl(session).update_last_used(subscription_id, last_used_at)

    async def delete_by_id(self, subscription_id: int):
        async with self._session_factory() as session:
            async with session.begin():
                return await PushSubscriptionRepositoryImpl(session).delete_by_id(subscription_id)


def push_subscription_repository_dependency(
    session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> PushSubscriptionRepository:
    return _PushSubscriptionRepositoryProxy(session_factory)


@lru_cache()
def web_push_service_singleton() -> WebPushService:
    settings = get_settings()
    return WebPushServiceImpl(settings=settings)


def web_push_service_dependency() -> WebPushService:
    return web_push_service_singleton()


def push_subscription_usecase(
    session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
    push_subscription_repository: PushSubscriptionRepository = Depends(push_subscription_repository_dependency),
    web_push_service: WebPushService = Depends(web_push_service_dependency),
) -> PushSubscriptionUseCase:
    return PushSubscriptionUseCaseImpl(
        push_subscription_repository=push_subscription_repository,
        web_push_service=web_push_service,
        session_factory=session_factory,
    )


from domain.user.repository.password_reset_repository import PasswordResetRepository
from application.user.password_reset_usecase import PasswordResetUseCase, PasswordResetUseCaseImpl


def password_reset_repository_dependency() -> PasswordResetRepository:
    r = redis_client_singleton()
    if r is None:
        raise HTTPException(status_code=500, detail="Password reset storage not configured")
    from infrastructure.redis.password_reset_repository import RedisPasswordResetRepository
    return RedisPasswordResetRepository(redis=r)


def password_reset_usecase(
    user_repository: UserRepository = Depends(user_repository_dependency),
    hasher: Hash = Depends(hash_dependency),
    totp_service: TOTPService = Depends(totp_service),
    settings: Settings = Depends(get_settings),
    reset_repo: PasswordResetRepository = Depends(password_reset_repository_dependency),
) -> PasswordResetUseCase:
    return PasswordResetUseCaseImpl(
        user_repository=user_repository,
        password_reset_repository=reset_repo,
        hasher=hasher,
        totp_service=totp_service,
        settings=settings,
    )


from infrastructure.security.sse_rate_limiter import SlidingWindowRateLimiter
from infrastructure.security.redis_rate_limiter import RedisSlidingWindowRateLimiter


@lru_cache()
def delete_account_rate_limiter_singleton() -> SlidingWindowRateLimiter:
    settings = get_settings()
    return SlidingWindowRateLimiter(
        limit=int(getattr(settings, "delete_account_rate_limit_per_minute", 3)),
        window_s=int(getattr(settings, "delete_account_rate_limit_window_s", 60)),
    )


@lru_cache()
def redis_delete_account_rate_limiter_singleton() -> RedisSlidingWindowRateLimiter | None:
    r = redis_client_singleton()
    if r is None:
        return None
    # Singleton pour réutiliser _script_sha => évite SCRIPT LOAD à chaque requête
    return RedisSlidingWindowRateLimiter(redis=r)


async def rate_limit_delete_my_account(
    request: Request,
    current_user: dict = Depends(current_user),
    limiter: SlidingWindowRateLimiter = Depends(delete_account_rate_limiter_singleton),
):
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    user_id = current_user.get("id")

    key = f"delete_my_account:ip:{client_ip}:user:{user_id}"

    settings = get_settings()
    limit = int(getattr(settings, "delete_account_rate_limit_per_minute", 3))
    window_s = int(getattr(settings, "delete_account_rate_limit_window_s", 60))

    redis_limiter = redis_delete_account_rate_limiter_singleton()
    if redis_limiter is not None:
        result = await redis_limiter.allow(
            key=key,
            limit=limit,
            window_s=window_s,
        )
    else:
        result = limiter.allow(key)

    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit dépassé", "code": "RATE_LIMITED"},
            headers={"Retry-After": str(result.retry_after_s)},
        )

    return True


@lru_cache()
def change_password_rate_limiter_singleton() -> SlidingWindowRateLimiter:
    settings = get_settings()
    return SlidingWindowRateLimiter(
        limit=int(getattr(settings, "change_password_rate_limit_per_minute", 5)),
        window_s=int(getattr(settings, "change_password_rate_limit_window_s", 60)),
    )


@lru_cache()
def redis_change_password_rate_limiter_singleton() -> RedisSlidingWindowRateLimiter | None:
    r = redis_client_singleton()
    if r is None:
        return None
    return RedisSlidingWindowRateLimiter(redis=r)


async def rate_limit_change_my_password(
    request: Request,
    current_user: dict = Depends(current_user),
    limiter: SlidingWindowRateLimiter = Depends(change_password_rate_limiter_singleton),
):
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    user_id = current_user.get("id")

    key = f"change_my_password:ip:{client_ip}:user:{user_id}"

    settings = get_settings()
    limit = int(getattr(settings, "change_password_rate_limit_per_minute", 5))
    window_s = int(getattr(settings, "change_password_rate_limit_window_s", 60))

    redis_limiter = redis_change_password_rate_limiter_singleton()
    if redis_limiter is not None:
        result = await redis_limiter.allow(
            key=key,
            limit=limit,
            window_s=window_s,
        )
    else:
        result = limiter.allow(key)

    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit dépassé", "code": "RATE_LIMITED"},
            headers={"Retry-After": str(result.retry_after_s)},
        )

    return True

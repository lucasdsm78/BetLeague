"""Mini smoke test applicatif: invitation -> notification.

Objectif: valider l'intégration *Domain Event + Handler*:
- LeagueCommandUseCase.invite_user publie LeagueInvitationCreated
- Handler OnLeagueInvitationCreatedCreateNotification crée la notification

Pré-requis:
- DB up + migrations
- Au moins 1 ligue + 2 users

"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

# Assure que le dossier back/ est dans sys.path quand on lance le script directement
BACK_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BACK_DIR not in sys.path:
    sys.path.insert(0, BACK_DIR)

from sqlalchemy import text

from dependency_injections import get_session_factory, domain_event_bus_dependency, outbox_handler_bus_dependency
from infrastructure.logging_config import setup_logging
from infrastructure.postgresql.notification.notification_repository import NotificationRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl
from infrastructure.postgresql.invitation.invitation_repository import InvitationRepositoryImpl
from application.league.league_command_usecase import LeagueCommandUseCaseImpl
from application.events.outbox_processor import OutboxProcessor
from domain.notification.model.notification import NotificationType


logger = logging.getLogger(__name__)


async def main() -> None:
    session_factory = get_session_factory()

    handler_bus = outbox_handler_bus_dependency()

    async with session_factory() as session:
        async with session.begin():
            # trouve 1 ligue + owner + un autre utilisateur (invité)
            leagues = (await session.execute(text('select id, user_id from league order by id asc limit 1'))).all()
            if len(leagues) < 1:
                raise SystemExit('Il faut au moins 1 ligue en base pour ce smoke test')

            league_id = int(leagues[0].id)
            owner_user_id = int(leagues[0].user_id)

            owner_row = (await session.execute(text('select email from "user" where id = :id'), {'id': owner_user_id})).first()
            if not owner_row:
                raise SystemExit('Owner user introuvable pour la ligue')

            # Choisir un invité qui n'a pas déjà une invitation sur cette ligue
            invited_row = (await session.execute(
                text(
                    'select u.id '
                    'from "user" u '
                    'where u.id != :owner_id '
                    'and not exists (select 1 from invitation i where i.league_id = :league_id and i.user_id = u.id) '
                    'order by u.id asc '
                    'limit 1'
                ),
                {'owner_id': owner_user_id, 'league_id': league_id},
            )).first()

            if not invited_row:
                # Fallback: supprime une invitation existante pour libérer un user (smoke test)
                existing = (await session.execute(
                    text('select user_id from invitation where league_id = :league_id order by id asc limit 1'),
                    {'league_id': league_id},
                )).first()
                if not existing:
                    raise SystemExit('Aucun user disponible et aucune invitation existante à nettoyer.')

                await session.execute(
                    text('delete from invitation where league_id = :league_id and user_id = :user_id'),
                    {'league_id': league_id, 'user_id': int(existing.user_id)},
                )
                invited_user_id = int(existing.user_id)
            else:
                invited_user_id = int(invited_row.id)

            owner_email = owner_row.email

    # Exécute via usecase (écrit l’event en outbox)
    async with session_factory() as session:
        async with session.begin():
            event_bus = domain_event_bus_dependency(session=session)
            uc = LeagueCommandUseCaseImpl(
                league_repository=LeagueRepositoryImpl(session),
                user_repository=UserRepositoryImpl(session),
                session_factory=session_factory,
                league_players_repository=LeaguePlayersRepositoryImpl(session),
                invitation_repository=InvitationRepositoryImpl(session),
                event_bus=event_bus,
            )
            await uc.invite_user(league_id=league_id, user_id=invited_user_id, user_owner_email=owner_email)

    processor = OutboxProcessor(session_factory=session_factory, handler_bus=handler_bus, batch_size=50)
    processed = await processor.run_once()
    if processed < 1:
        raise SystemExit('❌ Aucun message outbox traité (attendu >= 1)')

    # Vérifie notification
    async with session_factory() as session:
        notif_repo = NotificationRepositoryImpl(session)
        unread = await notif_repo.unread_count(user_id=invited_user_id)
        items, _ = await notif_repo.list_by_user(user_id=invited_user_id, limit=50, cursor=None)

    has = any(n.type == NotificationType.LEAGUE_INVITATION for n in items)
    if not has:
        raise SystemExit('❌ Notification LEAGUE_INVITATION introuvable pour user invité')

    logger.info(
        "notification.demo.invitation_smoke_succeeded",
        extra={
            "league_id": league_id,
            "owner_user_id": owner_user_id,
            "invited_user_id": invited_user_id,
            "processed_outbox_messages": processed,
            "unread_count": unread,
        },
    )


if __name__ == '__main__':
    setup_logging(
        environment=os.getenv("ENVIRONMENT", "dev"),
        json_logs=None,
        component="notification_demo",
    )
    asyncio.run(main())

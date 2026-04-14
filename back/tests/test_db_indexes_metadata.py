import pytest
from sqlalchemy import UniqueConstraint

from infrastructure.postgresql.init_models import init_models
from infrastructure.postgresql.ticket.db_ticket import DBTicket
from infrastructure.postgresql.notification.db_notification import DBNotification
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers
from infrastructure.postgresql.match.db_match import DBMatch
from infrastructure.postgresql.league.db_league import DBLeague
from infrastructure.postgresql.invitation.db_invitation import DBInvitation
from infrastructure.postgresql.outbox.db_outbox_message import DBOutboxMessage
from infrastructure.postgresql.tournament.db_tournament import DBTournament
from infrastructure.postgresql.tournament.db_tournament_stage import DBTournamentStage
from infrastructure.postgresql.tournament.db_tournament_player import DBTournamentPlayer
from infrastructure.postgresql.tournament.db_tournament_match import DBTournamentMatch
from infrastructure.postgresql.tournament_subscription.db_tournament_subscription import DBTournamentSubscription
from infrastructure.postgresql.purchase.db_purchase import DBPurchase
from infrastructure.postgresql.user.db_user import DBUser


init_models()


def _index_by_name(table, name: str):
    for index in table.indexes:
        if index.name == name:
            return index
    return None


@pytest.mark.parametrize(
    ("table", "index_name", "columns"),
    [
        (DBTicket.__table__, "ix_ticket_league_id", ["league_id"]),
        (DBTicket.__table__, "ix_ticket_tournament_match_id", ["tournament_match_id"]),
        (DBTicket.__table__, "ix_ticket_user_status_league_id_id", ["user_id", "status", "league_id", "id"]),
        (DBTicket.__table__, "ix_ticket_user_tournament_match", ["user_id", "tournament_match_id"]),
        (DBNotification.__table__, "ix_notification_user_created_id", ["user_id", "created_at", "id"]),
        (DBLeaguePlayers.__table__, "ix_leagues_players_league_btl_rank", ["league_id", "btl_from_tickets", "user_id"]),
        (DBInvitation.__table__, "ix_invitation_user_created_at", ["user_id", "created_at", "id"]),
        (DBInvitation.__table__, "ix_invitation_user_status_created_at", ["user_id", "status", "created_at", "id"]),
        (DBMatch.__table__, "ix_match_time", ["time"]),
        (DBLeague.__table__, "ix_league_user_created_at", ["user_id", "created_at"]),
        (DBUser.__table__, "ix_user_pseudo_active", ["pseudo"]),
        (DBTournament.__table__, "ix_tournament_user_created_at", ["user_id", "created_at"]),
        (DBTournamentPlayer.__table__, "ix_tournament_player_tournament_stage_eliminated", ["tournament_id", "stage", "is_eliminated", "id"]),
        (DBTournamentMatch.__table__, "ix_tournament_match_tournament_type", ["tournament_id", "type"]),
        (DBTournamentSubscription.__table__, "ix_tournament_subscription_user_status", ["user_id", "status"]),
        (DBPurchase.__table__, "ix_purchase_user_created_id", ["user_id", "created_at", "id"]),
        (DBPurchase.__table__, "ix_purchase_pack_id", ["pack_id"]),
    ],
)
def test_expected_performance_indexes_are_declared(table, index_name: str, columns: list[str]):
    index = _index_by_name(table, index_name)

    assert index is not None
    assert [column.name for column in index.columns] == columns


def test_notification_unread_partial_index_is_declared() -> None:
    index = _index_by_name(DBNotification.__table__, "ix_notification_user_unread")

    assert index is not None
    assert [column.name for column in index.columns] == ["user_id"]
    assert str(index.dialect_options["postgresql"]["where"]) == "read_at IS NULL"


def test_tournament_stage_due_partial_index_is_declared() -> None:
    index = _index_by_name(DBTournamentStage.__table__, "ix_tournament_stage_due_active")

    assert index is not None
    assert [column.name for column in index.columns] == ["tournament_id", "end_date", "start_date", "id"]
    assert str(index.dialect_options["postgresql"]["where"]) == "is_active = true AND is_completed = false"


def test_user_active_pseudo_partial_index_is_declared() -> None:
    index = _index_by_name(DBUser.__table__, "ix_user_pseudo_active")

    assert index is not None
    assert [column.name for column in index.columns] == ["pseudo"]
    assert str(index.dialect_options["postgresql"]["where"]) == "deleted_at IS NULL"


def test_outbox_stale_lock_partial_index_is_declared() -> None:
    index = _index_by_name(DBOutboxMessage.__table__, "ix_outbox_message_stale_locked_at")

    assert index is not None
    assert [column.name for column in index.columns] == ["locked_at"]
    assert str(index.dialect_options["postgresql"]["where"]) == "processed_at IS NULL AND locked_at IS NOT NULL"


def test_tournament_name_has_single_named_unique_constraint_without_duplicate_indexes() -> None:
    unique_constraints = [
        constraint
        for constraint in DBTournament.__table__.constraints
        if isinstance(constraint, UniqueConstraint) and constraint.name == "uq_tournament_name"
    ]

    assert len(unique_constraints) == 1
    assert _index_by_name(DBTournament.__table__, "ix_tournament_name") is None
    assert _index_by_name(DBTournament.__table__, "ix_tournament_name_unique") is None


def test_leagues_players_redundant_composite_index_is_not_declared() -> None:
    assert _index_by_name(DBLeaguePlayers.__table__, "ix_leagues_players_user_id_league_id") is None


@pytest.mark.parametrize(
    ("table", "index_name"),
    [
        (DBTicket.__table__, "ix_ticket_id"),
        (DBNotification.__table__, "ix_notification_id"),
        (DBInvitation.__table__, "ix_invitation_id"),
        (DBLeague.__table__, "ix_league_id"),
        (DBMatch.__table__, "ix_match_id"),
        (DBPurchase.__table__, "ix_purchase_id"),
        (DBTournament.__table__, "ix_tournament_id"),
        (DBTournamentMatch.__table__, "ix_tournament_match_id"),
        (DBTournamentStage.__table__, "ix_tournament_stage_id"),
        (DBTournamentSubscription.__table__, "ix_tournament_subscription_id"),
        (DBUser.__table__, "ix_user_id"),
    ],
)
def test_redundant_primary_key_indexes_are_not_declared_in_metadata(table, index_name: str) -> None:
    assert _index_by_name(table, index_name) is None





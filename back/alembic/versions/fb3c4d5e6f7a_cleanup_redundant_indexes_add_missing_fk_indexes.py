"""cleanup redundant indexes and add missing fk indexes

Revision ID: fb3c4d5e6f7a
Revises: fa2b3c4d5e6f
Create Date: 2026-04-10 01:00:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "fb3c4d5e6f7a"
down_revision = "fa2b3c4d5e6f"
branch_labels = None
depends_on = None


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    return bind.dialect.has_index(bind, table_name, index_name)


def _drop_index_if_exists(table_name: str, index_name: str) -> None:
    if _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _create_index_if_missing(table_name: str, index_name: str, columns: list[str], *, unique: bool = False) -> None:
    if not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    _create_index_if_missing("ticket", "ix_ticket_league_id", ["league_id"])
    _create_index_if_missing("ticket", "ix_ticket_tournament_match_id", ["tournament_match_id"])
    _create_index_if_missing("purchase", "ix_purchase_pack_id", ["pack_id"])

    for table_name, index_name in [
        ("invitation", "ix_invitation_id"),
        ("league", "ix_league_id"),
        ("match", "ix_match_id"),
        ("match_choices", "ix_match_choices_id"),
        ("notification", "ix_notification_id"),
        ("outbox_message", "ix_outbox_message_id"),
        ("pack", "ix_pack_id"),
        ("purchase", "ix_purchase_id"),
        ("ticket", "ix_ticket_id"),
        ("tournament", "ix_tournament_id"),
        ("tournament_match", "ix_tournament_match_id"),
        ("tournament_stage", "ix_tournament_stage_id"),
        ("tournament_subscription", "ix_tournament_subscription_id"),
        ("user", "ix_user_id"),
        ("tournament", "ix_tournament_name"),
        ("tournament", "ix_tournament_name_unique"),
        ("leagues_players", "ix_leagues_players_user_id_league_id"),
    ]:
        _drop_index_if_exists(table_name, index_name)


def downgrade() -> None:
    _create_index_if_missing("invitation", "ix_invitation_id", ["id"])
    _create_index_if_missing("league", "ix_league_id", ["id"])
    _create_index_if_missing("match", "ix_match_id", ["id"])
    _create_index_if_missing("match_choices", "ix_match_choices_id", ["id"])
    _create_index_if_missing("notification", "ix_notification_id", ["id"])
    _create_index_if_missing("outbox_message", "ix_outbox_message_id", ["id"])
    _create_index_if_missing("pack", "ix_pack_id", ["id"])
    _create_index_if_missing("purchase", "ix_purchase_id", ["id"])
    _create_index_if_missing("ticket", "ix_ticket_id", ["id"])
    _create_index_if_missing("tournament", "ix_tournament_id", ["id"])
    _create_index_if_missing("tournament_match", "ix_tournament_match_id", ["id"])
    _create_index_if_missing("tournament_stage", "ix_tournament_stage_id", ["id"])
    _create_index_if_missing("tournament_subscription", "ix_tournament_subscription_id", ["id"])
    _create_index_if_missing("user", "ix_user_id", ["id"])
    _create_index_if_missing("tournament", "ix_tournament_name", ["name"], unique=True)
    _create_index_if_missing("tournament", "ix_tournament_name_unique", ["name"], unique=True)
    _create_index_if_missing("leagues_players", "ix_leagues_players_user_id_league_id", ["user_id", "league_id"])

    _drop_index_if_exists("purchase", "ix_purchase_pack_id")
    _drop_index_if_exists("ticket", "ix_ticket_tournament_match_id")
    _drop_index_if_exists("ticket", "ix_ticket_league_id")

